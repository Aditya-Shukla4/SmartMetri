import { Router } from 'express';
import {
    registerInstrument,
    getInstruments,
    getInstrument,
    getAllInstruments,
    updateInstrumentStatus,
    updateInstrument
} from '../controllers/instrumentController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { instrumentSchema, instrumentStatusSchema, instrumentUpdateSchema } from '../validation/schemas';

const router = Router();

// 👉 BUSINESS ROUTES
// 1. Apne khud ke kante dekhne ke liye (Dashboard pe kaam aayega)
router.get('/', verifyToken, getInstruments);

// 2. Naya kanta add karne ke liye (With Photo/Multer)
router.post(
    '/register',
    verifyToken,
    requireRole(['BUSINESS', 'ADMIN']), // Admin bhi add kar sakta hai zarurat padne pe
    validateBody(instrumentSchema),
    registerInstrument
);
router.post('/', verifyToken, requireRole(['BUSINESS', 'ADMIN']), validateBody(instrumentSchema), registerInstrument);


// 👉 ADMIN / INSPECTOR ROUTES
// 3. Saare businesses ke kante dekhne ke liye (Admin Dashboard)
router.get('/all', verifyToken, requireRole(['ADMIN']), getAllInstruments);
router.get('/:id', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), getInstrument);

// 4. Kante ko Approve ya Reject marne ke liye
router.patch('/:id/status', verifyToken, requireRole(['ADMIN']), validateBody(instrumentStatusSchema), updateInstrumentStatus);
router.patch('/:id', verifyToken, requireRole(['BUSINESS', 'ADMIN']), validateBody(instrumentUpdateSchema), updateInstrument);

export default router;
