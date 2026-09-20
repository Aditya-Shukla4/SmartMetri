import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import crypto from 'crypto';
import { supabase } from '../utils/supabaseClient'; // The client you just made
import { allowedTransitions } from '../domain/applicationState';
import { createNotification } from '../utils/notifications';

export const createApplication = async (req: AuthRequest, res: Response) => {
    try {
        const { instrumentId, applicationType = 'VERIFICATION', remarks } = req.body;
        const businessId = req.user?.id;

        if (!businessId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        // Validation 1: Instrument check
        const instrument = await prisma.instrument.findUnique({ where: { id: instrumentId } });
        if (!instrument || instrument.businessId !== businessId) {
            return res.status(404).json({ success: false, message: 'Instrument not found or does not belong to you.' });
        }

        // Validation 2: Active application check
        const activeApplication = await prisma.application.findFirst({
            where: {
                instrumentId,
                status: { notIn: ['CERTIFICATE_ISSUED', 'FAILED'] }
            }
        });

        if (activeApplication) {
            return res.status(409).json({ success: false, message: 'Active application already exists.' });
        }

        // IMAGE UPLOAD LOGIC
        const files = req.files as Express.Multer.File[];
        const evidenceUrls: string[] = [];

        if (files && files.length > 0) {
            for (const file of files) {
                // Generate unique filename to avoid overriding
                const fileExt = (file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
                const fileName = `${businessId}-${Date.now()}-${crypto.randomBytes(2).toString('hex')}.${fileExt}`;
                const filePath = `applications/${fileName}`;

                // Push buffer to Supabase bucket
                const { data, error } = await supabase.storage
                    .from('evidence')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                    });

                if (error) {
                    console.error("Supabase Upload Error:", error);
                    return res.status(500).json({ success: false, message: 'Failed to upload images.' });
                }

                // Get the public URL for the DB
                const { data: publicUrlData } = supabase.storage
                    .from('evidence')
                    .getPublicUrl(filePath);

                evidenceUrls.push(publicUrlData.publicUrl);
            }
        }

        const applicationCode = `LM-APP-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        // DB Transaction
        const application = await prisma.$transaction(async (tx) => {
            const created = await tx.application.create({
                data: {
                    applicationCode,
                    instrumentId,
                    businessId,
                    applicationType,
                    remarks,
                    evidenceUrls, // Now saving the Supabase links in our DB
                    status: 'SUBMITTED'
                }
            });
            await tx.instrument.update({
                where: { id: instrumentId },
                data: { status: 'VERIFICATION_PENDING' }
            });
            await tx.applicationStatusHistory.create({ data: { applicationId: created.id, toStatus: 'SUBMITTED', changedById: businessId, metadata: { evidenceCount: evidenceUrls.length } } });
            await tx.auditLog.create({ data: { userId: businessId, action: 'APPLICATION_SUBMITTED', entityType: 'APPLICATION', entityId: created.id, newValue: { instrumentId, evidenceCount: evidenceUrls.length } } });
            await createNotification(tx, businessId, 'APPLICATION_SUBMITTED', 'Application submitted', `Application ${created.applicationCode} was submitted for review.`);
            return created;
        });

        res.status(201).json({ success: true, message: 'Application submitted with evidence', application });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listApplications = async (req: AuthRequest, res: Response) => {
    const where = req.user?.role === 'BUSINESS' ? { businessId: req.user.id } : req.user?.role === 'LMO' ? { assignments: { some: { lmoId: req.user.id } } } : {};
    const applications = await prisma.application.findMany({
        where,
        include: { instrument: true, business: { select: { id: true, name: true, email: true, role: true } }, assignments: { include: { lmo: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { scheduledDate: 'desc' } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'desc' } }, statusHistory: { include: { changedBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } }, certificate: true },
        orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, applications });
};

export const getApplication = async (req: AuthRequest, res: Response) => {
    const application = await prisma.application.findUnique({
        where: { id: req.params.id as string },
        include: { instrument: true, business: { select: { id: true, name: true, email: true, role: true } }, assignments: { include: { lmo: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { scheduledDate: 'desc' } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'asc' } }, statusHistory: { include: { changedBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } }, certificate: true }
    });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (req.user?.role === 'BUSINESS' && application.businessId !== req.user.id) return res.status(403).json({ success: false, message: 'You cannot access this application.' });
    if (req.user?.role === 'LMO' && !application.assignments.some(assignment => assignment.lmo.id === req.user!.id)) return res.status(403).json({ success: false, message: 'This application is not assigned to this officer.' });
    return res.json({ success: true, application });
};

export const updateApplicationStatus = async (req: AuthRequest, res: Response) => {
    const { status } = req.body as { status?: string };
    const application = await prisma.application.findUnique({ where: { id: req.params.id as string } });
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (!status || !allowedTransitions[application.status]?.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid transition from ${application.status} to ${status || 'empty'}.` });
    }
    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.application.update({ where: { id: application.id }, data: { status: status as any } });
        await tx.applicationStatusHistory.create({ data: { applicationId: application.id, fromStatus: application.status, toStatus: status as any, changedById: req.user!.id } });
        await tx.auditLog.create({ data: { userId: req.user!.id, action: 'APPLICATION_STATUS_CHANGED', entityType: 'APPLICATION', entityId: application.id, oldValue: { status: application.status }, newValue: { status } } });
        return result;
    });
    return res.json({ success: true, application: updated });
};
