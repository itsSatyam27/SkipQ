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
const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;
const ADMIN_ACTIONS = ['APPROVED', 'REJECTED', 'LEFT_UNIVERSITY'];

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
    const refundAmount = order.paymentMethod === 'UPI' && order.paymentStatus === 'CONFIRMED_BY_MERCHANT'
      ? order.totalAmount
      : order.paymentMethod === 'Cash' && order.advancePaymentStatus === 'CONFIRMED_BY_MERCHANT'
        ? order.advanceAmount
        : 0;
    return {
      refundStatus: refundAmount > 0 ? 'MERCHANT_REFUND_REQUIRED' : 'NOT_REQUIRED',
      refundAmount,
      refundText: refundAmount > 0
        ? `Return ₹${refundAmount} directly to the customer. The app does not transfer refunds.`
        : 'Order cancelled. No payment was collected by SkipQ.',
      advanceRefundStatus: order.paymentMethod === 'Cash'
        ? refundAmount > 0 ? 'MERCHANT_REFUND_REQUIRED' : 'NOT_REQUIRED'
        : 'NOT_APPLICABLE'
    };
  }
  function noShowSettlement(order) {
    if (order.paymentMethod === 'Cash' && order.advancePaymentStatus === 'CONFIRMED_BY_MERCHANT') {
      return {
        refundStatus: 'NOT_REQUIRED',
        refundAmount: 0,
        refundText: `₹${order.advanceAmount} advance retained by the canteen after no-show.`,
        advanceRefundStatus: 'RETAINED_AFTER_NO_SHOW'
      };
    }
    return { ...refund(order), advanceRefundStatus: 'NOT_APPLICABLE' };
  }
  async function api(req) {
    if (req.path === '/auth/start-mobile-login') return bridge.start(req.ip);
    if (req.path === '/auth/claim-mobile-login') return bridge.claim(req.body || {});
    const user = await authenticate(req);
    if (req.path === '/auth/complete-mobile-login') return bridge.finish(user, req.body || {});
    if (req.path === '/profile/register') return { profile: await accounts.register(user, req.body || {}) };
    if (req.path === '/admin/offboard-user') return offboardUser(user, req.body || {});
    fail(404, 'Not found.');
  }
  async function offboardUser(actor, body) {
    const uid = text(body.userId, 128);
    const reason = text(body.reason, 500);
    const sellerAction = body.sellerAction;
    const successorUid = text(body.successorUid, 128);
    if (!validId(uid) || !reason) fail(400, 'Choose an account and enter a reason for offboarding.');
    if (sellerAction !== undefined && !['close', 'transfer'].includes(sellerAction)) fail(400, 'Choose whether to close or transfer the seller canteen.');
    if (sellerAction === 'transfer' && !validId(successorUid)) fail(400, 'Choose an approved seller to receive the canteen.');
    if (sellerAction !== 'transfer' && successorUid) fail(400, 'A successor is only allowed when transferring a canteen.');
    const actorAdminRef = db.collection('admins').doc(actor.uid);
    const actorAdminSnap = await db.runTransaction(tx => tx.get(actorAdminRef));
    const actorAdmin = actorAdminSnap.data();
    if (!actorAdmin || actorAdmin.enabled !== true || normalizeEmail(actorAdmin.email) !== normalizeEmail(actor.email)) fail(403, 'Only an authorized administrator can offboard accounts.');
    let targetAuth;
    try { targetAuth = await auth.getUser(uid); }
    catch (error) {
      if (error.code === 'auth/user-not-found') fail(404, 'The account has no Firebase sign-in record and cannot be safely offboarded.');
      throw error;
    }

    const result = await db.runTransaction(async tx => {
      const actorAdmin = (await tx.get(actorAdminRef)).data();
      if (!actorAdmin || actorAdmin.enabled !== true || normalizeEmail(actorAdmin.email) !== normalizeEmail(actor.email)) fail(403, 'Only an authorized administrator can offboard accounts.');
      if (uid === actor.uid) fail(400, 'You cannot offboard the account you are using.');

      const userRef = db.collection('users').doc(uid);
      const adminTargetRef = db.collection('admins').doc(uid);
      const requestRef = db.collection('sellerRequests').doc(uid);
      const approvalRef = db.collection('sellerApprovals').doc(uid);
      const canteenQuery = db.collection('canteens').where('ownerId', '==', uid);
      const buyerOrdersQuery = db.collection('orders').where('buyerId', '==', uid).where('orderStatus', 'in', ACTIVE);
      const sellerOrdersQuery = db.collection('orders').where('sellerId', '==', uid).where('orderStatus', 'in', ACTIVE);
      const [profileSnap, adminTargetSnap, requestSnap, approvalSnap, canteensSnap, buyerOrders, sellerOrders] = await Promise.all([
        tx.get(userRef), tx.get(adminTargetRef), tx.get(requestRef), tx.get(approvalRef),
        tx.get(canteenQuery), tx.get(buyerOrdersQuery), tx.get(sellerOrdersQuery)
      ]);
      const profile = profileSnap.data();
      if (!profile) fail(404, 'Account not found.');
      if (normalizeEmail(targetAuth.email) !== normalizeEmail(profile.email)) fail(409, 'The account email does not match its profile. Resolve the account mismatch before offboarding.');
      if (adminTargetSnap.exists) fail(403, 'Administrator accounts require a separate owner-access review.');
      if (profile.universityStatus === 'LEFT') {
        if (sellerAction && sellerAction !== profile.leftUniversitySellerAction) fail(409, 'This account was already offboarded with a different canteen action.');
        return { alreadyOffboarded: true, sellerAction: profile.leftUniversitySellerAction || null };
      }
      if (buyerOrders.size || sellerOrders.size) fail(409, 'Resolve this account’s active orders before offboarding it.');

      const isSeller = profile.userType === 'seller';
      if (isSeller && !['close', 'transfer'].includes(sellerAction)) fail(400, 'Choose whether to close or transfer the seller canteen.');
      if (!isSeller && sellerAction) fail(400, 'Canteen actions apply only to seller accounts.');
      const canteens = canteensSnap.docs;
      let successorProfileRef;
      if (sellerAction === 'transfer') {
        if (canteens.length !== 1) fail(409, 'Transfer requires exactly one registered canteen. Close it or resolve the canteen records first.');
        if (typeof profile.universityId !== 'string' || !profile.universityId) fail(409, 'The seller’s university must be set before transferring the canteen.');
        if (successorUid === uid) fail(400, 'Choose a different seller as the successor.');
        const successorRef = db.collection('users').doc(successorUid);
        const successorApprovalRef = db.collection('sellerApprovals').doc(successorUid);
        const successorCanteensQuery = db.collection('canteens').where('ownerId', '==', successorUid);
        const [successorSnap, successorApproval, successorCanteens] = await Promise.all([
          tx.get(successorRef), tx.get(successorApprovalRef), tx.get(successorCanteensQuery)
        ]);
        const successor = successorSnap.data();
        let successorAuth;
        try { successorAuth = await auth.getUser(successorUid); }
        catch (error) {
          if (error.code === 'auth/user-not-found') fail(409, 'The successor must have an active Google sign-in account.');
          throw error;
        }
        if (!successor || successor.userType !== 'seller' || successor.profileComplete !== true
          || successor.universityStatus === 'LEFT' || successor.banStatus !== 'active'
          || successor.universityId !== profile.universityId || successorApproval.data()?.approved !== true) {
          fail(409, 'The successor must be an active, approved seller at the same university.');
        }
        if (successorAuth.disabled || !successorAuth.emailVerified
          || !successorAuth.providerData?.some(provider => provider.providerId === 'google.com')
          || normalizeEmail(successorAuth.email) !== normalizeEmail(successor.email)) {
          fail(409, 'The successor must have an enabled, verified Google sign-in account.');
        }
        if (successorCanteens.size) fail(409, 'The successor already owns a canteen. Choose a seller without a canteen.');
        successorProfileRef = successorRef;
      }

      const auditRef = db.collection('adminAudit').doc(crypto.randomBytes(16).toString('hex'));
      const currentTime = stamp();
      tx.update(userRef, {
        universityStatus: 'LEFT',
        leftUniversityAt: currentTime,
        leftUniversityBy: actor.uid,
        leftUniversityReason: reason,
        leftUniversitySellerAction: isSeller ? sellerAction : null,
        updatedAt: currentTime,
        adminActionId: auditRef.id
      });
      for (const canteenDoc of canteens) {
        tx.update(canteenDoc.ref, sellerAction === 'transfer'
          ? { ownerId: successorUid, updatedAt: currentTime }
          : { status: 'Closed', updatedAt: currentTime });
      }
      if (isSeller) {
        if (requestSnap.exists) {
          tx.update(requestRef, { previousStatus: requestSnap.data().status, status: 'LEFT_UNIVERSITY',
            reviewedBy: actor.uid, reviewReason: reason, updatedAt: currentTime, adminActionId: auditRef.id });
        } else {
          tx.set(requestRef, { userId: uid, status: 'LEFT_UNIVERSITY', stallName: profile.stallName || '',
            location: profile.stallLocation || '', universityId: profile.universityId || '', upiId: profile.merchantUpi || '',
            reviewedBy: actor.uid, reviewReason: reason, submittedAt: currentTime, updatedAt: currentTime, adminActionId: auditRef.id });
        }
        tx.set(approvalRef, { approved: false, reviewedBy: actor.uid, updatedAt: currentTime, adminActionId: auditRef.id });
        if (successorProfileRef) tx.set(successorProfileRef, { sellerShopId: canteens[0].id, updatedAt: currentTime }, { merge: true });
      }
      tx.set(auditRef, { actorUid: actor.uid, targetType: 'users', targetId: uid, action: 'LEFT_UNIVERSITY',
        reason, canteenAction: isSeller ? sellerAction : 'not_applicable', successorUid: successorUid || null, createdAt: currentTime });
      return { alreadyOffboarded: false, sellerAction: isSeller ? sellerAction : null };
    });

    try {
      await auth.updateUser(uid, { disabled: true });
    } catch (error) {
      console.error('Account status saved but Firebase Auth disable failed', error.code || error.name);
      fail(503, 'Account access was blocked in SkipQ, but sign-in could not be disabled. Retry this action or contact support.');
    }
    return { success: true, alreadyOffboarded: result.alreadyOffboarded, sellerAction: result.sellerAction };
  }
  async function createOrder(user, body) {
    if (!validId(body.shopId) || !validId(body.requestId)) fail(400, 'A canteen and request ID are required.');
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) fail(400, 'Select between 1 and 30 dishes.');
    if (body.paymentMethod !== 'Cash') fail(400, 'UPI payments are coming soon. Choose cash at pickup or delivery.');
    const requested = body.items.map(item => ({ id: item?.id, qty: item?.qty }));
    if (requested.some(item => !validId(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 20)
      || new Set(requested.map(item => item.id)).size !== requested.length) fail(400, 'Invalid dishes or quantities.');
    const fingerprint = digest(JSON.stringify({ shopId: body.shopId, items: requested, paymentMethod: body.paymentMethod,
      specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80),
      facultyRoomNote: text(body.facultyRoomNote), staffRoomDelivery: body.staffRoomDelivery === true, groupCollectorName: text(body.groupCollectorName, 80) }));
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
      const staffRoomDelivery = body.staffRoomDelivery === true;
      if (staffRoomDelivery && profile.userType !== 'faculty') fail(403, 'Staff room delivery is available to faculty accounts only.');
      const facultyRoomNote = staffRoomDelivery ? text(body.facultyRoomNote, 160) : '';
      if (staffRoomDelivery && !facultyRoomNote) fail(400, 'Enter the staff room or department location for delivery.');
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
      const itemTotal = items.reduce((sum, item) => sum + Math.round(item.price * 100) * item.qty, 0) / 100;
      const deliveryFee = staffRoomDelivery ? 5 : 0;
      const totalAmount = itemTotal + deliveryFee;
      const advanceAmount = 0;
      const order = { id: orderRef.id, requestFingerprint: fingerprint, shopId: body.shopId, shopName: canteen.name,
        sellerId: canteen.ownerId, buyerId: user.uid, buyerName: profile.name || 'Campus Student', buyerPhone: profile.phone || '', buyerRollNo: profile.rollNo || '',
        items, totalAmount, paymentMethod: 'Cash', paymentStatus: 'PENDING_CASH',
        merchantUpi: canteen.upiId || '', advanceAmount,
        advancePaymentStatus: 'NOT_REQUIRED',
        advanceRefundStatus: 'NOT_APPLICABLE',
        heldDepositAmount: 0, upfrontPaid: 0, dueAtCounter: totalAmount,
        tokenNumber: `SQ-${orderRef.id.slice(0, 8).toUpperCase()}`, pickupPin: String(crypto.randomInt(1000, 10000)), pickupAttempts: 0,
        orderStatus: 'Preparing', estimatedPrepMins: Math.max(5, ...items.map(item => Number(item.prepTime.match(/\d+/)?.[0]) || 5)),
        specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP',
        facultyRoomNote, staffRoomDelivery, deliveryFee, groupCollectorName: text(body.groupCollectorName, 80), isFacultyExpress: profile.userType === 'faculty',
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
          if (order.paymentMethod === 'Cash' && order.advanceAmount > 0 && order.advancePaymentStatus !== 'CONFIRMED_BY_MERCHANT') fail(409, 'Verify the 10% UPI advance before marking this order ready.');
          update = { orderStatus: 'Ready for Pickup', readyAt: stamp() };
        } else if (path === '/confirm-payment') {
          available(order);
          if (order.paymentMethod === 'Cash') {
            if (!order.advanceAmount) fail(400, 'This cash order has no advance to verify.');
            if (order.advancePaymentStatus === 'CONFIRMED_BY_MERCHANT') return { success: true, order };
            update = { advancePaymentStatus: 'CONFIRMED_BY_MERCHANT', advanceRefundStatus: 'NOT_REFUNDED',
              advanceConfirmedAt: stamp(), heldDepositAmount: order.advanceAmount, upfrontPaid: order.advanceAmount };
          } else {
            if (order.paymentStatus === 'CONFIRMED_BY_MERCHANT') return { success: true, order };
            update = { paymentStatus: 'CONFIRMED_BY_MERCHANT', paymentConfirmedAt: stamp() };
          }
        } else if (path === '/verify-pickup') {
          if (!/^\d{4}$/.test(String(body.pin || ''))) fail(400, 'Enter the four-digit pickup PIN.');
          if (order.orderStatus === 'Completed' && body.pin === order.pickupPin) return { success: true, order };
          if (order.orderStatus !== 'Ready for Pickup') fail(409, 'Mark the order ready before pickup.');
          if (order.paymentMethod === 'UPI' && order.paymentStatus !== 'CONFIRMED_BY_MERCHANT') fail(409, 'Confirm the UPI payment before handover.');
          if (order.paymentMethod === 'Cash' && order.advanceAmount > 0 && order.advancePaymentStatus !== 'CONFIRMED_BY_MERCHANT') fail(409, 'Verify the 10% UPI advance before handover.');
          if (order.pickupAttempts >= 5 && millis(order.pickupLockedUntil) > now()) fail(429, 'Too many incorrect PINs. Wait five minutes.');
          if (body.pin !== order.pickupPin) {
            const attempts = millis(order.pickupLockedUntil) <= now() ? 1 : Number(order.pickupAttempts || 0) + 1;
            tx.update(ref, { pickupAttempts: attempts, pickupLockedUntil: Timestamp.fromMillis(now() + 300000) });
            return { error: 401, message: 'Incorrect pickup PIN.' };
          }
          update = { orderStatus: 'Completed', completedAt: stamp(), paymentStatus: order.paymentMethod === 'Cash' ? 'CASH_COLLECTED' : order.paymentStatus };
        } else if (path === '/abandon') {
          if (order.orderStatus === 'Abandoned') return { success: true, order };
          if (order.orderStatus !== 'Ready for Pickup' || now() - millis(order.readyAt) < NO_SHOW_GRACE_PERIOD_MS) fail(409, 'An order must be ready for 15 minutes before marking it unclaimed.');
          const buyerRef = db.collection('users').doc(order.buyerId);
          const buyer = (await tx.get(buyerRef)).data() || {};
          const count = Number(buyer.unclaimedOrderCount || 0) + 1;
          const banStatus = count >= 2 ? 'perm_ban' : 'temp_ban';
          const banUntil = count >= 2 ? null : Timestamp.fromMillis(now() + 259200000);
          tx.set(buyerRef, { unclaimedOrderCount: count, banStatus, banUntil, updatedAt: stamp() }, { merge: true });
          update = { orderStatus: 'Abandoned', ...noShowSettlement(order) };
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
  return { api: http(api), orders: http(orders), createOrder, changeOrder, offboardUser };
}
module.exports = { createHandlers, HttpError };
