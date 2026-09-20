import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { verifyToken, requireRole } from './middlewares/auth';
import instrumentRoutes from './routes/instrumentRoutes';
import applicationRoutes from './routes/applicationRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import inspectionRoutes from './routes/inspectionRoutes';
import certificateRoutes from './routes/certificateRoutes';
import publicRoutes from './routes/publicRoutes';
import auditRoutes from './routes/auditRoutes';
import checklistRoutes from './routes/checklistRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import reportRoutes from './routes/reportRoutes';
import userRoutes from './routes/userRoutes';
import syncRoutes from './routes/syncRoutes';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;
app.disable('x-powered-by');
const allowedOrigins = (process.env.CLIENT_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);

// --- MIDDLEWARES ---
app.use(helmet()); // Secures HTTP headers
app.use(cors({ origin: (origin, callback) => {
    const localDevelopment = process.env.NODE_ENV !== 'production' && allowedOrigins.length === 0;
    if (!origin || localDevelopment || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by the server.'));
} }));
app.use(express.json()); // Parses incoming JSON payloads
app.use(express.urlencoded({ extended: true }));

// --- HEALTH CHECK ROUTE ---
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
        success: true,
        message: 'SIH Legal Metrology Core Engine is running! 🚀',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/admin-only', verifyToken, requireRole(['ADMIN']), (req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Welcome Admin, your token and role are valid!' });
});

// --- API ROUTES (Hum aage yahan mount karenge) ---
// app.use('/api/auth', authRoutes);
// app.use('/api/applications', applicationRoutes);
// app.use('/api/inspections', inspectionRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin/audit-logs', auditRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/reports', reportRoutes);
app.use('/api/admin/users', userRoutes);

// --- GLOBAL ERROR HANDLER ---
// Keep this after every route so async and validation errors are handled centrally.
app.use(errorHandler);

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`[SERVER] 🚀 Engine ignited on http://localhost:${PORT}`);
});
