"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listUsers = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const listUsers = async (req, res) => {
    const role = typeof req.query.role === 'string' && ['ADMIN', 'LMO', 'BUSINESS', 'GATC'].includes(req.query.role) ? req.query.role : undefined;
    const users = await prisma_1.default.user.findMany({ where: role ? { role } : {}, select: { id: true, name: true, email: true, phone: true, role: true, stateId: true, districtId: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, users });
};
exports.listUsers = listUsers;
