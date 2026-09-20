"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportController_1 = require("../controllers/reportController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/applications.csv', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), reportController_1.exportApplicationsCsv);
exports.default = router;
