// Firestore rules are the authority for prices, payments, state changes and PINs.
// Completion is denied unless the persisted verification matches the private PIN.
const { collection, doc, getDoc, runTransaction, serverTimestamp, Timestamp, increment } = require('firebase/firestore');
const active = order => ['Preparing', 'Ready for Pickup'].includes(order.orderStatus);
const text = (value, max = 300) => String(value || '').trim().slice(0, max);
const millis = value => value?.toMillis?.() || 0;
const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;
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
    const staffRoomDelivery = body.staffRoomDelivery === true;
    const facultyRoomNote = staffRoomDelivery ? text(body.facultyRoomNote, 160) : '';
    const fingerprint = JSON.stringify({ ...(body.testOrder === true ? { testOrder: true } : {}), shopId: body.shopId, items: requested, paymentMethod: body.paymentMethod,
      specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP', facultyRoomNote, staffRoomDelivery, groupCollectorName: text(body.groupCollectorName, 80) });
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
      if (staffRoomDelivery && profile.userType !== 'faculty') throw new Error('Staff room delivery is available to faculty accounts only.');
      if (staffRoomDelivery && !facultyRoomNote) throw new Error('Enter the staff room or department location for delivery.');
      if (body.paymentMethod !== 'Cash') throw new Error('UPI payments are coming soon. Choose cash at pickup or delivery.');
      const items = requested.map(item => {
        const menuIndex = shop.menu.findIndex(d => d.id === item.id);
        const dish = shop.menu[menuIndex];
        if (!dish?.isAvailable || !Number.isFinite(dish.price) || dish.price <= 0) throw new Error('A selected dish is unavailable.');
        return { ...dish, qty: item.qty, menuIndex };
      });
      const itemTotal = items.reduce((total, item) => total + Math.round(item.price * 100) * item.qty, 0) / 100;
      const deliveryFee = staffRoomDelivery ? 5 : 0;
      const totalAmount = itemTotal + deliveryFee;
      const advanceAmount = 0;
      const value = { id: ref.id, requestFingerprint: fingerprint, shopId: body.shopId, shopName: shop.name, sellerId: shop.ownerId,
        buyerId: uid, buyerName: profile.name, buyerPhone: profile.phone, buyerRollNo: profile.rollNo || '', items, totalAmount,
        paymentMethod: 'Cash', paymentStatus: 'PENDING_CASH',
        merchantUpi: shop.upiId || '', advanceAmount,
        advancePaymentStatus: 'NOT_REQUIRED',
        advanceRefundStatus: 'NOT_APPLICABLE',
        heldDepositAmount: 0, upfrontPaid: 0, dueAtCounter: totalAmount,
        tokenNumber: `SQ-${ref.id.slice(-8).toUpperCase()}`, pickupAttempts: 0, pickupLockedUntil: null,
        orderStatus: 'Preparing', estimatedPrepMins: Math.max(...items.map(i => Number(String(i.prepTime ?? '5 mins').match(/\d+/)?.[0] ?? 5))),
        specialInstructions: text(body.specialInstructions), pickupSlot: text(body.pickupSlot, 80) || 'ASAP', facultyRoomNote,
        staffRoomDelivery, deliveryFee, groupCollectorName: text(body.groupCollectorName, 80), isFacultyExpress: profile.userType === 'faculty', location: body.location,
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
    if (path === '/abandon') {
      // Rules authorize the atomic order/profile update, including server increment.
      // If the first-strike policy is denied, retry the repeat-strike policy;
      // neither candidate reads the customer's private profile.
      for (const policy of ['first', 'repeat', 'preserve']) {
        const permanent = policy === 'repeat';
        try {
          const order = await runTransaction(db, async tx => {
            const current = (await tx.get(ref)).data();
            if (!current) throw new Error('Order not found.');
            if (current.orderStatus === 'Abandoned') return current;
            if (current.sellerId !== uid || current.orderStatus !== 'Ready for Pickup' || !millis(current.readyAt)
              || Date.now() - millis(current.readyAt) < NO_SHOW_GRACE_PERIOD_MS)
              throw new Error('Only the assigned seller can mark a ready order unclaimed after 15 minutes.');
            const update = { orderStatus: 'Abandoned', ...noShowSettlement(current), updatedAt: serverTimestamp() };
            tx.update(ref, update);
            tx.update(doc(db, 'users', current.buyerId), {
              unclaimedOrderCount: increment(1), lastStrikeOrderId: body.orderId,
              ...(policy === 'preserve' ? {} : { banStatus: permanent ? 'perm_ban' : 'temp_ban',
                banUntil: permanent ? null : Timestamp.fromMillis(Date.now() + 3 * 86400000) }),
              banReason: 'Unclaimed order: ' + body.orderId, updatedAt: serverTimestamp()
            });
            return { ...current, ...update };
          });
          return { success: true, order };
        } catch (error) { if (policy === 'preserve' || error.code !== 'permission-denied') throw error; }
      }
    }
    if (path === '/rate') {
      if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5 || typeof body.review !== 'string' || body.review.length > 500)
        throw new Error('Choose 1 to 5 stars and keep your review within 500 characters.');
      const order = await runTransaction(db, async tx => {
        const current = (await tx.get(ref)).data();
        if (!current || current.buyerId !== uid || current.orderStatus !== 'Completed') throw new Error('Only your completed orders can be reviewed.');
        const update = { rating: body.rating, review: body.review.trim(), ratedAt: serverTimestamp(), updatedAt: serverTimestamp() };
        if (body.dishRatings !== undefined) {
          const ratings = body.dishRatings;
          const ids = current.items.map(item => item.id);
          if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)
            || Object.keys(ratings).length !== ids.length
            || ids.some(id => !Object.hasOwn(ratings, id) || !Number.isInteger(ratings[id]) || ratings[id] < 1 || ratings[id] > 5))
            throw new Error('Choose 1 to 5 stars for each ordered dish.');
          const reviewId = current.ratingReviewId || doc(collection(db, 'dishReviews')).id;
          update.dishRatings = ratings;
          update.ratingReviewId = reviewId;
          if (!current.ratingReviewId) tx.set(doc(db, 'ratingLinks', reviewId), { orderId: body.orderId, buyerId: uid });
          tx.set(doc(db, 'dishReviews', reviewId), { shopId: current.shopId, ratings, updatedAt: serverTimestamp() });
        }
        tx.update(ref, update); return { ...current, ...update };
      });
      return { success: true, order: await withPin(order) };
    }
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
          if (order.paymentMethod === 'Cash' && order.advanceAmount > 0 && order.advancePaymentStatus !== 'CONFIRMED_BY_MERCHANT') throw new Error('Verify the 10% UPI advance before marking this order ready.');
          update = { orderStatus: 'Ready for Pickup', readyAt: serverTimestamp() };
        } else if (path === '/confirm-payment') {
          if (order.paymentMethod === 'Cash') {
            if (!order.advanceAmount || order.advancePaymentStatus === 'NOT_REQUIRED') throw new Error('This cash order has no advance to verify.');
            if (order.advancePaymentStatus === 'CONFIRMED_BY_MERCHANT') return order;
            update = { advancePaymentStatus: 'CONFIRMED_BY_MERCHANT', advanceRefundStatus: 'NOT_REFUNDED',
              advanceConfirmedAt: serverTimestamp(), heldDepositAmount: order.advanceAmount, upfrontPaid: order.advanceAmount };
          } else {
            if (order.paymentStatus === 'CONFIRMED_BY_MERCHANT') return order;
            update = { paymentStatus: 'CONFIRMED_BY_MERCHANT', paymentConfirmedAt: serverTimestamp() };
          }
        }
        else if (path === '/cancel') update = { orderStatus: 'Cancelled', cancelledBy: order.buyerId === uid ? 'buyer' : 'seller', cancelledAt: serverTimestamp(), ...refund(order) };
        // This write succeeds ONLY when the pickup() rule compares the recorded PIN
        // to the buyer-only secret, and confirms readiness and UPI payment.
        else if (path === '/verify-pickup') update = { orderStatus: 'Completed', completedAt: serverTimestamp(), paymentStatus: order.paymentMethod === 'Cash' ? 'CASH_COLLECTED' : order.paymentStatus };
        else throw new Error('Unsupported order action.');
        tx.update(ref, { ...update, updatedAt: serverTimestamp() });
        return { ...order, ...update };
      });
    } catch (error) {
      if (path === '/verify-pickup' && error.code === 'permission-denied') throw new Error('Pickup not confirmed. Check the PIN and payment status before trying again.');
      throw error;
    }
    return { success: true, order: result.buyerId === uid ? await withPin(result) : result };
  }
  return { create, change, withPin };
}
module.exports = { createSparkOrders };
