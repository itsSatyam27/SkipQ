const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();
const fast2SmsKey = defineSecret('FAST2SMS_API_KEY');
const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function phoneOf(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(-10);
  return /^\d{10}$/.test(digits) ? digits : null;
}
function otpHash(phone, code) {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}
function response(res, status, body) { return res.status(status).json(body); }

exports.api = onRequest({ region: 'asia-south1', secrets: [fast2SmsKey] }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (req.method !== 'POST') return response(res, 405, { message: 'Method not allowed.' });

  const phone = phoneOf(req.body?.phone);
  if (!phone) return response(res, 400, { message: 'Enter a valid 10-digit phone number.' });
  const challengeRef = db.collection('otpChallenges').doc(phone);

  if (req.path.endsWith('/request-otp')) {
    const previous = await challengeRef.get();
    const lastSent = previous.exists ? previous.data().lastSentAt?.toMillis?.() || 0 : 0;
    if (Date.now() - lastSent < 30_000) return response(res, 429, { message: 'Wait before requesting another code.' });
    const code = String(crypto.randomInt(100000, 1000000));
    const apiKey = fast2SmsKey.value();
    const providerResponse = await fetch(`https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(apiKey)}&variables_values=${code}&route=otp&numbers=${phone}`);
    const providerData = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok || providerData.return === false) {
      console.error('SMS provider rejected OTP request', providerData.status_code);
      return response(res, 502, { message: 'Could not send the verification code.' });
    }
    await challengeRef.set({
      codeHash: otpHash(phone, code), attempts: 0,
      lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + OTP_TTL_MS)
    });
    return response(res, 200, { success: true });
  }

  if (req.path.endsWith('/verify-otp')) {
    const code = String(req.body?.code || '');
    if (!/^\d{6}$/.test(code)) return response(res, 400, { message: 'Enter the 6-digit code.' });
    const challenge = await challengeRef.get();
    const data = challenge.data();
    if (!challenge.exists || data.expiresAt.toMillis() < Date.now() || data.attempts >= MAX_ATTEMPTS) {
      return response(res, 401, { message: 'This code has expired. Request another one.' });
    }
    if (otpHash(phone, code) !== data.codeHash) {
      await challengeRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return response(res, 401, { message: 'That verification code is incorrect.' });
    }
    await challengeRef.delete();
    const uid = `phone_${crypto.createHash('sha256').update(phone).digest('hex').slice(0, 28)}`;
    const customToken = await admin.auth().createCustomToken(uid, { phoneVerified: true });
    return response(res, 200, { customToken });
  }
  return response(res, 404, { message: 'Not found.' });
});

async function requireUser(req, res) {
  const token = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) { response(res, 401, { message: 'Sign in is required.' }); return null; }
  try { return await admin.auth().verifyIdToken(token); }
  catch { response(res, 401, { message: 'Your session has expired. Sign in again.' }); return null; }
}

// Server-authoritative order creation. Prices, availability, IDs, and pickup
// credentials are derived here rather than trusted from a mobile client.
exports.ordersApi = onRequest({ region: 'asia-south1' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'POST' && req.path.endsWith('/create')) {
    const shopId = String(req.body?.shopId || '');
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!shopId || !requestedItems.length) return response(res, 400, { message: 'A canteen and at least one item are required.' });
    const canteenRef = db.collection('canteens').doc(shopId);
    const userRef = db.collection('users').doc(user.uid);
    const canteenSnap = await canteenRef.get();
    if (!canteenSnap.exists) return response(res, 404, { message: 'This canteen is no longer available.' });
    const canteen = canteenSnap.data();
    if (canteen.status && canteen.status !== 'Open') return response(res, 409, { message: 'This canteen is currently closed.' });
    const menu = new Map((canteen.menu || []).map(item => [item.id, item]));
    const items = [];
    for (const requested of requestedItems) {
      const menuItem = menu.get(requested.id);
      const qty = Number(requested.qty);
      if (!menuItem || !menuItem.isAvailable || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        return response(res, 400, { message: 'One or more selected dishes are unavailable.' });
      }
      items.push({ id: menuItem.id, name: menuItem.name, price: Number(menuItem.price), qty, prepTime: menuItem.prepTime || '5 mins' });
    }
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const paymentMethod = String(req.body?.paymentMethod || 'Cash');
    if (!['Cash', 'UPI'].includes(paymentMethod)) return response(res, 400, { message: 'Unsupported payment method.' });
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    if (userData.banStatus === 'perm_ban') return response(res, 403, { message: 'This account is permanently banned.' });
    if (userData.banStatus === 'temp_ban' && userData.banUntil?.toMillis?.() > Date.now()) {
      return response(res, 403, { message: 'This account is temporarily banned.' });
    }
    const heldDepositAmount = paymentMethod === 'Cash' ? Math.ceil(totalAmount * 0.10) : 0;
    const walletBalance = Number(userData.walletBalance ?? 500);
    if (walletBalance < heldDepositAmount) return response(res, 409, { message: `A ₹${heldDepositAmount} security deposit is required for cash orders.` });
    const orderRef = db.collection('orders').doc();
    const tokenNumber = `SQ-${String(crypto.randomInt(100000, 1000000))}`;
    const pickupPin = String(crypto.randomInt(1000, 10000));
    const order = {
      id: orderRef.id, shopId, shopName: canteen.name, sellerId: canteen.ownerId || '', buyerId: user.uid,
      buyerName: userData.name || 'Campus Student', buyerPhone: userData.phone || '', buyerRollNo: userData.rollNo || '',
      items, totalAmount, heldDepositAmount, tokenNumber, pickupPin, orderStatus: 'Preparing',
      paymentMethod,
      paymentStatus: paymentMethod === 'Cash' ? 'PENDING_CASH' : 'PENDING_MERCHANT_CONFIRMATION',
      specialInstructions: String(req.body?.specialInstructions || '').slice(0, 300),
      timestamp: new Date().toISOString(), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    let depositError = false;
    await db.runTransaction(async transaction => {
      const latestUserSnap = await transaction.get(userRef);
      const latestUser = latestUserSnap.exists ? latestUserSnap.data() : {};
      const latestWallet = Number(latestUser.walletBalance ?? 500);
      if (latestWallet < heldDepositAmount) {
        depositError = true;
        throw new Error('INSUFFICIENT_DEPOSIT');
      }
      transaction.set(orderRef, order);
      if (heldDepositAmount > 0) transaction.set(userRef, {
        walletBalance: latestWallet - heldDepositAmount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }).catch(error => {
      if (depositError || error.message === 'INSUFFICIENT_DEPOSIT') return;
      console.error('Order transaction failed', error);
      throw error;
    });
    if (depositError) return response(res, 409, { message: 'A security deposit is required for this cash order.' });
    return response(res, 201, { order });
  }
  if (req.method === 'POST' && req.path.endsWith('/status')) {
    const orderRef = db.collection('orders').doc(String(req.body?.orderId || ''));
    const snap = await orderRef.get();
    if (!snap.exists) return response(res, 404, { message: 'Order not found.' });
    const order = snap.data();
    if (order.sellerId !== user.uid) return response(res, 403, { message: 'Only the assigned seller can update this order.' });
    const status = String(req.body?.status || '');
    if (status !== 'Ready for Pickup') return response(res, 400, { message: 'Use pickup PIN verification to complete an order.' });
    await orderRef.update({ orderStatus: status, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return response(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.path.endsWith('/confirm-payment')) {
    const orderRef = db.collection('orders').doc(String(req.body?.orderId || ''));
    const snap = await orderRef.get();
    if (!snap.exists) return response(res, 404, { message: 'Order not found.' });
    const order = snap.data();
    if (order.sellerId !== user.uid) return response(res, 403, { message: 'Only the assigned seller can confirm payment.' });
    if (order.paymentMethod === 'Cash') return response(res, 400, { message: 'Cash payments are confirmed at handover.' });
    await orderRef.update({ paymentStatus: 'CONFIRMED_BY_MERCHANT', paymentConfirmedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return response(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.path.endsWith('/verify-pickup')) {
    const orderRef = db.collection('orders').doc(String(req.body?.orderId || ''));
    const snap = await orderRef.get();
    if (!snap.exists) return response(res, 404, { message: 'Order not found.' });
    const order = snap.data();
    if (order.sellerId !== user.uid) return response(res, 403, { message: 'Only the assigned seller can verify pickup.' });
    if (String(req.body?.pin || '') !== String(order.pickupPin)) return response(res, 401, { message: 'Incorrect pickup PIN.' });
    const buyerRef = db.collection('users').doc(order.buyerId);
    await db.runTransaction(async transaction => {
      const updates = {
        orderStatus: 'Completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (order.heldDepositAmount > 0 && !order.depositRefunded) {
        const buyerSnap = await transaction.get(buyerRef);
        const buyer = buyerSnap.exists ? buyerSnap.data() : {};
        updates.depositRefunded = true;
        transaction.set(buyerRef, {
          walletBalance: Number(buyer.walletBalance ?? 500) + Number(order.heldDepositAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      transaction.update(orderRef, updates);
    });
    return response(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.path.endsWith('/cancel')) {
    const orderRef = db.collection('orders').doc(String(req.body?.orderId || ''));
    const snap = await orderRef.get();
    if (!snap.exists) return response(res, 404, { message: 'Order not found.' });
    const order = snap.data();
    if (order.buyerId !== user.uid && order.sellerId !== user.uid) return response(res, 403, { message: 'You cannot cancel this order.' });
    if (!['Preparing', 'Ready for Pickup'].includes(order.orderStatus)) return response(res, 409, { message: 'This order can no longer be cancelled.' });
    const cancelledBy = order.buyerId === user.uid ? 'buyer' : 'seller';
    const userRef = db.collection('users').doc(order.buyerId);
    await db.runTransaction(async transaction => {
      const updates = {
        orderStatus: 'Cancelled', cancelledBy, cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (order.heldDepositAmount > 0 && !order.depositRefunded) {
        const buyerSnap = await transaction.get(userRef);
        const buyer = buyerSnap.exists ? buyerSnap.data() : {};
        updates.depositRefunded = true;
        transaction.set(userRef, {
          walletBalance: Number(buyer.walletBalance ?? 500) + Number(order.heldDepositAmount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
      transaction.update(orderRef, updates);
    });
    return response(res, 200, { success: true });
  }
  if (req.method === 'POST' && req.path.endsWith('/abandon')) {
    const orderRef = db.collection('orders').doc(String(req.body?.orderId || ''));
    const snap = await orderRef.get();
    if (!snap.exists) return response(res, 404, { message: 'Order not found.' });
    const order = snap.data();
    if (order.sellerId !== user.uid) return response(res, 403, { message: 'Only the assigned seller can mark an order unclaimed.' });
    if (!['Ready for Pickup', 'Preparing'].includes(order.orderStatus)) return response(res, 409, { message: 'This order cannot be marked unclaimed.' });
    const buyerRef = db.collection('users').doc(order.buyerId);
    let penalty;
    await db.runTransaction(async transaction => {
      const buyerSnap = await transaction.get(buyerRef);
      const buyer = buyerSnap.exists ? buyerSnap.data() : {};
      const count = Number(buyer.unclaimedOrderCount || 0) + 1;
      const banStatus = count >= 2 ? 'perm_ban' : 'temp_ban';
      const banUntil = count >= 2 ? null : admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 24 * 60 * 60 * 1000);
      penalty = { newUnclaimedCount: count, newBanStatus: banStatus, newBanUntil: banUntil?.toDate?.().toISOString() || null };
      transaction.set(buyerRef, { unclaimedOrderCount: count, banStatus, banUntil, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.update(orderRef, { orderStatus: 'Abandoned', depositForfeited: Number(order.heldDepositAmount || 0), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return response(res, 200, { success: true, penalty });
  }

  // Periodic cleanup / auto-abandon endpoint for orders uncollected for > 45 minutes
  if (req.method === 'POST' && req.path.endsWith('/cleanup-abandoned')) {
    const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
    const staleOrdersSnap = await db.collection('orders')
      .where('orderStatus', '==', 'Ready for Pickup')
      .get();

    let processedCount = 0;
    for (const docSnap of staleOrdersSnap.docs) {
      const ord = docSnap.data();
      const readyAt = ord.updatedAt?.toDate?.() || ord.createdAt?.toDate?.() || (ord.timestamp ? new Date(ord.timestamp) : null);
      if (readyAt && readyAt < fortyFiveMinsAgo) {
        const orderRef = docSnap.ref;
        const buyerRef = db.collection('users').doc(ord.buyerId);
        try {
          await db.runTransaction(async transaction => {
            const buyerSnap = await transaction.get(buyerRef);
            const buyer = buyerSnap.exists ? buyerSnap.data() : {};
            const count = Number(buyer.unclaimedOrderCount || 0) + 1;
            const banStatus = count >= 2 ? 'perm_ban' : 'temp_ban';
            const banUntil = count >= 2 ? null : admin.firestore.Timestamp.fromMillis(Date.now() + 3 * 24 * 60 * 60 * 1000);

            transaction.set(buyerRef, { unclaimedOrderCount: count, banStatus, banUntil, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            transaction.update(orderRef, { orderStatus: 'Abandoned', depositForfeited: Number(ord.heldDepositAmount || 0), autoAbandonedByCron: true, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          });
          processedCount++;
        } catch (e) {
          console.error('Auto abandon note:', e.message);
        }
      }
    }
    return response(res, 200, { success: true, processedCount });
  }

  return response(res, 404, { message: 'Not found.' });
});
