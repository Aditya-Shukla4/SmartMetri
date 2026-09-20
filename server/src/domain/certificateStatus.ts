export type EffectiveCertificateStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'REVOKED';

export const effectiveCertificateStatus = (
    storedStatus: string,
    validUntil: Date,
    now = new Date(),
    expiryWindowDays = 30
): EffectiveCertificateStatus => {
    if (storedStatus === 'REVOKED') return 'REVOKED';
    if (validUntil.getTime() <= now.getTime()) return 'EXPIRED';
    if (validUntil.getTime() < now.getTime() + expiryWindowDays * 86400000) return 'EXPIRING_SOON';
    return 'VALID';
};
