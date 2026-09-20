"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revokeCertificate = exports.downloadCertificatePdf = exports.getCertificateQr = exports.verifyCertificate = exports.getCertificate = exports.listCertificates = exports.issueCertificate = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const qrcode_1 = __importDefault(require("qrcode"));
const notifications_1 = require("../utils/notifications");
const certificateStatus_1 = require("../domain/certificateStatus");
const signingSecret = () => {
    if (!process.env.JWT_SECRET)
        throw new Error('Certificate signing is not configured.');
    return process.env.JWT_SECRET;
};
const signCertificate = (code) => crypto_1.default.createHmac('sha256', signingSecret()).update(code).digest('hex');
const publicVerificationUrl = (code) => `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/verify/${encodeURIComponent(code)}`;
const issueCertificate = async (req, res) => {
    try {
        const applicationId = req.params.id;
        const { validUntil } = req.body;
        if (!validUntil || Number.isNaN(Date.parse(validUntil)))
            return res.status(400).json({ success: false, message: 'A valid validUntil date is required. Configure this according to applicable departmental rules.' });
        if (!process.env.JWT_SECRET)
            return res.status(503).json({ success: false, message: 'Certificate signing is not configured.' });
        const application = await prisma_1.default.application.findUnique({ where: { id: applicationId }, include: { instrument: true, business: true, inspections: { where: { result: 'PASS' }, include: { evidence: true, checklistResults: true }, orderBy: { completedAt: 'desc' } }, certificate: true } });
        if (!application)
            return res.status(404).json({ success: false, message: 'Application not found.' });
        if (application.certificate)
            return res.status(409).json({ success: false, message: 'A certificate has already been issued for this application.', certificate: application.certificate });
        const inspection = application.inspections[0];
        if (!inspection || !['PASSED', 'CERTIFICATE_ISSUED'].includes(application.status))
            return res.status(400).json({ success: false, message: 'Only a passed application can receive a certificate.' });
        if (!inspection.evidence.length || !inspection.checklistResults.length || inspection.checklistResults.some(item => !item.passed))
            return res.status(400).json({ success: false, message: 'Certificate issuance requires a complete passing inspection with evidence and checklist results.' });
        if (new Date(validUntil) <= new Date())
            return res.status(400).json({ success: false, message: 'Certificate validUntil must be in the future.' });
        const certificateCode = `SM-${new Date().getFullYear()}-${crypto_1.default.randomBytes(4).toString('hex').toUpperCase()}`;
        const certificate = await prisma_1.default.$transaction(async (tx) => {
            const created = await tx.certificate.create({ data: { certificateCode, validUntil: new Date(validUntil), qrSignature: signCertificate(certificateCode), instrumentId: application.instrumentId, inspectionId: inspection.id, applicationId } });
            await tx.application.update({ where: { id: applicationId }, data: { status: 'CERTIFICATE_ISSUED' } });
            await tx.applicationStatusHistory.create({ data: { applicationId, fromStatus: application.status, toStatus: 'CERTIFICATE_ISSUED', changedById: req.user.id, metadata: { certificateId: created.id, certificateCode } } });
            await tx.auditLog.create({ data: { userId: req.user.id, action: 'CERTIFICATE_ISSUED', entityType: 'CERTIFICATE', entityId: created.id, newValue: { certificateCode, validUntil } } });
            await (0, notifications_1.createNotification)(tx, application.businessId, 'CERTIFICATE_ISSUED', 'Certificate issued', `Certificate ${created.certificateCode} is now available for download.`);
            return created;
        });
        return res.status(201).json({ success: true, certificate });
    }
    catch (error) {
        return res.status(500).json({ success: false, message: error.message || 'Certificate issuance failed.' });
    }
};
exports.issueCertificate = issueCertificate;
const listCertificates = async (req, res) => {
    const where = req.user?.role === 'BUSINESS' ? { application: { businessId: req.user.id } } : req.user?.role === 'LMO' ? { inspection: { lmoId: req.user.id } } : {};
    const certificates = await prisma_1.default.certificate.findMany({ where, include: { instrument: true, application: { select: { businessId: true } } }, orderBy: { validUntil: 'asc' } });
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const now = new Date();
    const responseCertificates = certificates.map(certificate => ({ ...certificate, status: (0, certificateStatus_1.effectiveCertificateStatus)(certificate.status, certificate.validUntil, now, expiryWindowDays) }));
    for (const certificate of responseCertificates) {
        if (certificate.status !== 'EXPIRING_SOON' && certificate.status !== 'EXPIRED')
            continue;
        const type = certificate.status === 'EXPIRING_SOON' ? 'CERTIFICATE_EXPIRING' : 'CERTIFICATE_EXPIRED';
        const title = certificate.status === 'EXPIRING_SOON' ? 'Certificate expiring soon' : 'Certificate expired';
        const message = `Certificate ${certificate.certificateCode} is ${certificate.status === 'EXPIRING_SOON' ? 'approaching expiry' : 'expired'}.`;
        const existingNotification = await prisma_1.default.notification.findFirst({ where: { userId: certificate.application.businessId, type, message } });
        if (!existingNotification)
            await prisma_1.default.notification.create({ data: { userId: certificate.application.businessId, type, title, message } });
    }
    return res.json({ success: true, certificates: responseCertificates });
};
exports.listCertificates = listCertificates;
const getCertificate = async (req, res) => {
    const certificate = await getCertificateForUser(req);
    if (!certificate)
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (req.user.role === 'BUSINESS' && certificate.application.business.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'You cannot access this certificate.' });
    if (req.user.role === 'LMO' && certificate.inspection.lmo.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'This certificate is not associated with your inspection.' });
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    return res.json({ success: true, certificate: { ...certificate, status: (0, certificateStatus_1.effectiveCertificateStatus)(certificate.status, certificate.validUntil, new Date(), expiryWindowDays) } });
};
exports.getCertificate = getCertificate;
const verifyCertificate = async (req, res) => {
    const certificate = await prisma_1.default.certificate.findUnique({ where: { certificateCode: req.params.certificateNumber }, include: { instrument: true, application: { include: { business: { select: { name: true } } } } } });
    if (!certificate)
        return res.status(404).json({ success: true, status: 'INVALID', message: 'Certificate not found.' });
    const signatureValid = certificate.qrSignature === signCertificate(certificate.certificateCode);
    const status = certificate.status === 'REVOKED' ? 'REVOKED' : !signatureValid ? 'INVALID' : new Date(certificate.validUntil) <= new Date() ? 'EXPIRED' : 'VALID';
    return res.json({ success: true, status, certificate: { certificateNumber: certificate.certificateCode, businessName: certificate.application.business.name, instrumentType: certificate.instrument.type, manufacturer: certificate.instrument.manufacturer, model: certificate.instrument.model, serialNumber: certificate.instrument.serialNumber.slice(-4).padStart(certificate.instrument.serialNumber.length, '*'), verificationDate: certificate.issueDate, validUntil: certificate.validUntil } });
};
exports.verifyCertificate = verifyCertificate;
const getCertificateForUser = async (req) => prisma_1.default.certificate.findUnique({ where: { id: req.params.id }, include: { instrument: true, application: { include: { business: { select: { id: true, name: true } } } }, inspection: { include: { lmo: { select: { id: true, name: true } } } } } });
const getCertificateQr = async (req, res) => {
    const certificate = await getCertificateForUser(req);
    if (!certificate)
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (req.user.role === 'BUSINESS' && certificate.application.business.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'You cannot access this certificate.' });
    if (req.user.role === 'LMO' && certificate.inspection.lmo.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'This certificate is not associated with your inspection.' });
    const png = await qrcode_1.default.toBuffer(publicVerificationUrl(certificate.certificateCode), { errorCorrectionLevel: 'M', margin: 2, width: 360 });
    res.type('png').send(png);
};
exports.getCertificateQr = getCertificateQr;
const downloadCertificatePdf = async (req, res) => {
    const certificate = await getCertificateForUser(req);
    if (!certificate)
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (req.user.role === 'BUSINESS' && certificate.application.business.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'You cannot access this certificate.' });
    if (req.user.role === 'LMO' && certificate.inspection.lmo.id !== req.user.id)
        return res.status(403).json({ success: false, message: 'This certificate is not associated with your inspection.' });
    const qrDataUrl = await qrcode_1.default.toDataURL(publicVerificationUrl(certificate.certificateCode), { errorCorrectionLevel: 'M', margin: 2, width: 240 });
    const doc = new pdfkit_1.default({ size: 'A4', margin: 56 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.certificateCode}.pdf"`);
    doc.pipe(res);
    doc.fontSize(22).font('Helvetica-Bold').text('SMARTMETRI', { align: 'center' });
    doc.fontSize(11).font('Helvetica').text('Digital Verification Certificate', { align: 'center' });
    doc.moveDown(2).fontSize(12).font('Helvetica-Bold').text(`Certificate Number: ${certificate.certificateCode}`);
    doc.moveDown().font('Helvetica').text(`Business: ${certificate.application.business.name}`);
    doc.text(`Instrument: ${certificate.instrument.type}`);
    doc.text(`Manufacturer / Model: ${certificate.instrument.manufacturer} / ${certificate.instrument.model}`);
    doc.text(`Serial Number: ${certificate.instrument.serialNumber}`);
    doc.text(`Verification Date: ${certificate.issueDate.toISOString().slice(0, 10)}`);
    doc.text(`Valid Until: ${certificate.validUntil.toISOString().slice(0, 10)}`);
    doc.text(`Inspecting Officer: ${certificate.inspection.lmo.name}`);
    const expiryWindowDays = Number(process.env.CERTIFICATE_EXPIRING_SOON_DAYS || 30);
    const currentStatus = (0, certificateStatus_1.effectiveCertificateStatus)(certificate.status, certificate.validUntil, new Date(), expiryWindowDays);
    doc.moveDown().font('Helvetica-Bold').text(`Status: ${currentStatus}`);
    doc.image(Buffer.from(qrDataUrl.split(',')[1], 'base64'), 360, 420, { width: 150 });
    doc.fontSize(9).font('Helvetica').text('Scan to verify current status on the SmartMetri server.', 360, 580, { width: 170, align: 'center' });
    doc.end();
};
exports.downloadCertificatePdf = downloadCertificatePdf;
const revokeCertificate = async (req, res) => {
    const certificate = await prisma_1.default.certificate.findUnique({ where: { id: req.params.id } });
    if (!certificate)
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (certificate.status === 'REVOKED')
        return res.status(409).json({ success: false, message: 'Certificate is already revoked.' });
    const updated = await prisma_1.default.$transaction(async (tx) => {
        const result = await tx.certificate.update({ where: { id: certificate.id }, data: { status: 'REVOKED' } });
        await tx.auditLog.create({ data: { userId: req.user.id, action: 'CERTIFICATE_REVOKED', entityType: 'CERTIFICATE', entityId: certificate.id, oldValue: { status: certificate.status }, newValue: { status: 'REVOKED' } } });
        return result;
    });
    return res.json({ success: true, certificate: updated });
};
exports.revokeCertificate = revokeCertificate;
