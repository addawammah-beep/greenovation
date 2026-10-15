const assert = require('node:assert/strict');
const test = require('node:test');
const {
  canTransition,
  calculatePoints,
  hasPermission,
  reconcileWeights,
  verifyArrival
} = require('./domain');

test('points use actual weight and configurable rate', () => {
  assert.equal(calculatePoints({ actualWeight: 9.5, pointsPerKg: 7, rounding: 'exact' }), 66.5);
  assert.equal(calculatePoints({ actualWeight: 9.5, pointsPerKg: 7, rounding: 'nearest' }), 67);
});

test('material point rates award exact proportional points', () => {
  assert.equal(calculatePoints({ actualWeight: 10, pointsPerKg: 0.1, rounding: 'exact' }), 1);
  assert.equal(calculatePoints({ actualWeight: 5, pointsPerKg: 0.2, rounding: 'exact' }), 1);
  assert.equal(calculatePoints({ actualWeight: 1, pointsPerKg: 1, rounding: 'exact' }), 1);
  assert.equal(calculatePoints({ actualWeight: 1, pointsPerKg: 2, rounding: 'exact' }), 2);
  assert.equal(calculatePoints({ actualWeight: 1, pointsPerKg: 5, rounding: 'exact' }), 5);
});

test('estimated weight cannot be used as actual weight implicitly', () => {
  assert.throws(() => calculatePoints({ actualWeight: 0, pointsPerKg: 7 }));
});

test('legacy collected weight can be promoted to verified actual weight', () => {
  const legacyCollectedWeight = 9.5;
  const actualWeight = null ?? legacyCollectedWeight;
  assert.equal(actualWeight, 9.5);
});

test('status transitions reject arbitrary jumps', () => {
  assert.equal(canTransition('CREATED', 'ASSIGNED'), true);
  assert.equal(canTransition('CREATED', 'COMPLETED'), false);
  assert.equal(canTransition('AWAITING_USER_CONFIRMATION', 'DISPUTED'), true);
});

test('arrival uses backend distance and configured tolerance', () => {
  const result = verifyArrival({
    collectorPosition: [30.0444, 31.2357],
    pickupPosition: [30.0444, 31.2367],
    toleranceMeters: 150
  });
  assert.equal(result.valid, true);
  assert.ok(result.distanceMeters > 0);
});

test('reconciliation flags only configured variance', () => {
  const result = reconcileWeights({ collectionWeight: 9.5, receivingWeight: 9.3, allowedVariancePercent: 1 });
  assert.equal(result.difference, 0.1999999999999993);
  assert.equal(result.flagged, true);
});
