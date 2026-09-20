import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const exportApplicationsCsv = async (_req: AuthRequest, res: Response) => {
    const applications = await prisma.application.findMany({ include: { instrument: true, business: { select: { name: true, email: true } }, assignments: { include: { lmo: { select: { name: true } } }, orderBy: { scheduledDate: 'desc' }, take: 1 }, inspections: { orderBy: { completedAt: 'desc' }, take: 1 }, certificate: true }, orderBy: { createdAt: 'desc' } });
    const rows = [['application_code', 'status', 'business', 'business_email', 'instrument_code', 'serial_number', 'assigned_lmo', 'scheduled_date', 'latest_result', 'certificate_code', 'created_at'], ...applications.map(application => { const assignment = (application as any).assignments?.[0]; return [application.applicationCode, application.status, application.business.name, application.business.email, application.instrument.instrumentCode, application.instrument.serialNumber, assignment?.lmo?.name || '', assignment?.scheduledDate?.toISOString() || '', application.inspections[0]?.result || '', application.certificate?.certificateCode || '', application.createdAt.toISOString()]; })];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="smartmetri-applications.csv"');
    return res.send(rows.map(row => row.map(csvCell).join(',')).join('\n'));
};
