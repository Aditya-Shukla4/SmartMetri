"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBody = void 0;
const validateBody = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ success: false, message: 'Invalid request body.', errors: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) });
    req.body = parsed.data;
    next();
};
exports.validateBody = validateBody;
