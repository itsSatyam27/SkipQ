import { auth, db, isFirebaseConfigured, collection, doc, getDoc, query, where, onSnapshot } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSparkOrders } from './sparkOrders.cjs';
async function orderRequest(path, body) {
  const user = auth?.currentUser;
  if (!user || user.isAnonymous || !user.emailVerified || !db) throw new Error('Sign in before ordering.');
  const orders = createSparkOrders(db, user.uid);
  return path === '/create' ? { order: await orders.create(body) } : orders.change(path, body);
}
export function subscribeToOrders(filter, onUpdate, onError = console.warn) {
  const uid = auth?.currentUser?.uid;
  if (!isFirebaseConfigured || !db || !uid || filter.uid !== uid) return () => {};
  const field = filter.role === 'seller' ? 'sellerId' : 'buyerId';
  let version = 0;
  let alive = true;
  let ownOrders = [], delegatedOrders = [];
  const publish = async () => {
    const current = ++version;
    try {
      const orders = [...ownOrders, ...delegatedOrders].filter((order,index,list)=>list.findIndex(item=>item.id===order.id)===index);
      const complete = field === 'buyerId' ? await Promise.all(orders.map(order => createSparkOrders(db, uid).withPin(order))) : orders;
      if (alive && current === version) onUpdate(complete.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
    } catch (error) { if (alive) onError(error); }
  };
  const ownUnsubscribe = onSnapshot(query(collection(db, 'orders'), where(field, '==', uid)), snapshot => { ownOrders=snapshot.docs.map(snap=>({...snap.data(),id:snap.id}));publish(); }, onError);
  let delegationUnsubscribe=()=>{};
  if(field==='buyerId') delegationUnsubscribe=onSnapshot(query(collection(db,'pickupDelegations'),where('collectorId','==',uid),where('status','==','ACCEPTED')),async snapshot=>{
    delegatedOrders=(await Promise.all(snapshot.docs.map(async delegation=>{const data=delegation.data();const order=await getDoc(doc(db,'orders',data.orderId));return order.exists()?{...order.data(),id:order.id,delegatedCollectorName:data.collectorName,pickupDelegation:true}:null;}))).filter(Boolean);publish();
  },onError);
  return () => { alive = false; ownUnsubscribe(); delegationUnsubscribe(); };
}
export async function placeOrderInFirestore(body) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Sign in before ordering.');
  const key = `@skipq_pending_order_${uid}`;
  const payload = { ...(body.testOrder === true ? { testOrder: true } : {}), shopId: body.shopId, items: body.items.map(item => ({ id: item.id, qty: item.qty })),
    paymentMethod: body.paymentMethod, specialInstructions: body.specialInstructions || '', pickupSlot: body.pickupSlot || 'ASAP',
    facultyRoomNote: body.facultyRoomNote || '', staffRoomDelivery: body.staffRoomDelivery === true, groupCollectorName: body.groupCollectorName || '' };
  const fingerprint = JSON.stringify(payload);
  let pending = JSON.parse(await AsyncStorage.getItem(key) || 'null');
  if (!pending || pending.fingerprint !== fingerprint) {
    pending = { fingerprint, requestId: `order_${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}` };
    await AsyncStorage.setItem(key, JSON.stringify(pending));
  }
  const result = await orderRequest('/create', { ...payload, requestId: pending.requestId, location: body.location, testOrder: body.testOrder === true });
  if (!result.order?.id) throw new Error('The server did not confirm the order. Please retry.');
  // Keep the key until the UI has committed success. A lost response reuses the same request.
  return result.order;
}
export async function acknowledgeOrder() { const uid = auth?.currentUser?.uid; if (uid) await AsyncStorage.removeItem(`@skipq_pending_order_${uid}`); }
export const updateOrderStatusInFirestore = (orderId, status) => orderRequest('/status', { orderId, status });
export const verifyOrderPinInFirestore = (orderId, pin) => orderRequest('/verify-pickup', { orderId, pin: String(pin || '').trim() });
export const confirmUpiPaymentInFirestore = orderId => orderRequest('/confirm-payment', { orderId });
export const cancelOrderInFirestore = orderId => orderRequest('/cancel', { orderId });
export const abandonOrderInFirestore = orderId => orderRequest('/abandon', { orderId });
export const createOrderInDb = placeOrderInFirestore;
export const updateOrderStatusInDb = updateOrderStatusInFirestore;
export const verifyOrderPinInDb = verifyOrderPinInFirestore;
export const cancelOrderInDb = cancelOrderInFirestore;
export const abandonOrderInDb = abandonOrderInFirestore;

export const rateOrderInFirestore = (orderId, rating, review, dishRatings) => orderRequest('/rate', { orderId, rating, review, ...(dishRatings ? { dishRatings } : {}) });
