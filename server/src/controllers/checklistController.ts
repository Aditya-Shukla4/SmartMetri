import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listChecklists = async (req: AuthRequest, res: Response) => {
    const instrumentType = typeof req.query.instrumentType === 'string' ? req.query.instrumentType : undefined;
    const templates = await prisma.checklistTemplate.findMany({ where: { active: true, ...(instrumentType ? { OR: [{ instrumentType }, { instrumentType: null }] } : {}) }, include: { items: { orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, templates });
};

export const createChecklist = async (req: AuthRequest, res: Response) => {
    const { name, instrumentType, items } = req.body;
    if (typeof name !== 'string' || !name.trim() || !Array.isArray(items) || !items.length || items.some((item: any) => typeof item.label !== 'string' || !item.label.trim())) return res.status(400).json({ success: false, message: 'Checklist name and at least one labelled item are required.' });
    const template = await prisma.checklistTemplate.create({ data: { name: name.trim(), instrumentType: typeof instrumentType === 'string' && instrumentType.trim() ? instrumentType.trim() : null, items: { create: items.map((item: any) => ({ label: item.label.trim(), expectedCondition: typeof item.expectedCondition === 'string' ? item.expectedCondition : null, required: item.required !== false })) } }, include: { items: true } });
    return res.status(201).json({ success: true, template });
};
