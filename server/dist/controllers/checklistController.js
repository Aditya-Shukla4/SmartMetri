"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChecklist = exports.listChecklists = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const listChecklists = async (req, res) => {
    const instrumentType = typeof req.query.instrumentType === 'string' ? req.query.instrumentType : undefined;
    const templates = await prisma_1.default.checklistTemplate.findMany({ where: { active: true, ...(instrumentType ? { OR: [{ instrumentType }, { instrumentType: null }] } : {}) }, include: { items: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, templates });
};
exports.listChecklists = listChecklists;
const createChecklist = async (req, res) => {
    const { name, instrumentType, items } = req.body;
    if (typeof name !== 'string' || !name.trim() || !Array.isArray(items) || !items.length || items.some((item) => typeof item.label !== 'string' || !item.label.trim()))
        return res.status(400).json({ success: false, message: 'Checklist name and at least one labelled item are required.' });
    const template = await prisma_1.default.checklistTemplate.create({ data: { name: name.trim(), instrumentType: typeof instrumentType === 'string' && instrumentType.trim() ? instrumentType.trim() : null, items: { create: items.map((item) => ({ label: item.label.trim(), expectedCondition: typeof item.expectedCondition === 'string' ? item.expectedCondition : null, required: item.required !== false })) } }, include: { items: true } });
    return res.status(201).json({ success: true, template });
};
exports.createChecklist = createChecklist;
