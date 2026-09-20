"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicationController_1 = require("../controllers/applicationController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload"); // Import Multer middleware
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../validation/schemas");
const router = (0, express_1.Router)();
// Added upload.array('evidence', 5) to allow up to 5 images per application
router.post('/apply', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS']), upload_1.uploadEvidence.array('evidence', 5), (0, validate_1.validateBody)(schemas_1.applicationSchema), applicationController_1.createApplication);
router.post('/', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS']), upload_1.uploadEvidence.array('evidence', 5), (0, validate_1.validateBody)(schemas_1.applicationSchema), applicationController_1.createApplication);
router.get('/', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN', 'LMO']), applicationController_1.listApplications);
router.get('/:id', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN', 'LMO']), applicationController_1.getApplication);
router.patch('/:id/status', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), (0, validate_1.validateBody)(schemas_1.applicationStatusSchema), applicationController_1.updateApplicationStatus);
exports.default = router;
