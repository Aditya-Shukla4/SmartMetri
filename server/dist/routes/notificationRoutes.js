"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.verifyToken, notificationController_1.listNotifications);
router.patch('/:id/read', auth_1.verifyToken, notificationController_1.markNotificationRead);
exports.default = router;
