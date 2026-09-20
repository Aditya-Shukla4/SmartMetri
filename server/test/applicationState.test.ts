import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransition } from '../src/domain/applicationState.js';

test('allows the supported application lifecycle transitions', () => {
  assert.equal(canTransition('SUBMITTED', 'UNDER_REVIEW'), true);
  assert.equal(canTransition('UNDER_REVIEW', 'ASSIGNED'), true);
  assert.equal(canTransition('INSPECTION_IN_PROGRESS', 'PASSED'), true);
  assert.equal(canTransition('INSPECTION_IN_PROGRESS', 'REINSPECTION_REQUIRED'), true);
});

test('rejects arbitrary or backwards status changes', () => {
  assert.equal(canTransition('SUBMITTED', 'PASSED'), false);
  assert.equal(canTransition('CERTIFICATE_ISSUED', 'SUBMITTED'), false);
  assert.equal(canTransition('UNKNOWN', 'PASSED'), false);
});
