import { Router } from 'express';
import { createChecklist, listChecklists } from '../controllers/checklistController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { checklistSchema } from '../validation/schemas';

const router = Router();
router.get('/', verifyToken, requireRole(['LMO', 'ADMIN']), listChecklists);
router.post('/', verifyToken, requireRole(['ADMIN']), validateBody(checklistSchema), createChecklist);
export default router;
