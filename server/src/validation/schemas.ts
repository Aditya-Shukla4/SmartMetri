import { z } from 'zod';

const nonEmpty = z.string().trim().min(1);
const isoDate = z.string().refine(value => !Number.isNaN(Date.parse(value)), 'Must be a valid date/time.');

export const registerSchema = z.object({ name: nonEmpty, email: z.email(), password: z.string().min(8), role: z.string().optional(), phone: z.string().optional(), stateId: z.string().optional(), districtId: z.string().optional() });
export const loginSchema = z.object({ email: z.email(), password: nonEmpty });
export const profileSchema = z.object({ name: nonEmpty, phone: z.string().trim().optional(), stateId: z.string().trim().optional(), districtId: z.string().trim().optional() });
export const instrumentSchema = z.object({ type: nonEmpty, manufacturer: nonEmpty, model: nonEmpty, serialNumber: nonEmpty, capacity: nonEmpty, unit: z.string().trim().optional(), state: nonEmpty, district: nonEmpty, location: nonEmpty, previousVerificationDate: isoDate.optional(), nextDueDate: isoDate.optional() });
export const instrumentUpdateSchema = instrumentSchema.partial();
export const instrumentStatusSchema = z.object({ status: z.enum(['VERIFIED', 'REJECTED', 'EXPIRED']) });
export const applicationSchema = z.object({ instrumentId: nonEmpty, applicationType: z.enum(['VERIFICATION', 'REVERIFICATION']).default('VERIFICATION'), remarks: z.string().optional() });
export const applicationStatusSchema = z.object({ status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'SCHEDULED', 'INSPECTION_IN_PROGRESS', 'REINSPECTION_REQUIRED', 'PASSED', 'FAILED', 'CERTIFICATE_ISSUED']) });
export const assignmentSchema = z.object({ applicationId: nonEmpty, lmoId: nonEmpty, scheduledDate: isoDate });
export const assignmentUpdateSchema = z.object({ lmoId: nonEmpty.optional(), scheduledDate: isoDate.optional() }).refine(value => value.lmoId || value.scheduledDate, 'At least one assignment field must be provided.');
export const syncSchema = z.object({ clientSyncId: z.uuid(), assignmentId: nonEmpty, result: z.enum(['PASS', 'FAIL']), remarks: z.string().optional(), failureReason: z.string().optional(), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), startedAt: isoDate, completedAt: isoDate, evidence: z.array(z.object({ evidenceType: z.string().optional(), fileUrl: z.string().optional(), fileHash: z.string().optional(), latitude: z.number().finite().optional(), longitude: z.number().finite().optional(), capturedAt: isoDate.optional() })).default([]), checklistResults: z.array(z.object({ checklistItemId: nonEmpty, observedValue: z.string().optional(), passed: z.boolean(), remarks: z.string().optional() })).min(1) });
export const certificateIssueSchema = z.object({ validUntil: isoDate });
export const checklistSchema = z.object({ name: nonEmpty, instrumentType: z.string().trim().optional(), items: z.array(z.object({ label: nonEmpty, expectedCondition: z.string().optional(), required: z.boolean().optional() })).min(1) });
export const syncStatusSchema = z.object({ clientSyncId: z.uuid() });
export const createUserSchema = z.object({ name: nonEmpty, email: z.email(), password: z.string().min(8), role: z.enum(['ADMIN', 'LMO', 'GATC']), phone: z.string().optional(), stateId: z.string().optional(), districtId: z.string().optional() });
