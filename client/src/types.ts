export type Instrument = {
  id: string;
  instrumentCode: string;
  type: string;
  manufacturer: string;
  model: string;
  capacity: string;
  serialNumber: string;
  status: string;
  businessId: string;
};

export type InspectionEvidence = { id: string; fileUrl: string; evidenceType: string };
export type InspectionHistory = { result: 'PASS' | 'FAIL'; completedAt: string; evidence?: InspectionEvidence[] };
export type StatusHistory = { id: string; fromStatus?: string | null; toStatus: string; createdAt: string; changedBy?: { name?: string } | null };
export type ApplicationAssignment = { id: string; lmoId: string; scheduledDate: string };
export type Application = {
  id: string;
  applicationCode: string;
  instrumentId: string;
  instrument?: Instrument;
  businessId: string;
  business?: { id?: string; name?: string; email?: string };
  status: string;
  evidenceUrls?: string[];
  inspections?: InspectionHistory[];
  statusHistory?: StatusHistory[];
  assignments?: ApplicationAssignment[];
};

export type Certificate = { id: string; certificateCode: string; validUntil: string; status: string };
export type Notification = { id: string; title: string; message: string; readAt?: string | null; createdAt: string };
export type AuditLog = { id: string; action: string; createdAt: string; user?: { name?: string } };
export type DashboardMetrics = Record<string, number | undefined>;
export type LmoAssignment = {
  id: string;
  scheduledDate: string;
  application: {
    id: string; status: string; instrument: Instrument; business: { name: string }; inspections?: InspectionHistory[] 
};
};

export type ApiError = { response?: { data?: { message?: string } } };
export const apiErrorMessage = (error: unknown, fallback: string) => (error as ApiError).response?.data?.message || fallback;
