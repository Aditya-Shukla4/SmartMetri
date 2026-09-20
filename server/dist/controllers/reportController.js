"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportApplicationsCsv = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const exportApplicationsCsv = async (_req, res) => {
    const applications = await prisma_1.default.application.findMany({ include: { instrument: true, business: { select: { name: true, email: true } }, assignments: { include: { lmo: { select: { name: true } } }, orderBy: { scheduledDate: 'desc' }, take: 1 }, inspections: { orderBy: { completedAt: 'desc' }, take: 1 }, certificate: true }, orderBy: { createdAt: 'desc' } });
    const rows = [['application_code', 'status', 'business', 'business_email', 'instrument_code', 'serial_number', 'assigned_lmo', 'scheduled_date', 'latest_result', 'certificate_code', 'created_at'], ...applications.map(application => { const assignment = application.assignments?.[0]; return [application.applicationCode, application.status, application.business.name, application.business.email, application.instrument.instrumentCode, application.instrument.serialNumber, assignment?.lmo?.name || '', assignment?.scheduledDate?.toISOString() || '', application.inspections[0]?.result || '', application.certificate?.certificateCode || '', application.createdAt.toISOString()]; })];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="smartmetri-applications.csv"');
    return res.send(rows.map(row => row.map(csvCell).join(',')).join('\n'));
};
exports.exportApplicationsCsv = exportApplicationsCsv;
