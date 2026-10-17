const { test } = require('node:test');
const assert = require('node:assert/strict');
const { orderDate, prepLabel, prepMinutes, itemCountLabel } = require('../src/utils/orderDisplay.cjs');
test('order dates accept Firestore timestamps, serialized cache values, ISO and epoch dates', () => {
  const iso = '2026-10-16T10:00:00.000Z'; const ms = Date.parse(iso);
  for (const createdAt of [{toDate:()=>new Date(ms)}, {toMillis:()=>ms}, {seconds:ms/1000,nanoseconds:0}, {_seconds:ms/1000}, iso, ms]) assert.equal(orderDate({createdAt}).toISOString(),iso);
  assert.equal(orderDate({createdAt:{},timestamp:iso}).toISOString(),iso);
  assert.equal(orderDate({createdAt:'invalid'}),null);
  assert.equal(orderDate({}),null);
});
test('zero preparation time is ready to serve and counts use correct grammar', () => {
  for (const zero of [0,'0','0 mins']) { assert.equal(prepLabel(zero),'Ready to serve'); assert.equal(prepMinutes(zero),0); }
  assert.equal(prepLabel('1 min'),'1 min'); assert.equal(prepLabel('5 mins'),'5 mins');
  assert.equal(itemCountLabel(0),'0 items'); assert.equal(itemCountLabel(1),'1 item'); assert.equal(itemCountLabel(2),'2 items');
});
