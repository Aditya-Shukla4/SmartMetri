"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const certificateController_1 = require("../controllers/certificateController");
const router = (0, express_1.Router)();
router.get('/verify/:certificateNumber', certificateController_1.verifyCertificate);
exports.default = router;
