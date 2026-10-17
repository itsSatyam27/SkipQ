const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePosition, isUsableLocation } = require('../src/services/locationPolicy.cjs');
const { getDistanceInMeters, isWithinOrderingPerimeter } = require('../src/utils/distance');
const now = 1000000;
const position = (coords = {}, timestamp = now) => ({ coords: { latitude: 23.0917, longitude: 72.5349, accuracy: 10, ...coords }, timestamp });
test('valid precise GPS is normalized and fresh; zero coordinates are real positions', () => {
  assert.equal(isUsableLocation(normalizePosition(position(), now), now), true);
  assert.equal(normalizePosition(position({ latitude: 0, longitude: 0 }), now).lat, 0);
  assert.ok(getDistanceInMeters(0, 0, 23, 72) > 1000000);
});
test('stale, missing and low-accuracy GPS cannot authorize ordering', () => {
  assert.throws(() => normalizePosition(position({ accuracy: 500 }), now), { code: 'LOW_ACCURACY' });
  assert.throws(() => normalizePosition(position({}, now - 120001), now), { code: 'STALE_LOCATION' });
  assert.throws(() => normalizePosition(position({ latitude: NaN }), now), { code: 'INVALID_LOCATION' });
  assert.equal(isUsableLocation({ lat: 23, lng: 72, accuracy: 10 }, now), false);
  assert.equal(isWithinOrderingPerimeter(Infinity, 10), false);
  assert.equal(isWithinOrderingPerimeter(100, 500), false);
});
