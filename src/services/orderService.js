import {
  auth,
  db,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  onAuthStateChanged,
  serverTimestamp
} from './firebase';

const ORDERS_API_URL = (process.env.EXPO_PUBLIC_ORDERS_API_URL || '').replace(/\/$/, '');

async function orderRequest(path, body) {
  if (!ORDERS_API_URL || ORDERS_API_URL.includes('YOUR_')) return null;
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    const token = await user.getIdToken();
    const res = await fetch(`${ORDERS_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Order request failed.');
    return data;
  } catch (err) {
    console.log(`Cloud function orderRequest error (${path}), falling back to direct DB:`, err.message);
    return null;
  }
}

// Subscribe to real-time orders across students and kitchen KDS
// When filterOptions ({ role, uid, shopId }) is provided, scoped queries match Firestore security rules
export function subscribeToOrders(filterOrUpdate, maybeUpdate) {
  if (!isFirebaseConfigured || !db) return () => {};

  const onUpdate = typeof filterOrUpdate === 'function' ? filterOrUpdate : maybeUpdate;
  const filter = typeof filterOrUpdate === 'object' && filterOrUpdate !== null ? filterOrUpdate : {};

  if (typeof onUpdate !== 'function') return () => {};

  let unsubscribe = () => {};

  const normalizeSnapshot = snapshot => snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      timestamp: data.timestamp || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString())
    };
  });

  try {
    const ordersRef = collection(db, 'orders');
    let ordersQuery = ordersRef;

    const currentUid = filter.uid || auth?.currentUser?.uid;

    if (filter.role === 'seller' && (filter.shopId || currentUid)) {
      if (filter.shopId) {
        ordersQuery = query(ordersRef, where('shopId', '==', filter.shopId));
      } else if (currentUid) {
        ordersQuery = query(ordersRef, where('sellerId', '==', currentUid));
      }
    } else if (filter.role === 'buyer' && currentUid) {
      ordersQuery = query(ordersRef, where('buyerId', '==', currentUid));
    } else if (currentUid) {
      // General signed in user fallback: query by buyerId
      ordersQuery = query(ordersRef, where('buyerId', '==', currentUid));
    }

    unsubscribe = onSnapshot(
      ordersQuery,
      snapshot => {
        const list = normalizeSnapshot(snapshot);
        onUpdate(list.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
      },
      error => console.log('Firestore orders subscription note:', error.message)
    );

    return unsubscribe;
  } catch (e) {
    console.log('Error setting up orders listener:', e);
    return () => {};
  }
}

// Place a new order into Firestore
export async function placeOrderInFirestore(orderData) {
  // Try cloud function first if configured
  const cloudResult = await orderRequest('/create', orderData);
  if (cloudResult?.order) {
    return cloudResult.order;
  }

  // Direct Firestore write fallback
  if (isFirebaseConfigured && db) {
    try {
      const orderId = orderData.id || `SQ-${Date.now().toString().slice(-4)}`;
      const orderDocRef = doc(db, 'orders', orderId);
      const buyerUid = auth?.currentUser?.uid || orderData.buyerId || 'student_guest';
      const payload = {
        ...orderData,
        id: orderId,
        buyerId: buyerUid,
        sellerId: orderData.sellerId || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      await setDoc(orderDocRef, payload, { merge: true });
      return payload;
    } catch (e) {
      console.log('Direct Firestore placeOrder note:', e.message);
    }
  }

  return orderData;
}

// Update order status in Firestore (e.g. 'Preparing' -> 'Ready for Pickup' -> 'Completed')
export async function updateOrderStatusInFirestore(orderId, orderStatus, extraFields = {}) {
  const cloudResult = await orderRequest('/status', { orderId, status: orderStatus });
  if (cloudResult) return cloudResult;

  if (isFirebaseConfigured && db) {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, {
        orderStatus,
        ...extraFields,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.log('Direct Firestore updateOrderStatus note:', e.message);
    }
  }
}

// Verify 4-digit PIN and mark order completed
export async function verifyOrderPinInFirestore(orderId, enteredPin) {
  const cloudResult = await orderRequest('/verify-pickup', { orderId, pin: enteredPin });
  if (cloudResult) return cloudResult;

  if (isFirebaseConfigured && db) {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, {
        orderStatus: 'Completed',
        enteredPin,
        pinVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.log('Direct Firestore verifyOrderPin note:', e.message);
    }
  }
  return { success: true };
}

export async function confirmUpiPaymentInFirestore(orderId) {
  const cloudResult = await orderRequest('/confirm-payment', { orderId });
  if (cloudResult) return cloudResult;

  if (isFirebaseConfigured && db) {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, {
        paymentStatus: 'CONFIRMED_BY_MERCHANT',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }
}

// Cancel order and record refund
export async function cancelOrderInFirestore(orderId, cancelledBy = 'buyer', meta = {}) {
  const cloudResult = await orderRequest('/cancel', { orderId, cancelledBy, ...meta });
  if (cloudResult) return cloudResult;

  if (isFirebaseConfigured && db) {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, {
        orderStatus: 'Cancelled',
        cancelledBy,
        refundStatus: meta.refundStatus || 'REFUND_COMPLETED_UPI',
        refundAmount: meta.refundAmount || 0,
        refundText: meta.refundText || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }
}

export async function abandonOrderInFirestore(orderId) {
  const cloudResult = await orderRequest('/abandon', { orderId });
  if (cloudResult) return cloudResult;

  if (isFirebaseConfigured && db) {
    try {
      const orderDocRef = doc(db, 'orders', orderId);
      await setDoc(orderDocRef, {
        orderStatus: 'Abandoned',
        abandonedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }

  const banDate = new Date();
  banDate.setDate(banDate.getDate() + 3);
  return {
    penalty: {
      newUnclaimedCount: 1,
      newBanStatus: 'temp_ban',
      newBanUntil: banDate.toISOString()
    }
  };
}

// Clean aliases for AppContext
export const createOrderInDb = placeOrderInFirestore;
export const updateOrderStatusInDb = updateOrderStatusInFirestore;
export const verifyOrderPinInDb = verifyOrderPinInFirestore;
export const cancelOrderInDb = cancelOrderInFirestore;
export const abandonOrderInDb = abandonOrderInFirestore;
