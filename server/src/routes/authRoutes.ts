import { Router } from 'express';
import { register, login, me, updateMe } from '../controllers/authController';
import { verifyToken } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { loginSchema, profileSchema, registerSchema } from '../validation/schemas';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.get('/me', verifyToken, me);
router.patch('/me', verifyToken, validateBody(profileSchema), updateMe);

export default router;
