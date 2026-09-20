"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const instrumentController_1 = require("../controllers/instrumentController");
const auth_1 = require("../middlewares/auth");
const validate_1 = require("../middlewares/validate");
const schemas_1 = require("../validation/schemas");
const router = (0, express_1.Router)();
// 👉 BUSINESS ROUTES
// 1. Apne khud ke kante dekhne ke liye (Dashboard pe kaam aayega)
router.get('/', auth_1.verifyToken, instrumentController_1.getInstruments);
// 2. Naya kanta add karne ke liye (With Photo/Multer)
router.post('/register', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN']), // Admin bhi add kar sakta hai zarurat padne pe
(0, validate_1.validateBody)(schemas_1.instrumentSchema), instrumentController_1.registerInstrument);
router.post('/', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN']), (0, validate_1.validateBody)(schemas_1.instrumentSchema), instrumentController_1.registerInstrument);
// 👉 ADMIN / INSPECTOR ROUTES
// 3. Saare businesses ke kante dekhne ke liye (Admin Dashboard)
router.get('/all', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), instrumentController_1.getAllInstruments);
router.get('/:id', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN', 'LMO']), instrumentController_1.getInstrument);
// 4. Kante ko Approve ya Reject marne ke liye
router.patch('/:id/status', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), (0, validate_1.validateBody)(schemas_1.instrumentStatusSchema), instrumentController_1.updateInstrumentStatus);
router.patch('/:id', auth_1.verifyToken, (0, auth_1.requireRole)(['BUSINESS', 'ADMIN']), (0, validate_1.validateBody)(schemas_1.instrumentUpdateSchema), instrumentController_1.updateInstrument);
exports.default = router;
