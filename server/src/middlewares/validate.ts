import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateBody = (schema: z.ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid request body.', errors: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) });
    req.body = parsed.data;
    next();
};
