import { Router } from 'express';
import { getSyncStatus, syncInspection } from '../controllers/inspectionController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { uploadEvidenceMemory } from '../middlewares/upload';

const router = Router();

// Canonical offline synchronization contract. The legacy
// /api/inspections/sync route remains available for existing clients.
router.post('/inspections', verifyToken, requireRole(['LMO']), uploadEvidenceMemory.array('evidence', 5), syncInspection);
router.get('/status', verifyToken, requireRole(['LMO']), getSyncStatus);

export default router;
