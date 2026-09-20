import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveCertificateStatus } from '../src/domain/certificateStatus.js';

const now = new Date('2026-09-13T00:00:00.000Z');

test('reports valid certificates outside the expiry window', () => {
  assert.equal(effectiveCertificateStatus('VALID', new Date('2027-01-01T00:00:00.000Z'), now), 'VALID');
});

test('reports certificates expiring within the configured window', () => {
  assert.equal(effectiveCertificateStatus('VALID', new Date('2026-09-20T00:00:00.000Z'), now), 'EXPIRING_SOON');
});

test('reports expired certificates from their validity date', () => {
  assert.equal(effectiveCertificateStatus('VALID', new Date('2026-09-12T00:00:00.000Z'), now), 'EXPIRED');
});

test('treats the exact validity cutoff as expired', () => {
  assert.equal(effectiveCertificateStatus('VALID', now, now), 'EXPIRED');
});

test('revocation takes precedence over expiry', () => {
  assert.equal(effectiveCertificateStatus('REVOKED', new Date('2027-01-01T00:00:00.000Z'), now), 'REVOKED');
});
