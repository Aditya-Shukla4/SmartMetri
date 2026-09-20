"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadEvidenceMemory = exports.uploadEvidence = void 0;
const multer_1 = __importDefault(require("multer"));
// Hum sirf single file accept karenge jiska field name 'evidence' hoga
exports.uploadEvidence = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype))
            return cb(new Error('Only JPEG, PNG, WEBP, and PDF evidence files are allowed.'));
        cb(null, true);
    }
});
exports.uploadEvidenceMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (_req, file, cb) => {
        if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.mimetype))
            return cb(new Error('Only JPEG, PNG, WEBP, and PDF evidence files are allowed.'));
        cb(null, true);
    }
});
