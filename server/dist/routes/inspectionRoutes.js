"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inspectionController_1 = require("../controllers/inspectionController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const router = (0, express_1.Router)();
// Only an LMO can submit an inspection report
router.post('/sync', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO']), upload_1.uploadEvidenceMemory.array('evidence', 5), inspectionController_1.syncInspection);
router.get('/', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO']), inspectionController_1.listInspections);
router.get('/:id', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO', 'ADMIN']), inspectionController_1.getInspection);
router.post('/:id/start', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO']), inspectionController_1.startInspection);
exports.default = router;
