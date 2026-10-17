const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/backendFixture.cjs');
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);

test('cash order uses server prices and collects no wallet deposit', async () => {
  const f = fixture();
  const order = await f.handlers.createOrder(f.buyer, { ...f.body(), totalAmount: 1, pickupPin: '0000' });
  assert.equal(order.totalAmount, 160); assert.equal(order.heldDepositAmount, 0); assert.equal(order.dueAtCounter, 160);
  assert.equal(order.paymentStatus, 'PENDING_CASH'); assert.notEqual(order.pickupPin, '0000');
});
test('concurrent checkout retries produce one order', async () => {
  const f = fixture();
  const orders = await Promise.all(Array.from({ length: 8 }, () => f.handlers.createOrder(f.buyer, f.body())));
  assert.equal(new Set(orders.map(order => order.id)).size, 1);
  assert.equal([...f.store.keys()].filter(key => key.startsWith('orders/')).length, 1);
});
test('reusing a request ID with a different cart is rejected', async () => {
  const f = fixture(); await f.handlers.createOrder(f.buyer, f.body());
  await rejects(f.handlers.createOrder(f.buyer, { ...f.body(), items: [{ id: 'dish', qty: 1 }] }), 409);
});
test('rejects duplicate dishes, unavailable dishes, invalid prices and quantities', async () => {
  for (const items of [[{ id: 'dish', qty: 1 }, { id: 'dish', qty: 1 }], [{ id: 'missing', qty: 1 }], [{ id: 'dish', qty: -1 }], [{ id: 'dish', qty: 1.5 }]]) {
    const f = fixture(); await assert.rejects(f.handlers.createOrder(f.buyer, { ...f.body(), items }));
  }
  const f = fixture(); f.store.get('canteens/shop').menu[0].price = NaN;
  await rejects(f.handlers.createOrder(f.buyer, f.body()), 409);
});
test('rejects wallet payment, unapproved seller, off-campus location and bans', async () => {
  const f = fixture(); await rejects(f.handlers.createOrder(f.buyer, { ...f.body(), paymentMethod: 'Wallet' }), 400);
  await rejects(f.handlers.createOrder(f.buyer, { ...f.body(), location: { lat: 24, lng: 72, accuracy: 10 } }), 403);
  f.users.get('seller').customClaims.seller = false; await rejects(f.handlers.createOrder(f.buyer, f.body()), 409);
  f.users.get('seller').customClaims.seller = true; f.store.get('users/buyer').banStatus = 'perm_ban';
  await rejects(f.handlers.createOrder(f.buyer, f.body()), 403);
});
test('only the assigned approved seller can change status', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await rejects(f.handlers.changeOrder(f.buyer, '/status', { orderId: order.id, status: 'Ready for Pickup' }), 403);
  await rejects(f.handlers.changeOrder({ uid: 'seller' }, '/status', { orderId: order.id, status: 'Ready for Pickup' }), 403);
  await rejects(f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Completed' }), 400);
});
test('pickup requires readiness and the customer PIN; retries do not duplicate completion', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin }), 409);
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: '0000' }), 401);
  const outcomes = await Promise.all(Array.from({ length: 4 }, () => f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin })));
  assert.ok(outcomes.every(result => result.order.orderStatus === 'Completed'));
  assert.equal(outcomes[0].order.paymentStatus, 'CASH_COLLECTED');
});
test('five failed PIN attempts lock pickup temporarily', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  for (let i = 0; i < 5; i++) await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: '0000' }), 401);
  await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin }), 429);
  f.advance(300001); assert.equal((await f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin })).order.orderStatus, 'Completed');
});
test('UPI pickup waits for seller payment confirmation', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, { ...f.body(), paymentMethod: 'UPI' });
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin }), 409);
  await f.handlers.changeOrder(f.seller, '/confirm-payment', { orderId: order.id });
  assert.equal((await f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin })).order.orderStatus, 'Completed');
});
test('confirmed UPI cancellation requires merchant refund and cannot resurrect an order', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, { ...f.body(), paymentMethod: 'UPI' });
  await f.handlers.changeOrder(f.seller, '/confirm-payment', { orderId: order.id });
  const result = await f.handlers.changeOrder(f.buyer, '/cancel', { orderId: order.id });
  assert.equal(result.order.refundStatus, 'MERCHANT_REFUND_REQUIRED'); assert.equal(result.order.refundAmount, 160);
  assert.match(result.order.refundText, /does not transfer/);
  await rejects(f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' }), 409);
});
test('concurrent pickup and cancellation yield one terminal state', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  const results = await Promise.allSettled([f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin }), f.handlers.changeOrder(f.buyer, '/cancel', { orderId: order.id })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
});
test('no-show cannot be applied early, and retries create only one strike', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await rejects(f.handlers.changeOrder(f.seller, '/abandon', { orderId: order.id }), 409);
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  f.advance(2700001);
  await Promise.all(Array.from({ length: 5 }, () => f.handlers.changeOrder(f.seller, '/abandon', { orderId: order.id })));
  assert.equal(f.store.get('users/buyer').unclaimedOrderCount, 1);
});
test('unauthenticated and anonymous requests are rejected by the deployed HTTP handler', async () => {
  const f = fixture();
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), null)).code, 401);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), 'invalid')).code, 401);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), 'anonymous')).code, 403);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body())).code, 200);
});
