import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role, phone, stateId, districtId } = req.body;

        if (!name || typeof name !== 'string' || !email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Name, valid email, and password of at least 8 characters are required.' });
        }
        if (role !== 'BUSINESS') return res.status(403).json({ success: false, message: 'Public registration is only available for business accounts.' });

        // Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(409).json({ success: false, message: 'Email already registered.' });

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create User
        const user = await prisma.user.create({
            data: { name, email, passwordHash, role, phone, stateId, districtId }
        });

        res.status(201).json({ success: true, message: 'User registered successfully.' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }

        // Generate JWT
        if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(200).json({
            success: true,
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const me = async (req: AuthRequest, res: Response) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, name: true, email: true, role: true, phone: true, stateId: true, districtId: true } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user });
};

export const updateMe = async (req: AuthRequest, res: Response) => {
    const updated = await prisma.$transaction(async tx => {
        const user = await tx.user.update({ where: { id: req.user!.id }, data: { name: req.body.name, phone: req.body.phone || null, stateId: req.body.stateId || null, districtId: req.body.districtId || null }, select: { id: true, name: true, email: true, role: true, phone: true, stateId: true, districtId: true } });
        await tx.auditLog.create({ data: { userId: req.user!.id, action: 'PROFILE_UPDATED', entityType: 'USER', entityId: req.user!.id, newValue: { name: user.name, phone: user.phone, stateId: user.stateId, districtId: user.districtId } } });
        return user;
    });
    return res.json({ success: true, user: updated });
};
