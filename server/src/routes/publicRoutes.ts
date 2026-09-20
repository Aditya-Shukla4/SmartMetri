import { Router } from 'express';
import { verifyCertificate } from '../controllers/certificateController';

const router = Router();
router.get('/verify/:certificateNumber', verifyCertificate);
export default router;
