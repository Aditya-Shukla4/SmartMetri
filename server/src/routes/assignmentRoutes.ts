import { Router } from 'express';
import { assignApplication, listAssignments, listLMOs, updateAssignment } from '../controllers/assignmentController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { assignmentSchema, assignmentUpdateSchema } from '../validation/schemas';

const router = Router();

router.post('/assign', verifyToken, requireRole(['ADMIN']), validateBody(assignmentSchema), assignApplication);
router.get('/lmos', verifyToken, requireRole(['ADMIN']), listLMOs);
router.patch('/:id', verifyToken, requireRole(['ADMIN']), validateBody(assignmentUpdateSchema), updateAssignment);
router.get('/', verifyToken, requireRole(['ADMIN', 'LMO']), listAssignments);

export default router;
