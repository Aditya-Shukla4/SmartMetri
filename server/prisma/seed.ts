// @ts-nocheck
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('DemoPass!2026', 10);
  const admin = await prisma.user.upsert({ where: { email: 'admin@smartmetri.demo' }, update: {}, create: { name: 'SmartMetri Administrator', email: 'admin@smartmetri.demo', passwordHash, role: Role.ADMIN } });
  const lmo = await prisma.user.upsert({ where: { email: 'lmo@smartmetri.demo' }, update: {}, create: { name: 'Demo LMO Officer', email: 'lmo@smartmetri.demo', passwordHash, role: Role.LMO } });
  const business = await prisma.user.upsert({ where: { email: 'business@smartmetri.demo' }, update: {}, create: { name: 'Meerut Weighing Works', email: 'business@smartmetri.demo', passwordHash, role: Role.BUSINESS, stateId: 'UP', districtId: 'MEERUT' } });
  const instrument = await prisma.instrument.upsert({ where: { serialNumber: 'SM-DEMO-001' }, update: {}, create: { instrumentCode: 'INS-DEMO-001', type: 'Electronic Weighing Scale', manufacturer: 'Demo Instruments', model: 'DW-50', serialNumber: 'SM-DEMO-001', capacity: '50 kg', state: 'Uttar Pradesh', district: 'Meerut', location: 'Main Branch', businessId: business.id } });
  const application = await prisma.application.upsert({ where: { applicationCode: 'LM-APP-DEMO-001' }, update: { status: 'SCHEDULED' }, create: { applicationCode: 'LM-APP-DEMO-001', instrumentId: instrument.id, businessId: business.id, status: 'SCHEDULED', remarks: 'Synthetic demo record; not an official application.' } });
  const existingAssignment = await prisma.assignment.findFirst({ where: { applicationId: application.id, lmoId: lmo.id } });
  if (existingAssignment) await prisma.assignment.update({ where: { id: existingAssignment.id }, data: { scheduledDate: new Date(Date.now() + 86400000) } });
  else await prisma.assignment.create({ data: { applicationId: application.id, lmoId: lmo.id, scheduledDate: new Date(Date.now() + 86400000) } });
  const existingScheduleHistory = await prisma.applicationStatusHistory.findFirst({ where: { applicationId: application.id, toStatus: 'SCHEDULED' } });
  if (!existingScheduleHistory) await prisma.applicationStatusHistory.create({ data: { applicationId: application.id, fromStatus: 'UNDER_REVIEW', toStatus: 'SCHEDULED', changedById: admin.id, metadata: { seeded: true } } });
  const template = await prisma.checklistTemplate.findFirst({ where: { name: 'Demo general inspection' } });
  const activeTemplate = template || await prisma.checklistTemplate.create({ data: { name: 'Demo general inspection', instrumentType: 'Electronic Weighing Scale', items: { create: [{ label: 'Instrument identification is legible', expectedCondition: 'Officer records observed condition; no legal tolerance assumed.' }, { label: 'Seal/marking is present', expectedCondition: 'Officer records observed condition; departmental rule governs final decision.' }] } } });

  const demoItems = await prisma.checklistItem.findMany({ where: { templateId: activeTemplate.id }, orderBy: { createdAt: 'asc' } });
  const ensureInstrument = (serialNumber: string, instrumentCode: string, businessId: string) => prisma.instrument.upsert({ where: { serialNumber }, update: { businessId }, create: { instrumentCode, type: 'Electronic Weighing Scale', manufacturer: 'Demo Instruments', model: 'DW-50', serialNumber, capacity: '50 kg', unit: 'kg', state: 'Uttar Pradesh', district: 'Meerut', location: 'Synthetic demo site', businessId } });
  const ensurePassingCertificate = async (code: string, instrumentId: string, businessId: string, certificateCode: string, validUntil: Date, status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED') => {
    const application = await prisma.application.upsert({ where: { applicationCode: code }, update: { status: 'CERTIFICATE_ISSUED' }, create: { applicationCode: code, instrumentId, businessId, status: 'CERTIFICATE_ISSUED', applicationType: 'VERIFICATION', remarks: 'Synthetic demo record; not an official application.' } });
    const inspection = await prisma.inspection.upsert({ where: { clientSyncId: `seed-${code}` }, update: { result: 'PASS' }, create: { clientSyncId: `seed-${code}`, result: 'PASS', remarks: 'Synthetic demo inspection.', latitude: 28.9845, longitude: 77.7064, startedAt: new Date(Date.now() - 3600000), completedAt: new Date(Date.now() - 1800000), applicationId: application.id, lmoId: lmo.id } });
    for (const [index, item] of demoItems.entries()) {
      await prisma.inspectionChecklistResult.upsert({ where: { inspectionId_checklistItemId: { inspectionId: inspection.id, checklistItemId: item.id } }, update: { passed: true, observedValue: 'Synthetic demo observation.' }, create: { inspectionId: inspection.id, checklistItemId: item.id, passed: true, observedValue: 'Synthetic demo observation.' } });
      if (index === 0 && !(await prisma.evidence.findFirst({ where: { inspectionId: inspection.id, fileHash: 'demo-overview-hash' } }))) await prisma.evidence.create({ data: { evidenceType: 'instrument overview', fileUrl: 'https://storage.example.invalid/smartmetri-demo-overview.jpg', fileHash: 'demo-overview-hash', latitude: 28.9845, longitude: 77.7064, capturedAt: new Date(Date.now() - 1800000), inspectionId: inspection.id } });
    }
    const signature = process.env.JWT_SECRET ? crypto.createHmac('sha256', process.env.JWT_SECRET).update(certificateCode).digest('hex') : 'demo-signature-not-for-production';
    await prisma.certificate.upsert({ where: { certificateCode }, update: { status, validUntil }, create: { certificateCode, status, validUntil, qrSignature: signature, instrumentId, inspectionId: inspection.id, applicationId: application.id } });
    if (!(await prisma.applicationStatusHistory.findFirst({ where: { applicationId: application.id, toStatus: 'PASSED' } }))) await prisma.applicationStatusHistory.create({ data: { applicationId: application.id, toStatus: 'PASSED', changedById: lmo.id, metadata: { seeded: true } } });
    if (!(await prisma.applicationStatusHistory.findFirst({ where: { applicationId: application.id, toStatus: 'CERTIFICATE_ISSUED' } }))) await prisma.applicationStatusHistory.create({ data: { applicationId: application.id, fromStatus: 'PASSED', toStatus: 'CERTIFICATE_ISSUED', changedById: admin.id, metadata: { seeded: true, certificateCode } } });
    return application;
  };

  const lifecycleBusiness = await prisma.user.upsert({ where: { email: 'demo.lifecycle@smartmetri.demo' }, update: {}, create: { name: 'Demo Lifecycle Traders', email: 'demo.lifecycle@smartmetri.demo', passwordHash, role: Role.BUSINESS } });
  const validInstrument = await ensureInstrument('SM-DEMO-VALID', 'INS-DEMO-VALID', lifecycleBusiness.id);
  const expiringInstrument = await ensureInstrument('SM-DEMO-EXPIRING', 'INS-DEMO-EXPIRING', lifecycleBusiness.id);
  const expiredInstrument = await ensureInstrument('SM-DEMO-EXPIRED', 'INS-DEMO-EXPIRED', lifecycleBusiness.id);
  const revokedInstrument = await ensureInstrument('SM-DEMO-REVOKED', 'INS-DEMO-REVOKED', lifecycleBusiness.id);
  await ensurePassingCertificate('LM-APP-DEMO-VALID', validInstrument.id, lifecycleBusiness.id, 'SM-DEMO-VALID', new Date(Date.now() + 180 * 86400000), 'VALID');
  await ensurePassingCertificate('LM-APP-DEMO-EXPIRING', expiringInstrument.id, lifecycleBusiness.id, 'SM-DEMO-EXPIRING', new Date(Date.now() + 7 * 86400000), 'EXPIRING_SOON');
  await ensurePassingCertificate('LM-APP-DEMO-EXPIRED', expiredInstrument.id, lifecycleBusiness.id, 'SM-DEMO-EXPIRED', new Date(Date.now() - 7 * 86400000), 'EXPIRED');
  await ensurePassingCertificate('LM-APP-DEMO-REVOKED', revokedInstrument.id, lifecycleBusiness.id, 'SM-DEMO-REVOKED', new Date(Date.now() + 180 * 86400000), 'REVOKED');

  const failedInstrument = await ensureInstrument('SM-DEMO-FAILED', 'INS-DEMO-FAILED', business.id);
  const failedApplication = await prisma.application.upsert({ where: { applicationCode: 'LM-APP-DEMO-FAILED' }, update: { status: 'REINSPECTION_REQUIRED' }, create: { applicationCode: 'LM-APP-DEMO-FAILED', instrumentId: failedInstrument.id, businessId: business.id, status: 'REINSPECTION_REQUIRED', remarks: 'Synthetic failed inspection; not an official application.' } });
  const failedInspection = await prisma.inspection.upsert({ where: { clientSyncId: 'seed-LM-APP-DEMO-FAILED' }, update: { result: 'FAIL', failureReason: 'Synthetic failed condition for demonstration.' }, create: { clientSyncId: 'seed-LM-APP-DEMO-FAILED', result: 'FAIL', remarks: 'Synthetic failed inspection.', failureReason: 'Synthetic failed condition for demonstration.', latitude: 28.9845, longitude: 77.7064, startedAt: new Date(Date.now() - 7200000), completedAt: new Date(Date.now() - 5400000), applicationId: failedApplication.id, lmoId: lmo.id } });
  for (const [index, item] of demoItems.entries()) await prisma.inspectionChecklistResult.upsert({ where: { inspectionId_checklistItemId: { inspectionId: failedInspection.id, checklistItemId: item.id } }, update: { passed: index !== 0, observedValue: 'Synthetic demo observation.' }, create: { inspectionId: failedInspection.id, checklistItemId: item.id, passed: index !== 0, observedValue: 'Synthetic demo observation.' } });
  if (!(await prisma.evidence.findFirst({ where: { inspectionId: failedInspection.id, fileHash: 'demo-failure-hash' } }))) await prisma.evidence.create({ data: { evidenceType: 'observation', fileUrl: 'https://storage.example.invalid/smartmetri-demo-failure.jpg', fileHash: 'demo-failure-hash', latitude: 28.9845, longitude: 77.7064, capturedAt: new Date(Date.now() - 5400000), inspectionId: failedInspection.id } });
  if (!(await prisma.applicationStatusHistory.findFirst({ where: { applicationId: failedApplication.id, toStatus: 'REINSPECTION_REQUIRED' } }))) await prisma.applicationStatusHistory.create({ data: { applicationId: failedApplication.id, toStatus: 'REINSPECTION_REQUIRED', changedById: lmo.id, metadata: { seeded: true, result: 'FAIL' } } });
  await prisma.auditLog.create({ data: { userId: admin.id, action: 'DEMO_DATA_SEEDED', entityType: 'SYSTEM', entityId: 'smartmetri-demo', newValue: { business: business.email, lmo: lmo.email } } });
  console.log('SmartMetri demo data seeded. Demo password: DemoPass!2026');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
