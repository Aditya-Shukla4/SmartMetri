"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const inspectionController_1 = require("../controllers/inspectionController");
const auth_1 = require("../middlewares/auth");
const upload_1 = require("../middlewares/upload");
const router = (0, express_1.Router)();
// Canonical offline synchronization contract. The legacy
// /api/inspections/sync route remains available for existing clients.
router.post('/inspections', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO']), upload_1.uploadEvidenceMemory.array('evidence', 5), inspectionController_1.syncInspection);
router.get('/status', auth_1.verifyToken, (0, auth_1.requireRole)(['LMO']), inspectionController_1.getSyncStatus);
exports.default = router;
