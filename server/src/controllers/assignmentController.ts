import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listLMOs = async (_req: AuthRequest, res: Response) => {
    const lmos = await prisma.user.findMany({ where: { role: 'LMO' }, select: { id: true, name: true, email: true, phone: true }, orderBy: { name: 'asc' } });
    return res.json({ success: true, lmos });
};

export const assignApplication = async (req: AuthRequest, res: Response) => {
    try {
        const { applicationId, lmoId, scheduledDate } = req.body;
        if (typeof applicationId !== 'string' || typeof lmoId !== 'string' || typeof scheduledDate !== 'string' || Number.isNaN(Date.parse(scheduledDate))) {
            return res.status(400).json({ success: false, message: 'applicationId, lmoId, and a valid scheduledDate are required.' });
        }
        // Validate LMO exists and is actually an LMO
        const lmoUser = await prisma.user.findUnique({ where: { id: lmoId } });
        if (!lmoUser || lmoUser.role !== 'LMO') {
            return res.status(400).json({ success: false, message: 'Invalid LMO selected.' });
        }

        // Validate Application
        const application = await prisma.application.findUnique({ where: { id: applicationId } });
        if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
        if (!['SUBMITTED', 'UNDER_REVIEW', 'REINSPECTION_REQUIRED'].includes(application.status)) return res.status(409).json({ success: false, message: `Application cannot be assigned from ${application.status}.` });
        const scheduled = new Date(scheduledDate);
        const duplicate = await prisma.assignment.findFirst({ where: { applicationId, lmoId, scheduledDate: scheduled } });
        if (duplicate) return res.status(200).json({ success: true, duplicate: true, message: 'This inspection assignment already exists.', assignment: duplicate });

        // Transaction: Assign and Update Status
        const [assignment] = await prisma.$transaction([
            prisma.assignment.create({
                data: { applicationId, lmoId, scheduledDate: scheduled }
            }),
            prisma.application.update({
                where: { id: applicationId },
                data: { status: 'SCHEDULED' }
            }),
            prisma.applicationStatusHistory.create({ data: { applicationId, fromStatus: application.status, toStatus: 'SCHEDULED', changedById: req.user!.id, metadata: { lmoId, scheduledDate } } }),
            prisma.auditLog.create({ data: { userId: req.user!.id, action: 'INSPECTION_SCHEDULED', entityType: 'APPLICATION', entityId: applicationId, oldValue: { status: application.status }, newValue: { status: 'SCHEDULED', lmoId, scheduledDate } } }),
            prisma.notification.create({ data: { userId: application.businessId, type: 'APPLICATION_ASSIGNED', title: 'Inspection assigned', message: `Application ${applicationId} was assigned and scheduled for inspection.` } }),
            prisma.notification.create({ data: { userId: lmoId, type: 'INSPECTION_SCHEDULED', title: 'Inspection scheduled', message: `You have been assigned application ${applicationId}.` } })
        ]);

        res.status(201).json({ success: true, message: 'Inspection assigned successfully', assignment });
    } catch (error: any) {
        if (error?.code === 'P2002') return res.status(409).json({ success: false, message: 'This inspection assignment already exists.' });
        res.status(500).json({ success: false, message: error.message });
    }
};

export const listAssignments = async (req: AuthRequest, res: Response) => {
    const where = req.user?.role === 'LMO' ? { lmoId: req.user.id } : {};
    const assignments = await prisma.assignment.findMany({ where, include: { application: { include: { instrument: true, business: { select: { id: true, name: true, email: true, role: true } } } }, lmo: { select: { id: true, name: true, email: true, phone: true, role: true } } }, orderBy: { scheduledDate: 'asc' } });
    return res.json({ success: true, assignments });
};

export const updateAssignment = async (req: AuthRequest, res: Response) => {
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id as string }, include: { application: true } });
    if (!assignment) return res.status(404).json({ success: false, message: 'Inspection assignment not found.' });
    if (!['SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'SCHEDULED', 'REINSPECTION_REQUIRED'].includes(assignment.application.status)) return res.status(409).json({ success: false, message: `Assignment cannot be changed from ${assignment.application.status}.` });
    const lmoId = typeof req.body.lmoId === 'string' ? req.body.lmoId : assignment.lmoId;
    const scheduledDate = typeof req.body.scheduledDate === 'string' ? new Date(req.body.scheduledDate) : assignment.scheduledDate;
    if (Number.isNaN(scheduledDate.getTime())) return res.status(400).json({ success: false, message: 'A valid scheduledDate is required.' });
    const lmo = await prisma.user.findUnique({ where: { id: lmoId }, select: { id: true, role: true } });
    if (!lmo || lmo.role !== 'LMO') return res.status(400).json({ success: false, message: 'Invalid LMO selected.' });
    const updated = await prisma.$transaction(async tx => {
        const result = await tx.assignment.update({ where: { id: assignment.id }, data: { lmoId, scheduledDate } });
        await tx.auditLog.create({ data: { userId: req.user!.id, action: 'ASSIGNMENT_UPDATED', entityType: 'ASSIGNMENT', entityId: assignment.id, oldValue: { lmoId: assignment.lmoId, scheduledDate: assignment.scheduledDate }, newValue: { lmoId, scheduledDate } } });
        await tx.notification.create({ data: { userId: lmoId, type: 'INSPECTION_SCHEDULED', title: 'Inspection assignment updated', message: `Your inspection assignment for application ${assignment.applicationId} has been updated.` } });
        return result;
    });
    return res.json({ success: true, assignment: updated });
};
