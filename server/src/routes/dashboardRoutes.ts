import { Router } from 'express';
import { adminDashboard, businessDashboard, lmoDashboard } from '../controllers/dashboardController';
import { verifyToken, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/admin/dashboard', verifyToken, requireRole(['ADMIN']), adminDashboard);
router.get('/business/dashboard', verifyToken, requireRole(['BUSINESS']), businessDashboard);
router.get('/lmo/dashboard', verifyToken, requireRole(['LMO']), lmoDashboard);
export default router;
