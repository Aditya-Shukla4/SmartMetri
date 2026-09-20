"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const errorHandler_1 = require("./middlewares/errorHandler");
const auth_1 = require("./middlewares/auth");
const instrumentRoutes_1 = __importDefault(require("./routes/instrumentRoutes"));
const applicationRoutes_1 = __importDefault(require("./routes/applicationRoutes"));
const assignmentRoutes_1 = __importDefault(require("./routes/assignmentRoutes"));
const inspectionRoutes_1 = __importDefault(require("./routes/inspectionRoutes"));
const certificateRoutes_1 = __importDefault(require("./routes/certificateRoutes"));
const publicRoutes_1 = __importDefault(require("./routes/publicRoutes"));
const auditRoutes_1 = __importDefault(require("./routes/auditRoutes"));
const checklistRoutes_1 = __importDefault(require("./routes/checklistRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const reportRoutes_1 = __importDefault(require("./routes/reportRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const syncRoutes_1 = __importDefault(require("./routes/syncRoutes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.disable('x-powered-by');
const allowedOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
// --- MIDDLEWARES ---
app.use((0, helmet_1.default)()); // Secures HTTP headers
app.use((0, cors_1.default)({ origin: (origin, callback) => {
        const localDevelopment = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;
        if (!origin || localDevelopment || allowedOrigins.includes(origin))
            return callback(null, true);
        return callback(new Error('Origin is not allowed by the server.'));
    } }));
app.use(express_1.default.json()); // Parses incoming JSON payloads
app.use(express_1.default.urlencoded({ extended: true }));
// --- HEALTH CHECK ROUTE ---
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'SIH Legal Metrology Core Engine is running! 🚀',
        timestamp: new Date().toISOString()
    });
});
app.get('/api/admin-only', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), (req, res) => {
    res.status(200).json({ success: true, message: 'Welcome Admin, your token and role are valid!' });
});
// --- API ROUTES (Hum aage yahan mount karenge) ---
// app.use('/api/auth', authRoutes);
// app.use('/api/applications', applicationRoutes);
// app.use('/api/inspections', inspectionRoutes);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/instruments', instrumentRoutes_1.default);
app.use('/api/applications', applicationRoutes_1.default);
app.use('/api/assignments', assignmentRoutes_1.default);
app.use('/api/inspections', inspectionRoutes_1.default);
app.use('/api/sync', syncRoutes_1.default);
app.use('/api/certificates', certificateRoutes_1.default);
app.use('/api/public', publicRoutes_1.default);
app.use('/api/admin/audit-logs', auditRoutes_1.default);
app.use('/api/checklists', checklistRoutes_1.default);
app.use('/api', dashboardRoutes_1.default);
app.use('/api/notifications', notificationRoutes_1.default);
app.use('/api/admin/reports', reportRoutes_1.default);
app.use('/api/admin/users', userRoutes_1.default);
// --- GLOBAL ERROR HANDLER ---
// Keep this after every route so async and validation errors are handled centrally.
app.use(errorHandler_1.errorHandler);
// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Engine ignited on http://localhost:${PORT}`);
});
