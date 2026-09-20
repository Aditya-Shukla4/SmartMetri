import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import crypto from 'crypto';
import { supabase } from '../utils/supabaseClient';
import { createNotification } from '../utils/notifications';
import { syncSchema, syncStatusSchema } from '../validation/schemas';

export const getSyncStatus = async (req: AuthRequest, res: Response) => {
    const parsed = syncStatusSchema.safeParse({ clientSyncId: req.query.clientSyncId });
    if (!parsed.success) return res.status(400).json({ success: false, message: 'A valid clientSyncId is required.' });
    const inspection = await prisma.inspection.findUnique({ where: { clientSyncId: parsed.data.clientSyncId }, include: { evidence: true } });
    if (!inspection) return res.json({ success: true, syncStatus: 'NOT_FOUND', clientSyncId: parsed.data.clientSyncId });
    if (inspection.lmoId !== req.user!.id) return res.status(403).json({ success: false, message: 'This sync identifier belongs to another officer.' });
    return res.json({ success: true, syncStatus: 'SYNCED', clientSyncId: inspection.clientSyncId, inspection });
};

export const listInspections = async (req: AuthRequest, res: Response) => {
    const assignments = await prisma.assignment.findMany({ where: { lmoId: req.user!.id }, include: { application: { include: { instrument: true, business: { select: { id: true, name: true, email: true, role: true } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'desc' } } } } }, orderBy: { scheduledDate: 'asc' } });
    return res.json({ success: true, assignments });
};

export const getInspection = async (req: AuthRequest, res: Response) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id as string }, include: { application: { include: { instrument: true, business: { select: { id: true, name: true, email: true, role: true } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'asc' } } } }, lmo: { select: { id: true, name: true, email: true, role: true } } } });
    if (!assignment) return res.status(404).json({ success: false, message: 'Inspection assignment not found.' });
    if (req.user!.role === 'LMO' && assignment.lmoId !== req.user!.id) return res.status(403).json({ success: false, message: 'Inspection is not assigned to this officer.' });
    return res.json({ success: true, assignment });
};

export const startInspection = async (req: AuthRequest, res: Response) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id as string }, include: { application: true } });
    if (!assignment) return res.status(404).json({ success: false, message: 'Inspection assignment not found.' });
    if (assignment.lmoId !== req.user!.id) return res.status(403).json({ success: false, message: 'Inspection is not assigned to this officer.' });
    if (!['ASSIGNED', 'SCHEDULED', 'REINSPECTION_REQUIRED'].includes(assignment.application.status)) return res.status(409).json({ success: false, message: `Inspection cannot start from ${assignment.application.status}.` });
    const updated = await prisma.$transaction(async tx => {
        const application = await tx.application.update({ where: { id: assignment.applicationId }, data: { status: 'INSPECTION_IN_PROGRESS' } });
        await tx.applicationStatusHistory.create({ data: { applicationId: assignment.applicationId, fromStatus: assignment.application.status, toStatus: 'INSPECTION_IN_PROGRESS', changedById: req.user!.id } });
        await tx.auditLog.create({ data: { userId: req.user!.id, action: 'INSPECTION_STARTED', entityType: 'APPLICATION', entityId: assignment.applicationId, oldValue: { status: assignment.application.status }, newValue: { status: application.status } } });
        return application;
    });
    return res.json({ success: true, application: updated });
};

export const syncInspection = async (req: AuthRequest, res: Response) => {
    let syncIdForError: string | undefined;
    try {
        let payload = req.body;
        if (typeof req.body.payload === 'string') {
            try { payload = JSON.parse(req.body.payload); } catch { return res.status(400).json({ success: false, message: 'Invalid sync payload.' }); }
        }
        const parsedPayload = syncSchema.safeParse(payload);
        if (!parsedPayload.success) return res.status(400).json({ success: false, message: 'Invalid inspection sync payload.', errors: parsedPayload.error.issues.map(issue => ({ path: issue.path, message: issue.message })) });
        payload = parsedPayload.data;
        const { clientSyncId, assignmentId, result, remarks, failureReason, latitude, longitude, startedAt, completedAt, evidence = [], checklistResults = [] } = payload;
        syncIdForError = clientSyncId;
        if (!clientSyncId || typeof clientSyncId !== 'string' || !assignmentId || typeof assignmentId !== 'string' || !['PASS', 'FAIL'].includes(result)) return res.status(400).json({ success: false, message: 'clientSyncId, assignmentId and PASS/FAIL result are required.' });
        if (![latitude, longitude].every(value => typeof value === 'number' && Number.isFinite(value)) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return res.status(400).json({ success: false, message: 'Valid GPS coordinates are required.' });
        if (!startedAt || !completedAt || Number.isNaN(Date.parse(startedAt)) || Number.isNaN(Date.parse(completedAt)) || Date.parse(completedAt) < Date.parse(startedAt)) return res.status(400).json({ success: false, message: 'Valid inspection start and completion timestamps are required.' });
        if (!Array.isArray(evidence)) return res.status(400).json({ success: false, message: 'Evidence must be an array.' });
        if (!Array.isArray(checklistResults) || !checklistResults.length) return res.status(400).json({ success: false, message: 'Inspection checklist results are required.' });
        if (result === 'PASS' && (!remarks || !evidence.length || checklistResults.some((item: any) => item.passed !== true))) return res.status(400).json({ success: false, message: 'A passing inspection requires remarks, evidence, and all checklist items passed.' });
        if (result === 'FAIL' && (!failureReason || !remarks || !evidence.length || !checklistResults.some((item: any) => item.passed === false))) return res.status(400).json({ success: false, message: 'Failed inspections require remarks, a failure reason, evidence, and at least one failed checklist item.' });

        const existing = await prisma.inspection.findUnique({ where: { clientSyncId }, include: { evidence: true } });
        if (existing) {
            if (existing.lmoId !== req.user!.id) return res.status(403).json({ success: false, message: 'This sync identifier belongs to another officer.' });
            return res.json({ success: true, syncStatus: 'SYNCED', duplicate: true, inspection: existing });
        }

        const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { application: { include: { instrument: { select: { type: true } } } } } });
        if (!assignment || assignment.lmoId !== req.user!.id) return res.status(403).json({ success: false, message: 'Inspection is not assigned to this officer.' });
        if (!['ASSIGNED', 'SCHEDULED', 'INSPECTION_IN_PROGRESS', 'REINSPECTION_REQUIRED'].includes(assignment.application.status)) return res.status(400).json({ success: false, message: 'Application is not ready for inspection.' });
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (files.length !== evidence.length) return res.status(400).json({ success: false, message: 'Every inspection evidence record must include one uploaded evidence file.' });
        const checklistItemIds = checklistResults.map((item: any) => item.checklistItemId);
        if (checklistItemIds.some((id: any) => typeof id !== 'string') || new Set(checklistItemIds).size !== checklistItemIds.length) return res.status(400).json({ success: false, message: 'Checklist item identifiers must be unique and valid.' });
        const configuredTemplate = await prisma.checklistTemplate.findFirst({ where: { active: true, OR: [{ instrumentType: assignment.application.instrument.type }, { instrumentType: null }] }, include: { items: { select: { id: true, required: true } } }, orderBy: { createdAt: 'desc' } });
        const configuredItems = configuredTemplate?.items || [];
        const configuredIds = new Set(configuredItems.map(item => item.id));
        if (!configuredTemplate || configuredItems.some(item => item.required && !checklistResults.some((result: any) => result.checklistItemId === item.id)) || checklistItemIds.some((id: string) => !configuredIds.has(id))) return res.status(400).json({ success: false, message: 'Checklist results must include every required item from the active instrument checklist.' });
        if (evidence.some((item: any) => typeof item?.fileUrl !== 'string' || !item.fileUrl.trim() || !['instrument overview', 'serial/nameplate', 'seal/marking', 'observation', 'other'].includes(item.evidenceType || 'other'))) return res.status(400).json({ success: false, message: 'Each evidence record requires a file URL and valid evidence type.' });

        const uploadedEvidence = [...evidence];
        if (files.length) {
            for (let index = 0; index < files.length; index += 1) {
                const file = files[index];
                const extension = (file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
                const storagePath = `inspections/${assignmentId}/${clientSyncId}-${index}.${extension}`;
                const { error } = await supabase.storage.from('evidence').upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });
                if (error) return res.status(502).json({ success: false, syncStatus: 'FAILED', message: 'Evidence upload failed; inspection was not finalized.' });
                const { data } = supabase.storage.from('evidence').getPublicUrl(storagePath);
                const metadata = evidence[index] || {};
                uploadedEvidence[index] = { ...metadata, evidenceType: metadata.evidenceType || 'other', fileUrl: data.publicUrl, fileHash: crypto.createHash('sha256').update(file.buffer).digest('hex') };
            }
        }

        const inspection = await prisma.$transaction(async (tx) => {
            const created = await tx.inspection.create({
                data: {
                    clientSyncId, result, remarks, failureReason,
                    latitude: Number(latitude), longitude: Number(longitude),
                    startedAt: new Date(startedAt), completedAt: new Date(completedAt),
                    applicationId: assignment.applicationId, lmoId: req.user!.id,
                    evidence: { create: uploadedEvidence.map((item: any) => ({ evidenceType: item.evidenceType || 'other', fileUrl: item.fileUrl, fileHash: item.fileHash || '', latitude: Number(item.latitude ?? latitude), longitude: Number(item.longitude ?? longitude), capturedAt: new Date(item.capturedAt || completedAt) })) },
                    checklistResults: { create: checklistResults.map((item: any) => ({ checklistItemId: item.checklistItemId, observedValue: item.observedValue, passed: item.passed === true, remarks: item.remarks })) }
                }, include: { evidence: true }
            });
            await tx.application.update({ where: { id: assignment.applicationId }, data: { status: result === 'PASS' ? 'PASSED' : 'REINSPECTION_REQUIRED', remarks } });
            await tx.applicationStatusHistory.create({ data: { applicationId: assignment.applicationId, fromStatus: assignment.application.status, toStatus: result === 'PASS' ? 'PASSED' : 'REINSPECTION_REQUIRED', changedById: req.user!.id, metadata: { inspectionId: created.id, result } } });
            await tx.instrument.update({ where: { id: assignment.application.instrumentId }, data: { status: result === 'PASS' ? 'VERIFIED' : 'REJECTED' } });
            await tx.auditLog.create({ data: { userId: req.user!.id, action: result === 'PASS' ? 'INSPECTION_PASSED' : 'INSPECTION_FAILED', entityType: 'INSPECTION', entityId: created.id, newValue: { clientSyncId, result } } });
            await createNotification(tx, assignment.application.businessId, result === 'PASS' ? 'INSPECTION_COMPLETED' : 'REINSPECTION_REQUIRED', result === 'PASS' ? 'Inspection passed' : 'Reinspection required', result === 'PASS' ? 'Your inspection passed and is eligible for certificate issuance.' : 'Your inspection failed and requires reinspection.');
            return created;
        });
        return res.status(201).json({ success: true, syncStatus: 'SYNCED', inspection });
    } catch (error: any) {
        if (error?.code === 'P2002') {
            const existing = syncIdForError ? await prisma.inspection.findUnique({ where: { clientSyncId: syncIdForError }, include: { evidence: true } }) : null;
            if (existing) return res.json({ success: true, syncStatus: 'SYNCED', duplicate: true, inspection: existing });
        }
        return res.status(500).json({ success: false, message: error.message || 'Inspection sync failed.' });
    }
};
