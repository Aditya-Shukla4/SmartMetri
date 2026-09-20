"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markNotificationRead = exports.listNotifications = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const listNotifications = async (req, res) => {
    const notifications = await prisma_1.default.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return res.json({ success: true, notifications });
};
exports.listNotifications = listNotifications;
const markNotificationRead = async (req, res) => {
    const notification = await prisma_1.default.notification.findUnique({ where: { id: req.params.id } });
    if (!notification)
        return res.status(404).json({ success: false, message: 'Notification not found.' });
    if (notification.userId !== req.user.id)
        return res.status(403).json({ success: false, message: 'You cannot update this notification.' });
    return res.json({ success: true, notification: await prisma_1.default.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } }) });
};
exports.markNotificationRead = markNotificationRead;
