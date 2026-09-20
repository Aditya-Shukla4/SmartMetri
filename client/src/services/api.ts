import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Core instance
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Token attach karne ke liye
apiClient.interceptors.request.use(
    (config) => {
        // Token ko localStorage se uthayenge
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Errors handle karne ke liye (e.g. Token expire)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            if (window.location.pathname !== '/login') window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Ye functions tere components directly use karenge
export const apiServices = {
    // Auth
    login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
    register: (data: { name: string; email: string; password: string; role: 'BUSINESS'; phone?: string }) => apiClient.post('/auth/register', data),

    // 👉 BUSINESS INSTRUMENTS
    getInstruments: () => apiClient.get('/instruments'),
    // Note: Axios automatically handles headers for FormData, so we don't strictly need to define multipart here
    registerInstrument: (data: { type: string; manufacturer: string; capacity: string; model: string; serialNumber: string; state: string; district: string; location: string; unit?: string; previousVerificationDate?: string; nextDueDate?: string }) => apiClient.post('/instruments', data),
    updateInstrument: (id: string, data: Partial<{ type: string; manufacturer: string; capacity: string; model: string; serialNumber: string; state: string; district: string; location: string; unit: string; previousVerificationDate: string; nextDueDate: string }>) => apiClient.patch(`/instruments/${id}`, data),

    // 👉 ADMIN / INSPECTOR INSTRUMENTS (YE NAYA ENGINE HAI)
    getAllInstruments: () => apiClient.get('/instruments/all'),
    updateInstrumentStatus: (id: string, status: string) => apiClient.patch(`/instruments/${id}/status`, { status }),
    getApplications: () => apiClient.get('/applications'),
    getApplication: (id: string) => apiClient.get(`/applications/${id}`),
    updateApplicationStatus: (id: string, status: string) => apiClient.patch(`/applications/${id}/status`, { status }),
    getAssignments: () => apiClient.get('/assignments'),
    getLMOs: () => apiClient.get('/assignments/lmos'),
    getUsers: (role?: string) => apiClient.get('/admin/users', { params: role ? { role } : undefined }),
    assignApplication: (applicationId: string, lmoId: string, scheduledDate: string) => apiClient.post('/assignments/assign', { applicationId, lmoId, scheduledDate }),
    updateAssignment: (id: string, data: { lmoId?: string; scheduledDate?: string }) => apiClient.patch(`/assignments/${id}`, data),
    syncInspection: (data: unknown) => apiClient.post('/inspections/sync', data),
    getSyncStatus: (clientSyncId: string) => apiClient.get('/sync/status', { params: { clientSyncId } }),
    getInspections: () => apiClient.get('/inspections'),
    getInspection: (id: string) => apiClient.get(`/inspections/${id}`),
    startInspection: (id: string) => apiClient.post(`/inspections/${id}/start`),
    getCertificates: () => apiClient.get('/certificates'),
    getCertificate: (id: string) => apiClient.get(`/certificates/${id}`),
    issueCertificate: (applicationId: string, validUntil: string) => apiClient.post(`/certificates/${applicationId}/issue`, { validUntil }),
    revokeCertificate: (id: string) => apiClient.patch(`/certificates/${id}/revoke`),
    getCertificatePdf: (id: string) => apiClient.get(`/certificates/${id}/pdf`, { responseType: 'blob' }),
    getCertificateQr: (id: string) => apiClient.get(`/certificates/${id}/qr`, { responseType: 'blob' }),
    getMe: () => apiClient.get('/auth/me'),
    updateMe: (data: { name: string; phone?: string; stateId?: string; districtId?: string }) => apiClient.patch('/auth/me', data),
    getAuditLogs: () => apiClient.get('/admin/audit-logs'),
    getChecklists: (instrumentType?: string) => apiClient.get('/checklists', { params: instrumentType ? { instrumentType } : undefined }),
    getBusinessDashboard: () => apiClient.get('/business/dashboard'),
    getAdminDashboard: () => apiClient.get('/admin/dashboard'),
    getLmoDashboard: () => apiClient.get('/lmo/dashboard'),
    getNotifications: () => apiClient.get('/notifications'),
    markNotificationRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    exportApplications: () => apiClient.get('/admin/reports/applications.csv', { responseType: 'blob' }),

    // Applications
    submitApplication: (data: FormData) => apiClient.post('/applications/apply', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};
