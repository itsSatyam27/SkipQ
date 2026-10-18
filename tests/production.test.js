const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/backendFixture.cjs');
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);

async function legacyUpiOrder(f, body = {}) {
  const order = await f.handlers.createOrder(f.buyer, { ...f.body(), ...body });
  const legacy = { ...f.store.get(`orders/${order.id}`), paymentMethod: 'UPI', paymentStatus: 'PENDING_MERCHANT_CONFIRMATION',
    advanceAmount: 0, advancePaymentStatus: 'NOT_REQUIRED', advanceRefundStatus: 'NOT_APPLICABLE', dueAtCounter: 0 };
  f.store.set(`orders/${order.id}`, legacy);
  return legacy;
}

test('new cash orders collect the full total at pickup with no advance; UPI is coming soon', async () => {
  const f = fixture();
  const order = await f.handlers.createOrder(f.buyer, { ...f.body(), totalAmount: 1, pickupPin: '0000' });
  assert.equal(order.totalAmount, 160); assert.equal(order.advanceAmount, 0); assert.equal(order.heldDepositAmount, 0); assert.equal(order.dueAtCounter, 160);
  assert.equal(order.advancePaymentStatus, 'NOT_REQUIRED'); assert.equal(order.advanceRefundStatus, 'NOT_APPLICABLE');
  assert.equal(order.paymentStatus, 'PENDING_CASH'); assert.notEqual(order.pickupPin, '0000');
  await rejects(f.handlers.createOrder(f.buyer, { ...f.body(), requestId: 'upi-coming-soon', paymentMethod: 'UPI' }), 400);
});
test('faculty staff-room delivery adds a server-priced five rupee fee', async () => {
  const f = fixture();
  f.store.get('users/buyer').userType = 'faculty';
  const order = await f.handlers.createOrder(f.buyer, { ...f.body(), staffRoomDelivery: true, facultyRoomNote: 'E Block - 501' });
  assert.equal(order.totalAmount, 165);
  assert.equal(order.advanceAmount, 0);
  assert.equal(order.dueAtCounter, 165);
  assert.equal(order.deliveryFee, 5);
  assert.equal(order.staffRoomDelivery, true);
  assert.equal(order.facultyRoomNote, 'E Block - 501');
  await rejects(f.handlers.createOrder(f.buyer, { ...f.body(), requestId: 'faculty_upi', paymentMethod: 'UPI', staffRoomDelivery: true, facultyRoomNote: 'E Block - 501' }), 400);
  const nonFaculty = fixture();
  await rejects(nonFaculty.handlers.createOrder(nonFaculty.buyer, { ...nonFaculty.body(), staffRoomDelivery: true, facultyRoomNote: 'E Block - 501' }), 403);
  const missingLocation = fixture();
  missingLocation.store.get('users/buyer').userType = 'faculty';
  await rejects(missingLocation.handlers.createOrder(missingLocation.buyer, { ...missingLocation.body(), staffRoomDelivery: true }), 400);
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
test('admin offboarding disables sign-in, preserves the profile and closes a seller canteen', async () => {
  const f = fixture();
  f.store.set('sellerRequests/seller', { userId: 'seller', status: 'APPROVED', stallName: 'Canteen', location: 'Block A', universityId: 'sou' });
  f.store.set('sellerApprovals/seller', { approved: true });
  const result = await f.http(f.handlers.api, '/admin/offboard-user',
    { userId: 'seller', reason: 'Seller left the university.', sellerAction: 'close' }, 'admin-token');
  assert.equal(result.code, 200);
  assert.equal(result.data.success, true);
  assert.equal(f.users.get('seller').disabled, true);
  assert.equal(f.store.get('users/seller').universityStatus, 'LEFT');
  assert.equal(f.store.get('users/seller').name, 'Seller');
  assert.equal(f.store.get('canteens/shop').status, 'Closed');
  assert.equal(f.store.get('sellerApprovals/seller').approved, false);
  assert.equal(f.store.get('sellerRequests/seller').status, 'LEFT_UNIVERSITY');
  assert.equal([...f.store.values()].filter(value => value.action === 'LEFT_UNIVERSITY').length, 1);
});
test('admin offboarding can transfer a seller canteen to an approved same-campus seller', async () => {
  const f = fixture();
  f.store.set('users/successor', { uid: 'successor', email: 'successor@example.com', userType: 'seller', profileComplete: true, banStatus: 'active', universityId: 'sou' });
  f.store.set('sellerApprovals/seller', { approved: true });
  f.store.set('sellerApprovals/successor', { approved: true });
  f.users.set('successor', { uid: 'successor', email: 'successor@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] });
  const result = await f.http(f.handlers.api, '/admin/offboard-user',
    { userId: 'seller', reason: 'Seller graduated.', sellerAction: 'transfer', successorUid: 'successor' }, 'admin-token');
  assert.equal(result.code, 200);
  assert.equal(f.users.get('seller').disabled, true);
  assert.equal(f.store.get('users/seller').universityStatus, 'LEFT');
  assert.equal(f.store.get('canteens/shop').ownerId, 'successor');
  assert.equal(f.store.get('canteens/shop').status, 'Open');
  assert.equal(f.store.get('users/successor').sellerShopId, 'shop');
});
test('offboarding rejects active orders and non-admin callers without changing data', async () => {
  const f = fixture();
  const activeOrder = { sellerId: 'seller', buyerId: 'buyer', orderStatus: 'Preparing' };
  f.store.set('orders/active', activeOrder);
  const denied = await f.http(f.handlers.api, '/admin/offboard-user',
    { userId: 'buyer', reason: 'Left university.' });
  assert.equal(denied.code, 403);
  const blocked = await f.http(f.handlers.api, '/admin/offboard-user',
    { userId: 'seller', reason: 'Left university.', sellerAction: 'close' }, 'admin-token');
  assert.equal(blocked.code, 409);
  assert.equal(f.users.get('seller').disabled, undefined);
  assert.equal(f.store.get('users/seller').universityStatus, undefined);
  assert.equal(f.store.get('canteens/shop').status, 'Open');
});
test('offboarded users cannot place new orders even with a valid existing token', async () => {
  const f = fixture();
  f.store.get('users/buyer').universityStatus = 'LEFT';
  await rejects(f.handlers.createOrder(f.buyer, f.body()), 409);
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
  await rejects(f.handlers.changeOrder(f.seller, '/confirm-payment', { orderId: order.id }), 400);
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
  const f = fixture(); const order = await legacyUpiOrder(f);
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  await rejects(f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin }), 409);
  await f.handlers.changeOrder(f.seller, '/confirm-payment', { orderId: order.id });
  assert.equal((await f.handlers.changeOrder(f.seller, '/verify-pickup', { orderId: order.id, pin: order.pickupPin })).order.orderStatus, 'Completed');
});
test('confirmed UPI cancellation requires merchant refund and cannot resurrect an order', async () => {
  const f = fixture(); const order = await legacyUpiOrder(f);
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
test('no-show requires 15 minutes ready, and retries create only one strike', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  await rejects(f.handlers.changeOrder(f.seller, '/abandon', { orderId: order.id }), 409);
  await f.handlers.changeOrder(f.seller, '/status', { orderId: order.id, status: 'Ready for Pickup' });
  f.advance(899999);
  await rejects(f.handlers.changeOrder(f.seller, '/abandon', { orderId: order.id }), 409);
  f.advance(1);
  const results = await Promise.all(Array.from({ length: 5 }, () => f.handlers.changeOrder(f.seller, '/abandon', { orderId: order.id })));
  assert.equal(f.store.get('users/buyer').unclaimedOrderCount, 1);
  assert.equal(results[0].order.advanceRefundStatus, 'NOT_APPLICABLE');
  assert.equal(results[0].order.refundAmount, 0);
});
test('cancelling an unpaid cash order does not require a payment refund', async () => {
  const f = fixture(); const order = await f.handlers.createOrder(f.buyer, f.body());
  const result = await f.handlers.changeOrder(f.seller, '/cancel', { orderId: order.id });
  assert.equal(result.order.refundStatus, 'NOT_REQUIRED');
  assert.equal(result.order.refundAmount, 0);
  assert.equal(result.order.advanceRefundStatus, 'NOT_REQUIRED');
});
test('unauthenticated and anonymous requests are rejected by the deployed HTTP handler', async () => {
  const f = fixture();
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), null)).code, 401);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), 'invalid')).code, 401);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), 'anonymous')).code, 403);
  assert.equal((await f.http(f.handlers.orders, '/create', f.body())).code, 200);
});
