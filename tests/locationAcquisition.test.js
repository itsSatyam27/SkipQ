const { test } = require('node:test');
const assert = require('node:assert/strict');
const { acquireAccuratePosition } = require('../src/services/locationAcquisition.cjs');
const fix = accuracy => ({ coords: { latitude: 23, longitude: 72, accuracy }, timestamp: Date.now() });
test('approximate first fix can improve without the user restarting GPS', async () => {
  let removed = 0;
  const result = await acquireAccuratePosition(update => {
    update(fix(900)); update(fix(15));
    return { remove() { removed++; } };
  }, 100);
  await Promise.resolve();
  assert.equal(result.accuracy, 15); assert.equal(removed, 1);
});
test('GPS acquisition never authorizes a low accuracy fix', async () => {
  let removed = 0;
  await assert.rejects(acquireAccuratePosition(update => {
    update(fix(500)); return { remove() { removed++; } };
  }, 10), { code: 'LOW_ACCURACY' });
  assert.equal(removed, 1);
});
test('permission denial ends acquisition and removes a late subscription', async () => {
  let removed = 0;
  await assert.rejects(acquireAccuratePosition(async (_update, fail) => {
    fail(Object.assign(new Error('Denied'), { code: 'PERMISSION_DENIED' }));
    return { remove() { removed++; } };
  }, 100), { code: 'PERMISSION_DENIED' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(removed, 1);
});
test('GPS errors and silence remain bounded', async () => {
  await assert.rejects(acquireAccuratePosition(() => ({ remove() {} }), 10), { code: 'LOCATION_TIMEOUT' });
});
