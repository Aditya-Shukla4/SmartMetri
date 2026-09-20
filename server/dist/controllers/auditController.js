"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogs = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const listAuditLogs = async (req, res) => {
    const { action, entityType, entityId } = req.query;
    const logs = await prisma_1.default.auditLog.findMany({ where: { ...(typeof action === 'string' ? { action } : {}), ...(typeof entityType === 'string' ? { entityType } : {}), ...(typeof entityId === 'string' ? { entityId } : {}) }, include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
    return res.json({ success: true, logs });
};
exports.listAuditLogs = listAuditLogs;
