import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listAuditLogs = async (req: AuthRequest, res: Response) => {
    const { action, entityType, entityId } = req.query;
    const logs = await prisma.auditLog.findMany({ where: { ...(typeof action === 'string' ? { action } : {}), ...(typeof entityType === 'string' ? { entityType } : {}), ...(typeof entityId === 'string' ? { entityId } : {}) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
    return res.json({ success: true, logs });
};
