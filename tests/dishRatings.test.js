const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aggregateDishRatings } = require('../src/utils/dishRatings.cjs');
test('dish averages count reviews, keep dishes separate and ignore invalid stars', () => {
  assert.deepEqual(aggregateDishRatings([{ ratings: { a: 5, b: 2 } }, { ratings: { a: 4, b: 0, c: 6 } }]), {
    a: { average: 4.5, count: 2 }, b: { average: 2, count: 1 }
  });
  assert.deepEqual(aggregateDishRatings([]), {});
  assert.deepEqual(aggregateDishRatings([{ratings:{a:3}}]), {a:{average:3,count:1}});
});
