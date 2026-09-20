import { Router } from 'express';
import { exportApplicationsCsv } from '../controllers/reportController';
import { verifyToken, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/applications.csv', verifyToken, requireRole(['ADMIN']), exportApplicationsCsv);
export default router;
