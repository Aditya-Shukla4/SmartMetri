"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const userController_1 = require("../controllers/userController");
const router = (0, express_1.Router)();
router.get('/', auth_1.verifyToken, (0, auth_1.requireRole)(['ADMIN']), userController_1.listUsers);
exports.default = router;
