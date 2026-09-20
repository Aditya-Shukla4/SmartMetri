"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectiveCertificateStatus = void 0;
const effectiveCertificateStatus = (storedStatus, validUntil, now = new Date(), expiryWindowDays = 30) => {
    if (storedStatus === 'REVOKED')
        return 'REVOKED';
    if (validUntil.getTime() <= now.getTime())
        return 'EXPIRED';
    if (validUntil.getTime() < now.getTime() + expiryWindowDays * 86400000)
        return 'EXPIRING_SOON';
    return 'VALID';
};
exports.effectiveCertificateStatus = effectiveCertificateStatus;
