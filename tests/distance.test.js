const test = require('node:test');
const assert = require('node:assert/strict');
const { getDistanceInMeters, formatDistance, isWithinOrderingPerimeter, MAX_ORDER_DISTANCE_METERS } = require('../src/utils/distance');

test('Distance utility tests', async (t) => {
  await t.test('calculates 0 distance when identical coordinates are given', () => {
    const d = getDistanceInMeters(23.0917, 72.5349, 23.0917, 72.5349);
    assert.strictEqual(d, 0);
  });

  await t.test('calculates accurate distance between coordinates', () => {
    // Silver Oak University to nearby landmark ~100-300m
    const d = getDistanceInMeters(23.0917, 72.5349, 23.0930, 72.5360);
    assert.ok(d > 100 && d < 300, `Expected distance between 100 and 300, got ${d}`);
  });

  await t.test('formats distance correctly in meters and kilometers', () => {
    assert.strictEqual(formatDistance(250), '250m');
    assert.strictEqual(formatDistance(1200), '1.2 km');
  });

  await t.test('evaluates isWithinOrderingPerimeter with GPS drift tolerance', () => {
    assert.strictEqual(isWithinOrderingPerimeter(300), true);
    assert.strictEqual(isWithinOrderingPerimeter(500), true);
    // 530m with 40m GPS accuracy (530 - 40 = 490 <= 500) -> allowed
    assert.strictEqual(isWithinOrderingPerimeter(530, 40), true);
    // 700m even with 50m drift -> rejected
    assert.strictEqual(isWithinOrderingPerimeter(700, 50), false);
    // 1.1 km (1100m) -> strictly rejected
    assert.strictEqual(isWithinOrderingPerimeter(1100, 20), false);
    assert.strictEqual(isWithinOrderingPerimeter(1100, 50), false);
  });
});
