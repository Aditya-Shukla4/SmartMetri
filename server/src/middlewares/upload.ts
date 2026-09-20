import multer from 'multer';
// Hum sirf single file accept karenge jiska field name 'evidence' hoga
export const uploadEvidence = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, WEBP, and PDF evidence files are allowed.'));
        cb(null, true);
    }
});

export const uploadEvidenceMemory = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype)) return cb(new Error('Only JPEG, PNG, WEBP, and PDF evidence files are allowed.'));
        cb(null, true);
    }
});
