import { Router } from 'express';
import { createApplication, getApplication, listApplications, updateApplicationStatus } from '../controllers/applicationController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { uploadEvidence } from '../middlewares/upload'; // Import Multer middleware
import { validateBody } from '../middlewares/validate';
import { applicationSchema, applicationStatusSchema } from '../validation/schemas';

const router = Router();

// Added upload.array('evidence', 5) to allow up to 5 images per application
router.post('/apply', verifyToken, requireRole(['BUSINESS']), uploadEvidence.array('evidence', 5), validateBody(applicationSchema), createApplication);
router.post('/', verifyToken, requireRole(['BUSINESS']), uploadEvidence.array('evidence', 5), validateBody(applicationSchema), createApplication);
router.get('/', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), listApplications);
router.get('/:id', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), getApplication);
router.patch('/:id/status', verifyToken, requireRole(['ADMIN']), validateBody(applicationStatusSchema), updateApplicationStatus);

export default router;
