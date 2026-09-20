import { Router } from 'express';
import { downloadCertificatePdf, getCertificate, getCertificateQr, issueCertificate, listCertificates, revokeCertificate } from '../controllers/certificateController';
import { verifyToken, requireRole } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { certificateIssueSchema } from '../validation/schemas';

const router = Router();
router.get('/', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), listCertificates);
router.get('/:id', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), getCertificate);
router.post('/:id/issue', verifyToken, requireRole(['ADMIN']), validateBody(certificateIssueSchema), issueCertificate);
router.patch('/:id/revoke', verifyToken, requireRole(['ADMIN']), revokeCertificate);
router.get('/:id/pdf', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), downloadCertificatePdf);
router.get('/:id/qr', verifyToken, requireRole(['BUSINESS', 'ADMIN', 'LMO']), getCertificateQr);
export default router;
