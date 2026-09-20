import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationSchema, instrumentUpdateSchema, loginSchema, syncSchema } from '../src/validation/schemas.js';

test('rejects weak login credentials', () => {
  assert.equal(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success, false);
});

test('rejects inspection sync without GPS/checklist data', () => {
  const result = syncSchema.safeParse({ clientSyncId: 'not-a-uuid', assignmentId: 'a', result: 'PASS', startedAt: 'bad', completedAt: 'bad', latitude: 999, longitude: 0 });
  assert.equal(result.success, false);
});

test('accepts verification and re-verification application types only', () => {
  assert.equal(applicationSchema.safeParse({ instrumentId: 'instrument-1', applicationType: 'VERIFICATION' }).success, true);
  assert.equal(applicationSchema.safeParse({ instrumentId: 'instrument-1', applicationType: 'REVERIFICATION' }).success, true);
  assert.equal(applicationSchema.safeParse({ instrumentId: 'instrument-1', applicationType: 'UNSUPPORTED' }).success, false);
});

test('allows partial instrument updates but rejects invalid dates', () => {
  assert.equal(instrumentUpdateSchema.safeParse({ unit: 'kg', nextDueDate: '2027-01-01T00:00:00.000Z' }).success, true);
  assert.equal(instrumentUpdateSchema.safeParse({ nextDueDate: 'not-a-date' }).success, false);
});
