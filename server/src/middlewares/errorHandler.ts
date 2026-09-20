import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(`[Error] ${err.message}`);

    // Default to 500 server error if status code isn't set manually
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

    const message = process.env.NODE_ENV === 'production' && statusCode >= 500 ? 'Internal server error.' : err.message || 'Internal Server Error';
    res.status(statusCode).json({
        success: false,
        message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};
