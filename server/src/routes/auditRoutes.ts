import { Router } from 'express';
import { listAuditLogs } from '../controllers/auditController';
import { verifyToken, requireRole } from '../middlewares/auth';

const router = Router();
router.get('/', verifyToken, requireRole(['ADMIN']), listAuditLogs);
export default router;
