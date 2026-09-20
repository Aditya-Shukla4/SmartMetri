import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/auth';
import { listUsers, createUser } from '../controllers/userController';
import { validateBody } from '../middlewares/validate';
import { createUserSchema } from '../validation/schemas';

const router = Router();
router.get('/', verifyToken, requireRole(['ADMIN']), listUsers);
router.post('/', verifyToken, requireRole(['ADMIN']), validateBody(createUserSchema), createUser);
export default router;
