"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.me = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../utils/prisma"));
const register = async (req, res) => {
    try {
        const { name, email, password, role, phone, stateId, districtId } = req.body;
        if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Name, valid email, and password of at least 8 characters are required.' });
        }
        if (role !== 'BUSINESS')
            return res.status(403).json({ success: false, message: 'Public registration is only available for business accounts.' });
        // Check if user exists
        const existingUser = await prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        // Hash Password
        const salt = await bcryptjs_1.default.genSalt(10);
        const passwordHash = await bcryptjs_1.default.hash(password, salt);
        // Create User
        const user = await prisma_1.default.user.create({
            data: { name, email, passwordHash, role, phone, stateId, districtId }
        });
        res.status(201).json({ success: true, message: 'User registered successfully.' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
            return res.status(400).json({ success: false, message: 'Email and password are required.' });
        const user = await prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
        // Generate JWT
        if (!process.env.JWT_SECRET)
            return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });
        res.status(200).json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.login = login;
const me = async (req, res) => {
    const user = await prisma_1.default.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, role: true, phone: true, stateId: true, districtId: true } });
    if (!user)
        return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user });
};
exports.me = me;
const updateMe = async (req, res) => {
    const updated = await prisma_1.default.$transaction(async (tx) => {
        const user = await tx.user.update({ where: { id: req.user.id }, data: { name: req.body.name, phone: req.body.phone || null, stateId: req.body.stateId || null, districtId: req.body.districtId || null }, select: { id: true, name: true, email: true, role: true, phone: true, stateId: true, districtId: true } });
        await tx.auditLog.create({ data: { userId: req.user.id, action: 'PROFILE_UPDATED', entityType: 'USER', entityId: req.user.id, newValue: { name: user.name, phone: user.phone, stateId: user.stateId, districtId: user.districtId } } });
        return user;
    });
    return res.json({ success: true, user: updated });
};
exports.updateMe = updateMe;
