import { Router } from 'express';
import { listNotifications, markNotificationRead } from '../controllers/notificationController';
import { verifyToken } from '../middlewares/auth';

const router = Router();
router.get('/', verifyToken, listNotifications);
router.patch('/:id/read', verifyToken, markNotificationRead);
export default router;
