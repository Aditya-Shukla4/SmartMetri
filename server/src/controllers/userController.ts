import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

export const listUsers = async (req: AuthRequest, res: Response) => {
    const role = typeof req.query.role === 'string' && ['ADMIN', 'LMO', 'BUSINESS', 'GATC'].includes(req.query.role) ? req.query.role as 'ADMIN' | 'LMO' | 'BUSINESS' | 'GATC' : undefined;
    const users = await prisma.user.findMany({ where: role ? { role } : {}, select: { id: true, name: true, email: true, phone: true, role: true, stateId: true, districtId: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, users });
};

import bcrypt from 'bcryptjs';

export const createUser = async (req: AuthRequest, res: Response) => {
    try {
        const { name, email, password, role, phone, stateId, districtId } = req.body;
        
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({ success: false, message: 'Email already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
                role,
                phone,
                stateId,
                districtId
            }
        });

        await prisma.auditLog.create({
            data: {
                userId: req.user!.id,
                action: 'USER_CREATED',
                entityType: 'USER',
                entityId: newUser.id,
                newValue: { email: newUser.email, role: newUser.role }
            }
        });

        const { passwordHash: _, ...userWithoutPassword } = newUser;
        return res.status(201).json({ success: true, user: userWithoutPassword });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message || 'Failed to create user.' });
    }
};
