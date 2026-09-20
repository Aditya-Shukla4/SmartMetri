import { Router } from 'express';
import { getInspection, listInspections, startInspection, syncInspection } from '../controllers/inspectionController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { uploadEvidenceMemory } from '../middlewares/upload';

const router = Router();

// Only an LMO can submit an inspection report
router.post('/sync', verifyToken, requireRole(['LMO']), uploadEvidenceMemory.array('evidence', 5), syncInspection);
router.get('/', verifyToken, requireRole(['LMO']), listInspections);
router.get('/:id', verifyToken, requireRole(['LMO', 'ADMIN']), getInspection);
router.post('/:id/start', verifyToken, requireRole(['LMO']), startInspection);

export default router;
