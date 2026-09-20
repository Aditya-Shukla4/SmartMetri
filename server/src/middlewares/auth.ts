import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: { id: string; role: string };
}

// 1. Check if user is logged in
export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {

    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Access Denied. No token provided.' });
    }

    try {
        if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as { id: string; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }
};

// 2. Role Based Access Control (RBAC)
export const requireRole = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Forbidden. You do not have permission to access this.'
            });
        }
        next();
    };
};
