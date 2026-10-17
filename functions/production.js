const crypto = require('node:crypto');
const { createAccounts, complete, normalizeEmail } = require('./accounts');
const { createGoogleBridge } = require('./googleBridge');

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const text = (value, length = 300) => String(value || '').trim().slice(0, length);
const millis = value => value?.toMillis?.() || 0;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const ACTIVE = ['Preparing', 'Ready for Pickup'];

// Dependency injection lets the tests exercise the same handlers deployed to Firebase.
function createHandlers({ db, auth, Timestamp, now = Date.now }) {
  const stamp = () => Timestamp.fromMillis(now());
  const accounts = createAccounts({ db, Timestamp, now });
  const bridge = createGoogleBridge({ db, auth, Timestamp, now });
  async function authenticate(req) {
    const match = /^Bearer (\S+)$/.exec(req.get('authorization') || '');
    if (!match) fail(401, 'Sign in is required.');
    let user;
    try { user = await auth.verifyIdToken(match[1], true); } catch { fail(401, 'Sign in again to continue.'); }
    if (user.email_verified !== true || !user.email || (user.firebase?.sign_in_provider !== 'google.com' && user.googleVerified !== true)) fail(403, 'Sign in with your verified Google account to continue.');
    return user;
  }
  function seller(user, order) {
    if (user.seller !== true || order.sellerId !== user.uid) fail(403, 'Only the approved seller assigned to this order can do this.');
  }
  function available(order) {
    if (!ACTIVE.includes(order.orderStatus)) fail(409, 'This order is already closed.');
  }
  function refund(order) {
    return order.paymentMethod === 'UPI' && order.paymentStatus === 'CONFIRMED_BY_MERCHANT'
      ? { refundStatus: 'MERCHANT_REFUND_REQUIRED', refundAmount: order.totalAmount, refundText: 'Contact the canteen for your UPI refund. The app does not transfer refunds.' }
      : { refundStatus: 'NOT_REQUIRED', refundAmount: 0, refundText: 'Order cancelled. No payment was collected by SkipQ.' };
  }
  async function api(req) {
    if (req.path === '/auth/start-mobile-login') return bridge.start(req.ip);
    if (req.path === '/auth/claim-mobile-login') return bridge.claim(req.body || {});
    const user = await authenticate(req);
    if (req.path === '/auth/complete-mobile-login') return bridge.finish(user, req.body || {});
    if (req.path === '/profile/register') return { profile: await accounts.register(user, req.body || {}) };
    fail(404, 'Not found.');
  }
  async function createOrder(user, body) {
    if (!validId(body.shopId) || !validId(body.requestId)) fail(400, 'A canteen and request ID are required.');
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) fail(400, 'Select between 1 and 30 dishes.');
    if (!['Cash', 'UPI'].includes(body.paymentMethod)) fail(400, 'Choose cash at pickup or UPI.');
    const requested = body.items.map(item => ({ id: item?.id, qty: item?.qty }));
    if (requested.some(item => !validId(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20)
      || new Set(requested.map(item => item.id)).size !== requested.length) fail(400, 'Invalid dishes or quantities.');
    const fingerprint = digest(JSON.stringify({ shopId: body.shopId, items: requested, paymentMethod: body.paymentMethod,
      specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80),
      facultyRoomNote: text(body.facultyRoomNote), groupCollectorName: text(body.groupCollectorName, 80) }));
    const orderRef = db.collection('orders').doc(digest(`${user.uid}:${body.requestId}`));
    return db.runTransaction(async tx => {
      const existing = await tx.get(orderRef);
      if (existing.exists) {
        if (existing.data().requestFingerprint !== fingerprint) fail(409, 'This request ID was already used for another order.');
        return existing.data();
      }
      const canteen = (await tx.get(db.collection('canteens').doc(body.shopId))).data();
      const profile = (await tx.get(db.collection('users').doc(user.uid))).data();
      if (!complete(profile) || normalizeEmail(profile.email) !== normalizeEmail(user.email)) fail(409, 'Complete your profile and link a phone number before ordering.');
      if (!canteen || canteen.status !== 'Open' || !validId(canteen.ownerId)) fail(409, 'This canteen is unavailable.');
      const owner = await auth.getUser(canteen.ownerId);
      if (owner.disabled || owner.customClaims?.seller !== true) fail(409, 'This canteen is awaiting approval.');
      if (profile.banStatus === 'perm_ban' || (profile.banStatus === 'temp_ban' && millis(profile.banUntil) > now())) fail(403, 'Ordering is currently restricted for this account.');
      const location = body.location;
      if (!location || ![location.lat, location.lng, location.accuracy, canteen.lat, canteen.lng].every(Number.isFinite)
        || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180 || location.accuracy < 0 || location.accuracy > 100) fail(400, 'An accurate campus location is required.');
      const rad = degrees => degrees * Math.PI / 180;
      const a = Math.sin(rad(canteen.lat - location.lat) / 2) ** 2 + Math.cos(rad(location.lat)) * Math.cos(rad(canteen.lat)) * Math.sin(rad(canteen.lng - location.lng) / 2) ** 2;
      if (6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) > 500 + location.accuracy) fail(403, 'You must be on campus to order.');
      const menu = new Map((canteen.menu || []).map(item => [item.id, item]));
      const items = requested.map(item => {
        const dish = menu.get(item.id);
        if (!dish?.isAvailable || !Number.isFinite(dish.price) || dish.price <= 0 || dish.price > 100000) fail(409, 'A selected dish is unavailable or has an invalid price.');
        return { id: dish.id, name: text(dish.name, 100), price: Math.round(dish.price * 100) / 100, qty: item.qty, prepTime: text(dish.prepTime, 40) || '5 mins' };
      });
      if (body.paymentMethod === 'UPI' && !/^[\w.-]+@[\w.-]+$/.test(canteen.upiId || '')) fail(409, 'This canteen has not configured UPI. Choose cash.');
      const totalAmount = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100;
      const order = { id: orderRef.id, requestFingerprint: fingerprint, shopId: body.shopId, shopName: canteen.name,
        sellerId: canteen.ownerId, buyerId: user.uid, buyerName: profile.name || 'Campus Student', buyerPhone: profile.phone || '', buyerRollNo: profile.rollNo || '',
        items, totalAmount, paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === 'Cash' ? 'PENDING_CASH' : 'PENDING_MERCHANT_CONFIRMATION',
        merchantUpi: canteen.upiId || '', heldDepositAmount: 0, upfrontPaid: 0, dueAtCounter: body.paymentMethod === 'Cash' ? totalAmount : 0,
        tokenNumber: `SQ-${orderRef.id.slice(0, 8).toUpperCase()}`, pickupPin: String(crypto.randomInt(1000, 10000)), pickupAttempts: 0,
        orderStatus: 'Preparing', estimatedPrepMins: Math.max(5, ...items.map(item => Number(item.prepTime.match(/\d+/)?.[0]) || 5)),
        specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP',
        facultyRoomNote: text(body.facultyRoomNote), groupCollectorName: text(body.groupCollectorName, 80), isFacultyExpress: profile.userType === 'faculty',
        timestamp: new Date(now()).toISOString(), createdAt: stamp(), updatedAt: stamp() };
      tx.set(orderRef, order);
      return order;
    });
  }
  async function changeOrder(user, path, body) {
    if (!validId(body.orderId)) fail(400, 'An order ID is required.');
    const ref = db.collection('orders').doc(body.orderId);
    const result = await db.runTransaction(async tx => {
      const order = (await tx.get(ref)).data();
      if (!order) fail(404, 'Order not found.');
      let update;
      if (path === '/cancel') {
        if (order.buyerId !== user.uid) seller(user, order);
        if (order.orderStatus === 'Cancelled') return { order, success: true };
        available(order);
        update = { orderStatus: 'Cancelled', cancelledBy: order.buyerId === user.uid ? 'buyer' : 'seller', cancelledAt: stamp(), ...refund(order) };
      } else {
        seller(user, order);
        if (path === '/status') {
          if (body.status !== 'Ready for Pickup') fail(400, 'Use pickup verification to complete an order.');
          if (order.orderStatus === 'Ready for Pickup') return { success: true, order };
          available(order);
          update = { orderStatus: 'Ready for Pickup', readyAt: stamp() };
        } else if (path === '/confirm-payment') {
          available(order);
          if (order.paymentMethod !== 'UPI') fail(400, 'Cash is collected at pickup.');
          update = { paymentStatus: 'CONFIRMED_BY_MERCHANT', paymentConfirmedAt: stamp() };
        } else if (path === '/verify-pickup') {
          if (!/^\d{4}$/.test(String(body.pin || ''))) fail(400, 'Enter the four-digit pickup PIN.');
          if (order.orderStatus === 'Completed' && body.pin === order.pickupPin) return { success: true, order };
          if (order.orderStatus !== 'Ready for Pickup') fail(409, 'Mark the order ready before pickup.');
          if (order.paymentMethod === 'UPI' && order.paymentStatus !== 'CONFIRMED_BY_MERCHANT') fail(409, 'Confirm the UPI payment before handover.');
          if (order.pickupAttempts >= 5 && millis(order.pickupLockedUntil) > now()) fail(429, 'Too many incorrect PINs. Wait five minutes.');
          if (body.pin !== order.pickupPin) {
            const attempts = millis(order.pickupLockedUntil) <= now() ? 1 : Number(order.pickupAttempts || 0) + 1;
            tx.update(ref, { pickupAttempts: attempts, pickupLockedUntil: Timestamp.fromMillis(now() + 300000) });
            return { error: 401, message: 'Incorrect pickup PIN.' };
          }
          update = { orderStatus: 'Completed', completedAt: stamp(), paymentStatus: order.paymentMethod === 'Cash' ? 'CASH_COLLECTED' : order.paymentStatus };
        } else if (path === '/abandon') {
          if (order.orderStatus === 'Abandoned') return { success: true, order };
          if (order.orderStatus !== 'Ready for Pickup' || now() - millis(order.readyAt) < 2700000) fail(409, 'An order must be ready for 45 minutes before marking it unclaimed.');
          const buyerRef = db.collection('users').doc(order.buyerId);
          const buyer = (await tx.get(buyerRef)).data() || {};
          const count = Number(buyer.unclaimedOrderCount || 0) + 1;
          const banStatus = count >= 2 ? 'perm_ban' : 'temp_ban';
          const banUntil = count >= 2 ? null : Timestamp.fromMillis(now() + 259200000);
          tx.set(buyerRef, { unclaimedOrderCount: count, banStatus, banUntil, updatedAt: stamp() }, { merge: true });
          update = { orderStatus: 'Abandoned', ...refund(order) };
        } else fail(404, 'Not found.');
      }
      update.updatedAt = stamp();
      tx.update(ref, update);
      return { success: true, order: { ...order, ...update } };
    });
    if (result.error) fail(result.error, result.message);
    return result;
  }
  async function orders(req) {
    const user = await authenticate(req);
    await accounts.requireComplete(user);
    if (req.path === '/create') return { order: await createOrder(user, req.body || {}) };
    return changeOrder(user, req.path, req.body || {});
  }
  function http(handler) {
    return async (req, res) => {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Cache-Control', 'no-store');
      if (req.method === 'OPTIONS') return res.status(204).send('');
      if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed.' });
      try { return res.status(200).json(await handler(req)); }
      catch (error) {
        if (!error.status) console.error('Request failed', error.code || error.name);
        return res.status(error.status || 500).json({ code: error.status ? error.code : undefined, message: error.status ? error.message : 'The service is temporarily unavailable. Please retry.' });
      }
    };
  }
  return { api: http(api), orders: http(orders), createOrder, changeOrder };
}
module.exports = { createHandlers, HttpError };
