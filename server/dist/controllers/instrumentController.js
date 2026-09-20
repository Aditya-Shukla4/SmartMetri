"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateInstrument = exports.getInstrument = exports.updateInstrumentStatus = exports.getAllInstruments = exports.getInstruments = exports.registerInstrument = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const crypto_1 = __importDefault(require("crypto"));
// 1. REGISTER INSTRUMENT
const registerInstrument = async (req, res) => {
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
        const existingInstrument = await prisma_1.default.instrument.findUnique({
            where: { serialNumber }
        });
        if (existingInstrument) {
            return res.status(400).json({
                success: false,
                message: 'Instrument with this Serial Number already exists.'
            });
        }
        // Generate unique instrument code
        const shortHash = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
        const instrumentCode = `INS-${new Date().getFullYear()}-${shortHash}`;
        const instrument = await prisma_1.default.$transaction(async (tx) => {
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
    }
    catch (error) {
        console.error("Registration Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.registerInstrument = registerInstrument;
// 2. GET ALL INSTRUMENTS
const getInstruments = async (req, res) => {
    try {
        const businessId = req.user?.id;
        if (!businessId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const instruments = await prisma_1.default.instrument.findMany({
            where: { businessId },
            orderBy: { createdAt: 'desc' }
        });
        return res.status(200).json({
            success: true,
            instruments
        });
    }
    catch (error) {
        console.error("Error fetching instruments:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getInstruments = getInstruments;
// 3. GET ALL INSTRUMENTS (ONLY FOR ADMIN / INSPECTOR)
const getAllInstruments = async (req, res) => {
    try {
        // TypeScript ko satisfy karne ke liye role check strict kar diya
        const role = req.user?.role;
        if (role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Sirf Inspector allowed hai bhai!' });
        }
        // Prisma query: Saare instruments utha latest pehle
        const instruments = await prisma_1.default.instrument.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ success: true, instruments });
    }
    catch (error) {
        console.error("Error fetching ALL instruments:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAllInstruments = getAllInstruments;
// 4. UPDATE INSTRUMENT STATUS (APPROVE / REJECT)
const updateInstrumentStatus = async (req, res) => {
    try {
        // 👉 TS FIX: Isko force string banaya hai taaki "string | string[]" wala error dafa ho
        const id = req.params.id;
        // TS FIX: Prisma ke schema me VERIFIED hai, CERTIFIED nahi!
        const status = req.body.status;
        if (!['VERIFIED', 'REJECTED', 'EXPIRED'].includes(status))
            return res.status(400).json({ success: false, message: 'Invalid instrument status.' });
        // Admin check
        const role = req.user?.role;
        if (role !== 'ADMIN') {
            return res.status(403).json({ success: false, message: 'Access Denied!' });
        }
        // Prisma se update maar
        const existing = await prisma_1.default.instrument.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ success: false, message: 'Instrument not found.' });
        const updatedInstrument = await prisma_1.default.$transaction(async (tx) => {
            const updated = await tx.instrument.update({ where: { id }, data: { status } });
            await tx.auditLog.create({ data: { userId: req.user.id, action: 'INSTRUMENT_STATUS_CHANGED', entityType: 'INSTRUMENT', entityId: id, oldValue: { status: existing.status }, newValue: { status } } });
            return updated;
        });
        return res.status(200).json({
            success: true,
            message: `Instrument status updated to ${status}`,
            instrument: updatedInstrument
        });
    }
    catch (error) {
        console.error("Error updating status:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateInstrumentStatus = updateInstrumentStatus;
const getInstrument = async (req, res) => {
    const instrument = await prisma_1.default.instrument.findUnique({ where: { id: req.params.id }, include: { applications: { orderBy: { createdAt: 'desc' }, include: { assignments: { select: { lmoId: true } }, inspections: { include: { evidence: true }, orderBy: { createdAt: 'asc' } }, certificate: true } } } });
    if (!instrument)
        return res.status(404).json({ success: false, message: 'Instrument not found.' });
    if (req.user.role === 'BUSINESS' && instrument.businessId !== req.user.id)
        return res.status(403).json({ success: false, message: 'You cannot access this instrument.' });
    if (req.user.role === 'LMO' && !instrument.applications.some(application => application.assignments.some(assignment => assignment.lmoId === req.user.id)))
        return res.status(403).json({ success: false, message: 'This instrument is not assigned to this officer.' });
    return res.json({ success: true, instrument });
};
exports.getInstrument = getInstrument;
const updateInstrument = async (req, res) => {
    try {
        const id = req.params.id;
        const existing = await prisma_1.default.instrument.findUnique({ where: { id } });
        if (!existing)
            return res.status(404).json({ success: false, message: 'Instrument not found.' });
        if (req.user.role === 'BUSINESS' && existing.businessId !== req.user.id)
            return res.status(403).json({ success: false, message: 'You cannot update this instrument.' });
        const data = {};
        for (const field of ['type', 'manufacturer', 'model', 'serialNumber', 'capacity', 'unit', 'state', 'district', 'location']) {
            if (field in req.body)
                data[field] = req.body[field] === '' && field === 'unit' ? null : req.body[field];
        }
        for (const field of ['previousVerificationDate', 'nextDueDate']) {
            if (field in req.body)
                data[field] = req.body[field] ? new Date(req.body[field]) : null;
        }
        if (data.serialNumber && data.serialNumber !== existing.serialNumber) {
            const duplicate = await prisma_1.default.instrument.findUnique({ where: { serialNumber: data.serialNumber } });
            if (duplicate)
                return res.status(409).json({ success: false, message: 'Instrument with this serial number already exists.' });
        }
        const updated = await prisma_1.default.$transaction(async (tx) => {
            const result = await tx.instrument.update({ where: { id }, data });
            await tx.auditLog.create({ data: { userId: req.user.id, action: 'INSTRUMENT_UPDATED', entityType: 'INSTRUMENT', entityId: id, oldValue: { type: existing.type, manufacturer: existing.manufacturer, model: existing.model, serialNumber: existing.serialNumber, capacity: existing.capacity, unit: existing.unit, state: existing.state, district: existing.district, location: existing.location }, newValue: data } });
            return result;
        });
        return res.json({ success: true, instrument: updated });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Instrument update failed.' });
    }
};
exports.updateInstrument = updateInstrument;
