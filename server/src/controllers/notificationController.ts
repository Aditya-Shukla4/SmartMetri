import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listNotifications = async (req: AuthRequest, res: Response) => {
    const notifications = await prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ success: true, notifications });
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id as string } });
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (notification.userId !== req.user!.id) return res.status(403).json({ success: false, message: 'You cannot update this notification.' });
    return res.json({ success: true, notification: await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } }) });
};
