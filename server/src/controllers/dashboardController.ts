import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { effectiveCertificateStatus } from '../domain/certificateStatus';

const dayBounds = () => { const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); return { gte: start, lt: end }; };

export const businessDashboard = async (req: AuthRequest, res: Response) => {
    const [instruments, applications, assignments, certificates] = await Promise.all([
        prisma.instrument.count({ where: { businessId: req.user!.id } }),
        prisma.application.groupBy({ by: ['status'], where: { businessId: req.user!.id }, _count: true }),
        prisma.assignment.count({ where: { application: { businessId: req.user!.id }, scheduledDate: { gte: new Date() } } }),
        prisma.certificate.findMany({ where: { application: { businessId: req.user!.id } }, select: { status: true, validUntil: true } })
    ]);
    const now = new Date();
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const effectiveStatuses = certificates.map(c => effectiveCertificateStatus(c.status, c.validUntil, now, expiryWindowDays));
    return res.json({ success: true, metrics: { totalInstruments: instruments, applicationsByStatus: applications, upcomingInspections: assignments, validCertificates: effectiveStatuses.filter(status => status === 'VALID').length, expiringCertificates: effectiveStatuses.filter(status => status === 'EXPIRING_SOON').length } });
};

export const adminDashboard = async (_req: AuthRequest, res: Response) => {
    const [instruments, applications, todaysInspections, failed, reinspection, certificates, applicationStatuses] = await Promise.all([
        prisma.instrument.count(), prisma.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }), prisma.assignment.count({ where: { scheduledDate: dayBounds() } }), prisma.inspection.count({ where: { result: 'FAIL' } }), prisma.application.count({ where: { status: 'REINSPECTION_REQUIRED' } }), prisma.certificate.findMany({ select: { status: true, validUntil: true } }), prisma.application.groupBy({ by: ['status'], _count: true })
    ]);
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const expiringCertificates = certificates.filter(certificate => effectiveCertificateStatus(certificate.status, certificate.validUntil, new Date(), expiryWindowDays) === 'EXPIRING_SOON').length;
    return res.json({ success: true, metrics: { totalInstruments: instruments, pendingApplications: applications, todaysInspections, failedInspections: failed, reinspectionCases: reinspection, expiringCertificates }, applicationStatuses });
};

export const lmoDashboard = async (req: AuthRequest, res: Response) => {
    const [today, upcoming, pendingSync] = await Promise.all([
        prisma.assignment.count({ where: { lmoId: req.user!.id, scheduledDate: dayBounds() } }),
        prisma.assignment.count({ where: { lmoId: req.user!.id, scheduledDate: { gt: new Date() } } }),
        prisma.application.count({ where: { assignments: { some: { lmoId: req.user!.id } }, status: 'INSPECTION_IN_PROGRESS' } })
    ]);
    return res.json({ success: true, metrics: { todaysInspections: today, upcomingInspections: upcoming, pendingSync } });
};
