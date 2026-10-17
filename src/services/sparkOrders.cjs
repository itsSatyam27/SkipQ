// Firestore rules are the authority for prices, payments, state changes and PINs.
// Completion is denied unless the persisted verification matches the private PIN.
const { doc, getDoc, runTransaction, serverTimestamp, Timestamp } = require('firebase/firestore');
const active = order => ['Preparing', 'Ready for Pickup'].includes(order.orderStatus);
const text = (value, max = 300) => String(value || '').trim().slice(0, max);
const millis = value => value?.toMillis?.() || 0;
function refund(order) {
  return order.paymentMethod === 'UPI' && order.paymentStatus === 'CONFIRMED_BY_MERCHANT'
    ? { refundStatus: 'MERCHANT_REFUND_REQUIRED', refundAmount: order.totalAmount, refundText: 'Contact the canteen for your UPI refund. The app does not transfer refunds.' }
    : { refundStatus: 'NOT_REQUIRED', refundAmount: 0, refundText: 'Order cancelled. No payment was collected by SkipQ.' };
}
function createSparkOrders(db, uid) {
  const secretRef = (buyer, id) => doc(db, 'users', buyer, 'pickupSecrets', id);
  async function withPin(order) {
    if (order.buyerId !== uid) return order;
    const secret = await getDoc(secretRef(uid, order.id));
    return { ...order, pickupPin: secret.data()?.pin || order.pickupPin };
  }
  async function create(body) {
    if (!uid) throw new Error('Sign in before ordering.');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(body.requestId || '') || !body.shopId) throw new Error('A canteen and request ID are required.');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 5) throw new Error('Choose up to 5 different dishes per order. You can increase each dish quantity.');
    const requested = body.items.map(item => ({ id: item.id, qty: item.qty }));
    if (new Set(requested.map(i => i.id)).size !== requested.length || requested.some(i => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 20)) throw new Error('Invalid dishes or quantities.');
    const fingerprint = JSON.stringify({ ...(body.testOrder === true ? { testOrder: true } : {}), shopId: body.shopId, items: requested, paymentMethod: body.paymentMethod,
      specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP', facultyRoomNote: text(body.facultyRoomNote), groupCollectorName: text(body.groupCollectorName, 80) });
    const ref = doc(db, 'orders', `${uid}_${body.requestId}`);
    const order = await runTransaction(db, async tx => {
      const prior = await tx.get(ref);
      if (prior.exists()) {
        if (prior.data().requestFingerprint !== fingerprint) throw new Error('This request ID belongs to another order.');
        return prior.data();
      }
      const shop = (await tx.get(doc(db, 'canteens', body.shopId))).data();
      const profile = (await tx.get(doc(db, 'users', uid))).data();
      if (!shop || shop.status !== 'Open') throw new Error('This canteen is unavailable.');
      if (!profile?.profileComplete) throw new Error('Complete your profile first.');
      if (!['Cash', 'UPI'].includes(body.paymentMethod)) throw new Error('Choose cash at pickup or UPI.');
      if (body.paymentMethod === 'UPI' && !/^[\w.-]+@[\w.-]+$/.test(shop.upiId || '')) throw new Error('This canteen has not configured UPI. Choose cash.');
      const items = requested.map(item => {
        const menuIndex = shop.menu.findIndex(d => d.id === item.id);
        const dish = shop.menu[menuIndex];
        if (!dish?.isAvailable || !Number.isFinite(dish.price) || dish.price <= 0) throw new Error('A selected dish is unavailable.');
        return { ...dish, qty: item.qty, sourceDish: dish, menuIndex };
      });
      const totalAmount = items.reduce((total, item) => total + Math.round(item.price * 100) * item.qty, 0) / 100;
      const value = { id: ref.id, requestFingerprint: fingerprint, shopId: body.shopId, shopName: shop.name, sellerId: shop.ownerId,
        buyerId: uid, buyerName: profile.name, buyerPhone: profile.phone, buyerRollNo: profile.rollNo || '', items, totalAmount,
        paymentMethod: body.paymentMethod, paymentStatus: body.paymentMethod === 'Cash' ? 'PENDING_CASH' : 'PENDING_MERCHANT_CONFIRMATION',
        merchantUpi: shop.upiId || '', heldDepositAmount: 0, upfrontPaid: 0, dueAtCounter: body.paymentMethod === 'Cash' ? totalAmount : 0,
        tokenNumber: `SQ-${ref.id.slice(-8).toUpperCase()}`, pickupAttempts: 0, pickupLockedUntil: null,
        orderStatus: 'Preparing', estimatedPrepMins: Math.max(5, ...items.map(i => Number(String(i.prepTime || '5 mins').match(/\d+/)?.[0]) || 5)),
        specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP', facultyRoomNote: text(body.facultyRoomNote),
        groupCollectorName: text(body.groupCollectorName, 80), isFacultyExpress: profile.userType === 'faculty', location: body.location,
        ...(body.testOrder === true ? { testOrder: true } : {}),
        timestamp: new Date().toISOString(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      tx.set(ref, value);
      tx.set(secretRef(uid, ref.id), { pin, createdAt: serverTimestamp() });
      return { ...value, pickupPin: pin };
    });
    return order.pickupPin ? order : withPin(order);
  }
  async function change(path, body) {
    const ref = doc(db, 'orders', body.orderId);
    if (path === '/verify-pickup') {
      if (!/^\d{4}$/.test(String(body.pin || ''))) throw new Error('Enter the four-digit pickup PIN.');
      await runTransaction(db, async tx => {
        const order = (await tx.get(ref)).data();
        if (!order) throw new Error('Order not found.');
        if (order.orderStatus === 'Completed') return;
        if (order.orderStatus !== 'Ready for Pickup') throw new Error('Mark the order ready before pickup.');
        if (order.pickupAttempts >= 5 && millis(order.pickupLockedUntil) > Date.now()) throw new Error('Too many incorrect PINs. Wait five minutes.');
        const attempt = millis(order.pickupLockedUntil) <= Date.now() ? 1 : order.pickupAttempts + 1;
        // Attempt and counter commit even for wrong PINs. Rules bind them atomically.
        tx.set(doc(db, 'pickupVerifications', body.orderId), { pin: String(body.pin), attempt, checkedAt: serverTimestamp() });
        tx.update(ref, { pickupAttempts: attempt, pickupLockedUntil: Timestamp.fromMillis(Date.now() + 300000), updatedAt: serverTimestamp() });
      });
    }
    let result;
    try {
      result = await runTransaction(db, async tx => {
        const order = (await tx.get(ref)).data();
        if (!order) throw new Error('Order not found.');
        if (path === '/verify-pickup' && order.orderStatus === 'Completed') return order;
        if (path === '/cancel' && order.orderStatus === 'Cancelled') return order;
        if (path === '/abandon' && order.orderStatus === 'Abandoned') return order;
        if (!active(order)) throw new Error('This order is already closed.');
        let update;
        if (path === '/status') {
          if (body.status !== 'Ready for Pickup') throw new Error('Use pickup verification to complete the order.');
          if (order.orderStatus === 'Ready for Pickup') return order;
          update = { orderStatus: 'Ready for Pickup', readyAt: serverTimestamp() };
        } else if (path === '/confirm-payment') update = { paymentStatus: 'CONFIRMED_BY_MERCHANT', paymentConfirmedAt: serverTimestamp() };
        else if (path === '/cancel') update = { orderStatus: 'Cancelled', cancelledBy: order.buyerId === uid ? 'buyer' : 'seller', cancelledAt: serverTimestamp(), ...refund(order) };
        // This write succeeds ONLY when the pickup() rule compares the recorded PIN
        // to the buyer-only secret, and confirms readiness and UPI payment.
        else if (path === '/verify-pickup') update = { orderStatus: 'Completed', completedAt: serverTimestamp(), paymentStatus: order.paymentMethod === 'Cash' ? 'CASH_COLLECTED' : order.paymentStatus };
        else if (path === '/abandon') {
          if (Date.now() - millis(order.readyAt) < 2700000) throw new Error('An order must be ready for 45 minutes before marking it unclaimed.');
          update = { orderStatus: 'Abandoned', ...refund(order) };
        } else throw new Error('Unsupported order action.');
        tx.update(ref, { ...update, updatedAt: serverTimestamp() });
        return { ...order, ...update };
      });
    } catch (error) {
      if (path === '/verify-pickup' && error.code === 'permission-denied') throw new Error('Pickup not confirmed. Check the PIN and confirm UPI payment before trying again.');
      throw error;
    }
    return { success: true, order: result.buyerId === uid ? await withPin(result) : result };
  }
  return { create, change, withPin };
}
module.exports = { createSparkOrders };
