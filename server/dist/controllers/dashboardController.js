"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lmoDashboard = exports.adminDashboard = exports.businessDashboard = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const certificateStatus_1 = require("../domain/certificateStatus");
const dayBounds = () => { const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1); return { gte: start, lt: end }; };
const businessDashboard = async (req, res) => {
    const [instruments, applications, assignments, certificates] = await Promise.all([
        prisma_1.default.instrument.count({ where: { businessId: req.user.id } }),
        prisma_1.default.application.groupBy({ by: ['status'], where: { businessId: req.user.id }, _count: true }),
        prisma_1.default.assignment.count({ where: { application: { businessId: req.user.id }, scheduledDate: { gte: new Date() } } }),
        prisma_1.default.certificate.findMany({ where: { application: { businessId: req.user.id } }, select: { status: true, validUntil: true } })
    ]);
    const now = new Date();
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const effectiveStatuses = certificates.map(c => (0, certificateStatus_1.effectiveCertificateStatus)(c.status, c.validUntil, now, expiryWindowDays));
    return res.json({ success: true, metrics: { totalInstruments: instruments, applicationsByStatus: applications, upcomingInspections: assignments, validCertificates: effectiveStatuses.filter(status => status === 'VALID').length, expiringCertificates: effectiveStatuses.filter(status => status === 'EXPIRING_SOON').length } });
};
exports.businessDashboard = businessDashboard;
const adminDashboard = async (_req, res) => {
    const [instruments, applications, todaysInspections, failed, reinspection, certificates, applicationStatuses] = await Promise.all([
        prisma_1.default.instrument.count(), prisma_1.default.application.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }), prisma_1.default.assignment.count({ where: { scheduledDate: dayBounds() } }), prisma_1.default.inspection.count({ where: { result: 'FAIL' } }), prisma_1.default.application.count({ where: { status: 'REINSPECTION_REQUIRED' } }), prisma_1.default.certificate.findMany({ select: { status: true, validUntil: true } }), prisma_1.default.application.groupBy({ by: ['status'], _count: true })
    ]);
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const expiringCertificates = certificates.filter(certificate => (0, certificateStatus_1.effectiveCertificateStatus)(certificate.status, certificate.validUntil, new Date(), expiryWindowDays) === 'EXPIRING_SOON').length;
    return res.json({ success: true, metrics: { totalInstruments: instruments, pendingApplications: applications, todaysInspections, failedInspections: failed, reinspectionCases: reinspection, expiringCertificates }, applicationStatuses });
};
exports.adminDashboard = adminDashboard;
const lmoDashboard = async (req, res) => {
    const [today, upcoming, pendingSync] = await Promise.all([
        prisma_1.default.assignment.count({ where: { lmoId: req.user.id, scheduledDate: dayBounds() } }),
        prisma_1.default.assignment.count({ where: { lmoId: req.user.id, scheduledDate: { gt: new Date() } } }),
        prisma_1.default.application.count({ where: { assignments: { some: { lmoId: req.user.id } }, status: 'INSPECTION_IN_PROGRESS' } })
    ]);
    return res.json({ success: true, metrics: { todaysInspections: today, upcomingInspections: upcoming, pendingSync } });
};
exports.lmoDashboard = lmoDashboard;
