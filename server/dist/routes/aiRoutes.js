"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const aiController_1 = require("../controllers/aiController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Only Admin or System can trigger AI processing
router.post('/process', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), aiController_1.processApplicationImage);
exports.default = router;
