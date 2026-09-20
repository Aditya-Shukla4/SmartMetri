import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import crypto from 'crypto';
// Upar imports ke section mein ye line daal
import { InstrumentStatus } from '@prisma/client';

// 1. REGISTER INSTRUMENT
export const registerInstrument = async (req: AuthRequest, res: Response) => {
    try {
        const { type, manufacturer, model, serialNumber, capacity, state, district, location } = req.body;

        const businessId = req.user?.id;
        if (!businessId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (![type, manufacturer, model, serialNumber, capacity, state, district, location].every(value => typeof value === 'string' && value.trim().length > 0)) {
            return res.status(400).json({ success: false, message: 'All instrument and location fields are required.' });
        }

        // Check duplicate serial number
        const existingInstrument = await prisma.instrument.findUnique({
            where: { serialNumber }
        });

        if (existingInstrument) {
            return res.status(400).json({
                success: false,
                message: 'Instrument with this Serial Number already exists.'
            });
        }

        // Generate unique instrument code
        const shortHash = crypto.randomBytes(3).toString('hex').toUpperCase();
        const instrumentCode = `INS-${new Date().getFullYear()}-${shortHash}`;

        const instrument = await prisma.$transaction(async (tx) => {
            const created = await tx.instrument.create({ data: {
                instrumentCode,
                type,
                manufacturer,
                model,
                serialNumber,
                capacity,
                state,
                district,
                location,
                businessId,
                status: 'UNVERIFIED'
            } });
            await tx.auditLog.create({ data: { userId: businessId, action: 'INSTRUMENT_REGISTERED', entityType: 'INSTRUMENT', entityId: created.id, newValue: { instrumentCode: created.instrumentCode, serialNumber: created.serialNumber } } });
            return created;
        });

        return res.status(201).json({
            success: true,
            message: 'Instrument registered successfully',
            instrument
        });
    } catch (error: any) {
        console.error("Registration Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 2. GET ALL INSTRUMENTS
export const getInstruments = async (req: AuthRequest, res: Response) => {
    try {
        const businessId = req.user?.id;
        if (!businessId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const instruments = await prisma.instrument.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json({
            success: true,
            instruments
        });
    } catch (error: any) {
        console.error("Error fetching instruments:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 3. GET ALL INSTRUMENTS (ONLY FOR ADMIN / INSPECTOR)
export const getAllInstruments = async (req: AuthRequest, res: Response) => {
    try {
        // TypeScript ko satisfy karne ke liye role check strict kar diya
        const role = req.user?.role;
        if (role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Sirf Inspector allowed hai bhai!' });
        }

        // Prisma query: Saare instruments utha latest pehle
        const instruments = await prisma.instrument.findMany({
            orderBy: { createdAt: 'desc' },
        });

        return res.status(200).json({ success: true, instruments });
    } catch (error: any) {
        console.error("Error fetching ALL instruments:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// 4. UPDATE INSTRUMENT STATUS (APPROVE / REJECT)
export const updateInstrumentStatus = async (req: AuthRequest, res: Response) => {
    try {
        // 👉 TS FIX: Isko force string banaya hai taaki "string | string[]" wala error dafa ho
        const id = req.params.id as string;
        // TS FIX: Prisma ke schema me VERIFIED hai, CERTIFIED nahi!
        const status = req.body.status as InstrumentStatus;
        if (!['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid instrument status.' });
        // Admin check
        const role = req.user?.role;
        if (role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Access Denied!' });
        }

        // Prisma se update maar
        const existing = await prisma.instrument.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, message: 'Instrument not found.' });
        const updatedInstrument = await prisma.$transaction(async (tx) => {
            const updated = await tx.instrument.update({ where: { id }, data: { status } });
            await tx.auditLog.create({ data: { userId: req.user!.id, action: 'INSTRUMENT_STATUS_CHANGED', entityType: 'INSTRUMENT', entityId: id, oldValue: { status: existing.status }, newValue: { status } } });
            return updated;
        });

        return res.status(200).json({
            success: true,
            message: `Instrument status updated to ${status}`,
            instrument: updatedInstrument
        });
    } catch (error: any) {
        console.error("Error updating status:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getInstrument = async (req: AuthRequest, res: Response) => {
    const instrument = await prisma.instrument.findUnique({ where: { id: req.params.id as string }, include: { applications: { orderBy: { createdAt: 'desc' }, include: { assignments: { select: { lmoId: true } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'asc' } }, certificate: true } } } });
    if (!instrument) return res.status(404).json({ success: false, message: 'Instrument not found.' });
    if (req.user!.role === 'BUSINESS' && instrument.businessId !== req.user!.id) return res.status(403).json({ success: false, message: 'You cannot access this instrument.' });
    if (req.user!.role === 'LMO' && !instrument.applications.some(application => application.assignments.some(assignment => assignment.lmoId === req.user!.id))) return res.status(403).json({ success: false, message: 'This instrument is not assigned to this officer.' });
    return res.json({ success: true, instrument });
};

export const updateInstrument = async (req: AuthRequest, res: Response) => {
    try {
        const id = req.params.id as string;
        const existing = await prisma.instrument.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ success: false, message: 'Instrument not found.' });
        if (req.user!.role === 'BUSINESS' && existing.businessId !== req.user!.id) return res.status(403).json({ success: false, message: 'You cannot update this instrument.' });

        const data: Record<string, unknown> = {};
        for (const field of ['type', 'manufacturer', 'model', 'serialNumber', 'capacity', 'unit', 'state', 'district', 'location'] as const) {
            if (field in req.body) data[field] = req.body[field] === '' && field === 'unit' ? null : req.body[field];
        }
        for (const field of ['previousVerificationDate', 'nextDueDate'] as const) {
            if (field in req.body) data[field] = req.body[field] ? new Date(req.body[field]) : null;
        }
        if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
            const duplicate = await prisma.instrument.findUnique({ where: { serialNumber: data.serialNumber as string } });
            if (duplicate) return res.status(409).json({ success: false, message: 'Instrument with this serial number already exists.' });
        }
        const updated = await prisma.$transaction(async tx => {
            const result = await tx.instrument.update({ where: { id }, data });
            await tx.auditLog.create({ data: { userId: req.user!.id, action: 'INSTRUMENT_UPDATED', entityType: 'INSTRUMENT', entityId: id, oldValue: { type: existing.type, manufacturer: existing.manufacturer, model: existing.model, serialNumber: existing.serialNumber, capacity: existing.capacity, unit: existing.unit, state: existing.state, district: existing.district, location: existing.location }, newValue: data as any } });
            return result;
        });
        return res.json({ success: true, instrument: updated });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Instrument update failed.' });
    }
};
