import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationFor } from './policy.js';
const order = { buyerId: 'buyer', sellerId: 'seller', tokenNumber: 'SQ1', shopName: 'Stall', orderStatus: 'Preparing' };
test('only the actual buyer may announce a new Preparing order', () => {
  assert.equal(notificationFor(order, 'buyer', 'created').uid, 'seller');
  assert.throws(() => notificationFor(order, 'stranger', 'created'));
  assert.throws(() => notificationFor({ ...order, orderStatus: 'Cancelled' }, 'buyer', 'created'));
});
test('only assigned seller may notify buyer about a ready order', () => {
  assert.equal(notificationFor({ ...order, orderStatus: 'Ready for Pickup' }, 'seller', 'ready').uid, 'buyer');
  assert.throws(() => notificationFor(order, 'seller', 'ready'));
  assert.throws(() => notificationFor({ ...order, orderStatus: 'Ready for Pickup' }, 'buyer', 'ready'));
});
