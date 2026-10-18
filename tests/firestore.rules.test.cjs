const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, Timestamp } = require('firebase/firestore');
const { createSparkOrders } = require('../src/services/sparkOrders.cjs');
const { runTransaction } = require('firebase/firestore');
const { ensureRegisteredCanteen } = require('../src/services/registeredCanteen.cjs');
let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-skipq', firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 } }); });
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'orders/order'), { buyerId: 'buyer', sellerId: 'seller', shopId: 'shop', pickupPin: '1234' });
    await setDoc(doc(context.firestore(), 'users/buyer'), { uid: 'buyer', authUid: 'buyer', phone: '9876543210', email: 'buyer@example.com', profileComplete: true, name: 'Student', userType: 'student', walletBalance: 0, banStatus: 'active' });
    await setDoc(doc(context.firestore(), 'users/seller'), { uid: 'seller', name: 'Seller', email: 'seller@example.com', phone: '8765432109', userType: 'seller', profileComplete: true, banStatus: 'active' });
    await setDoc(doc(context.firestore(), 'sellerApprovals/seller'), { approved: true });
    await setDoc(doc(context.firestore(), 'canteens/shop'), { id: 'shop', ownerId: 'seller', name: 'Canteen', status: 'Open', upiId: 'canteen@upi', menu: [{ id: 'dish', name: 'Sandwich', price: 25, isAvailable: true }], lat: 23, lng: 72 });
  });
});
const db = (uid, claims = {}) => env.authenticatedContext(uid, { email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...claims }).firestore();

async function grantAdmin() {
  await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(),'admins/owner'),{enabled:true}));
  return db('owner');
}
function adminBlock(client, uid='buyer', audited=true) {
  const batch=writeBatch(client);
  batch.update(doc(client,'users',uid),{banStatus:'perm_ban',banUntil:null,banReason:'Repeated abuse',updatedAt:serverTimestamp(),adminActionId:'block-log'});
  if(audited)batch.set(doc(client,'adminAudit/block-log'),{actorUid:'owner',targetType:'users',targetId:uid,action:'perm_ban',reason:'Repeated abuse',createdAt:serverTimestamp()});
  return batch.commit();
}
test('only provisioned verified admins can list platform data; clients cannot grant admin',async()=>{
  const owner=await grantAdmin();
  await assertSucceeds(getDocs(collection(owner,'users')));
  await assertSucceeds(getDocs(collection(owner,'sellerRequests')));
  await assertSucceeds(getDocs(collection(owner,'orders')));
  await assertFails(getDocs(collection(db('buyer'),'users')));
  await assertFails(setDoc(doc(db('buyer'),'admins/buyer'),{enabled:true}));
  await assertFails(getDocs(collection(db('owner',{email_verified:false}),'users')));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'admins/owner'),{enabled:false}));
  await assertFails(getDocs(collection(owner,'users')));
});
test('admin bans require immutable atomic history and cannot change contacts or block admins',async()=>{
  const owner=await grantAdmin();
  await assertFails(adminBlock(owner,'buyer',false));
  await assertFails(adminBlock(db('buyer')));
  await assertSucceeds(adminBlock(owner));
  await assertFails(updateDoc(doc(owner,'adminAudit/block-log'),{reason:'Changed'}));
  await assertFails(updateDoc(doc(owner,'users/buyer'),{email:'replaced@example.com'}));
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users/owner'),{name:'Owner'}));
  await assertFails(adminBlock(owner,'owner'));
  await assertFails(getDoc(doc(db('buyer'),'orders/order')));
});
test('seller approval is admin-only, atomic with request review and audit; blocked sellers fail',async()=>{
  const owner=await grantAdmin();
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sellerRequests/seller'),{userId:'seller',status:'PENDING'}));
  const review=client=>{const batch=writeBatch(client);batch.update(doc(client,'sellerRequests/seller'),{status:'APPROVED',reviewedBy:'owner',reviewReason:'Verified campus counter',updatedAt:serverTimestamp(),adminActionId:'review-log'});batch.set(doc(client,'sellerApprovals/seller'),{approved:true,reviewedBy:'owner',updatedAt:serverTimestamp(),adminActionId:'review-log'});batch.set(doc(client,'adminAudit/review-log'),{actorUid:'owner',targetType:'sellerRequests',targetId:'seller',action:'APPROVED',reason:'Verified campus counter',createdAt:serverTimestamp()});return batch.commit();};
  await assertFails(review(db('seller')));
  await assertFails(setDoc(doc(owner,'sellerApprovals/seller'),{approved:true,reviewedBy:'owner',updatedAt:serverTimestamp(),adminActionId:'missing'}));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users/seller'),{banStatus:'perm_ban'}));
  await assertFails(review(owner));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users/seller'),{banStatus:'active'}));
  await assertSucceeds(review(owner));
});
test('activity is self-owned, timestamp constrained, and cannot alter authorization',async()=>{
  await assertSucceeds(updateDoc(doc(db('buyer'),'users/buyer'),{lastActiveAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(db('stranger'),'users/buyer'),{lastActiveAt:serverTimestamp()}));
  await assertFails(updateDoc(doc(db('buyer'),'users/buyer'),{lastActiveAt:Timestamp.fromMillis(Date.now()+86400000)}));
});
test('left-university profiles retain their own profile but cannot use protected app data',async()=>{
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'users/buyer'),{universityStatus:'LEFT'}));
  await assertSucceeds(getDoc(doc(db('buyer'),'users/buyer')));
  await assertFails(updateDoc(doc(db('buyer'),'users/buyer'),{lastActiveAt:serverTimestamp()}));
  await assertFails(getDoc(doc(db('buyer'),'orders/order')));
});
function provision(client) {
  return ensureRegisteredCanteen({db:client,uid:'seller',campus:{id:'sou',lat:23,lng:72},
    api:{doc,collection,query,where,getDocs,runTransaction,serverTimestamp}});
}
test('approval provisions saved registration once across concurrent retries and preserves menu',async()=>{
  await env.withSecurityRulesDisabled(async c=>{
    const client=c.firestore();
    await updateDoc(doc(client,'users/seller'),{universityId:'sou',stallName:'Profile counter',stallLocation:'Block B',merchantUpi:'profile@upi'});
    await setDoc(doc(client,'sellerRequests/seller'),{userId:'seller',status:'APPROVED',stallName:'Registered counter',location:'Block A',upiId:'counter@upi'});
    const {deleteDoc}=require('firebase/firestore');await deleteDoc(doc(client,'canteens/shop'));
  });
  const [first,second]=await Promise.all([provision(db('seller')),provision(db('seller'))]);
  assert.equal(first.id,second.id);
  assert.equal(first.name,'Registered counter');assert.equal(first.location,'Block A');assert.equal(first.upiId,'counter@upi');
  assert.equal((await getDocs(collection(db('seller'),'canteens'))).size,1);
  await updateDoc(doc(db('seller'),'canteens',first.id),{menu:[{name:'Existing dish',price:40,isAvailable:true}]});
  const again=await provision(db('seller'));assert.equal(again.menu[0].name,'Existing dish');
  assert.equal((await getDoc(doc(db('seller'),'users/seller'))).data().sellerShopId,first.id);
});
test('provision links an existing owned campus canteen instead of creating duplicates, and rejects unapproved sellers',async()=>{
  await env.withSecurityRulesDisabled(async c=>{
    await updateDoc(doc(c.firestore(),'users/seller'),{universityId:'sou',stallName:'Profile counter'});
    await updateDoc(doc(c.firestore(),'canteens/shop'),{universityId:'sou'});
  });
  assert.equal((await provision(db('seller'))).id,'shop');
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'sellerApprovals/seller'),{approved:false}));
  await assert.rejects(provision(db('seller')),/Approved seller registration/);
});
test('only the buyer and assigned approved seller can read an order', async () => {
  await assertSucceeds(getDoc(doc(db('buyer'), 'orders/order')));
  await assertSucceeds(getDoc(doc(db('seller', { seller: true }), 'orders/order')));
  await assertSucceeds(getDoc(doc(db('seller'), 'orders/order')));
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'sellerApprovals/seller'), { approved: false }));
  await assertFails(getDoc(doc(db('seller'), 'orders/order')));
  await assertFails(getDoc(doc(db('stranger'), 'orders/order')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'orders/order')));
});
test('scoped queries succeed and an unrestricted order list is denied', async () => {
  await assertSucceeds(getDocs(query(collection(db('buyer'), 'orders'), where('buyerId', '==', 'buyer'))));
  await assertSucceeds(getDocs(query(collection(db('seller', { seller: true }), 'orders'), where('sellerId', '==', 'seller'))));
  await assertFails(getDocs(collection(db('buyer'), 'orders')));
});
test('unvalidated direct order creation and PIN bypass are denied', async () => {
  await assertFails(setDoc(doc(db('buyer'), 'orders/fake'), { buyerId: 'buyer', totalAmount: 1 }));
  await assertFails(updateDoc(doc(db('seller', { seller: true }), 'orders/order'), { orderStatus: 'Completed' }));
});
test('wallet balances and bans are server-owned but profile names are editable', async () => {
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { walletBalance: 10000 }));
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { banStatus: 'active', banUntil: null }));
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { phone: '9999999999' }));
  await assertSucceeds(updateDoc(doc(db('buyer'), 'users/buyer'), { name: 'Updated name' }));
});
test('canteen changes require seller approval and immutable ownership', async () => {
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'sellerApprovals/seller'), { approved: false }));
  await assertFails(updateDoc(doc(db('seller'), 'canteens/shop'), { name: 'Changed' }));
  await assertFails(updateDoc(doc(db('stranger', { seller: true }), 'canteens/shop'), { name: 'Changed' }));
  await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'sellerApprovals/seller'), { approved: true }));
  await assertSucceeds(updateDoc(doc(db('seller', { seller: true }), 'canteens/shop'), { name: 'Changed' }));
  await assertFails(updateDoc(doc(db('seller', { seller: true }), 'canteens/shop'), { ownerId: 'stranger' }));
});
test('seller settings save profile and owned canteen atomically; wrong canteen cannot partially update profile',async()=>{
  const seller=db('seller');
  const save=id=>{const batch=writeBatch(seller);batch.update(doc(seller,'users/seller'),{name:'Updated operator',stallName:'Updated counter',stallLocation:'Block B',merchantUpi:'counter@bank',updatedAt:serverTimestamp()});batch.update(doc(seller,'canteens',id),{name:'Updated counter',location:'Block B',upiId:'counter@bank',openingHours:'8 AM - 8 PM',status:'Closed',updatedAt:serverTimestamp()});return batch.commit();};
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'canteens/foreign'),{id:'foreign',ownerId:'other',name:'Other canteen',menu:[],lat:23,lng:72}));
  await assertFails(save('foreign'));
  assert.equal((await getDoc(doc(seller,'users/seller'))).data().name,'Seller');
  await assertSucceeds(save('shop'));
  assert.equal((await getDoc(doc(seller,'users/seller'))).data().name,'Updated operator');
  assert.equal((await getDoc(doc(seller,'canteens/shop'))).data().status,'Closed');
});
test('phone link registry, login handoffs, and other profiles remain private', async () => {
  await assertFails(getDoc(doc(db('stranger'), 'users/buyer')));
  await assertFails(getDoc(doc(db('buyer'), 'phoneLinks/private')));
  await assertFails(setDoc(doc(db('buyer'), 'phoneLinks/fake'), { codeHash: 'fake' }));
});

test('Google accounts without a completed profile cannot use orders or seller features', async () => {
  await assertFails(getDocs(collection(db('new-user'), 'orders')));
  await assertFails(setDoc(doc(db('new-user', { seller: true }), 'canteens/fake'), { id: 'fake', ownerId: 'new-user', name: 'Fake', menu: [], lat: 23, lng: 72 }));
  await assertFails(setDoc(doc(db('new-user'), 'users/new-user'), { uid: 'new-user', name: 'Fake', phone: '9999999999', email: 'new-user@example.com', userType: 'student', profileComplete: true }));
});
test('email, account type and registration state cannot be changed from the app', async () => {
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { email: 'another@example.com' }));
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { userType: 'seller' }));
  await assertFails(updateDoc(doc(db('buyer'), 'users/buyer'), { profileComplete: false }));
  await assertFails(getDoc(doc(db('buyer'), 'mobileLogins/private')));
});

function register(uid, phone, overrides = {}, claim = true) {
  const store = db(uid);
  const batch = writeBatch(store);
  batch.set(doc(store, 'users', uid), { uid, authUid: uid, name: 'New user', email: `${uid}@example.com`, phone, userType: 'student',
    emailVerified: true, phoneVerified: false, profileComplete: true, walletBalance: 0, banStatus: 'active', unclaimedOrderCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides });
  if (claim) batch.set(doc(store, 'phoneClaims', phone), { claimed: true, createdAt: serverTimestamp() });
  return batch.commit();
}
test('Spark profile registration and phone claim must be atomic and privileged fields cannot be forged', async () => {
  await assertFails(register('missing-claim', '9999999991', {}, false));
  await assertFails(register('forged-wallet', '9999999992', { walletBalance: 1000 }));
  await assertFails(register('forged-email', '9999999993', { email: 'another@example.com' }));
  await assertFails(register('forged-verification', '9999999994', { phoneVerified: true }));
  await assertSucceeds(register('new-google', '9999999995'));
  await assertFails(register('other-google', '9999999995'));
  await assertSucceeds(register('other-google', '9999999996'));
});
test('concurrent Google registrations yield only one phone owner; banned claims cannot be released', async () => {
  const outcomes = await Promise.allSettled([register('first', '9999999990'), register('second', '9999999990')]);
  require('node:assert/strict').equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
  await assertFails(require('firebase/firestore').deleteDoc(doc(db('first'), 'phoneClaims/9999999990')));
  await assertFails(getDocs(collection(db('buyer'), 'phoneClaims')));
  await assertFails(setDoc(doc(db('buyer'), 'phoneClaims/8888888888'), { claimed: true, createdAt: serverTimestamp() }));
});
const orderBody = (requestId = 'request') => ({ requestId, shopId: 'shop', items: [{ id: 'dish', qty: 2 }], paymentMethod: 'Cash', staffRoomDelivery: false, facultyRoomNote: '', location: { lat: 23, lng: 72, accuracy: 10 } });
test('temporary location access is scoped, expires, cannot be self-granted, and does not bypass bans or seller approval',async()=>{
  const buyer=createSparkOrders(db('buyer'),'buyer');
  const body={...orderBody('test-location'),location:null,testOrder:true};
  await assertFails(buyer.create(body));
  await assertFails(setDoc(doc(db('buyer'),'locationTestAccess/buyer'),{enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)}));
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'locationTestAccess/buyer'),{enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)}));
  const order=await assertSucceeds(buyer.create(body));assert.equal(order.testOrder,true);assert.equal(order.location,null);
  await assertFails(buyer.create({...orderBody('missing-test-label'),location:null}));
  await env.withSecurityRulesDisabled(c=>updateDoc(doc(c.firestore(),'locationTestAccess/buyer'),{expiresAt:Timestamp.fromMillis(Date.now()-1000)}));
  await assertFails(buyer.create({...body,requestId:'expired-test'}));
  await env.withSecurityRulesDisabled(async c=>{
    await updateDoc(doc(c.firestore(),'locationTestAccess/buyer'),{expiresAt:Timestamp.fromMillis(Date.now()+3600000)});
    await updateDoc(doc(c.firestore(),'users/buyer'),{banStatus:'perm_ban'});
  });
  await assertFails(buyer.create({...body,requestId:'banned-test'}));
  await env.withSecurityRulesDisabled(async c=>{
    await updateDoc(doc(c.firestore(),'users/buyer'),{banStatus:'active'});
    await updateDoc(doc(c.firestore(),'sellerApprovals/seller'),{approved:false});
  });
  await assertFails(buyer.create({...body,requestId:'unapproved-test'}));
});
test('Spark orders use menu prices, retry safely and keep the PIN private from sellers', async () => {
  const buyer = createSparkOrders(db('buyer'), 'buyer');
  const order = await assertSucceeds(buyer.create(orderBody()));
  require('node:assert/strict').equal(order.totalAmount, 50);
  require('node:assert/strict').equal((await buyer.create(orderBody())).id, order.id);
  await assertFails(getDoc(doc(db('seller', { seller: true }), `users/buyer/pickupSecrets/${order.id}`)));
  require('node:assert/strict').equal((await getDoc(doc(db('seller', { seller: true }), 'orders', order.id))).data().pickupPin, undefined);
  const forged = { ...(await getDoc(doc(db('buyer'), 'orders', order.id))).data(), id: 'forged', totalAmount: 1, dueAtCounter: 1 };
  await assertFails(setDoc(doc(db('buyer'), 'orders/forged'), forged));
  await assert.rejects(buyer.create({ ...orderBody('wallet'), paymentMethod: 'Wallet' }));
  await assertFails(buyer.create({ ...orderBody('far'), location: { lat: 20, lng: 70, accuracy: 10 } }));
});
test('faculty staff-room delivery is authorized and adds exactly five rupees', async () => {
  const buyer = createSparkOrders(db('buyer'), 'buyer');
  await assertFails(buyer.create({ ...orderBody('staff-room-student'), staffRoomDelivery: true, facultyRoomNote: 'E Block - 501' }));
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(), 'users/buyer'), { userType: 'faculty' }));
  await assertFails(buyer.create({ ...orderBody('staff-room-missing'), staffRoomDelivery: true }));
  const order = await assertSucceeds(buyer.create({ ...orderBody('staff-room-faculty'), staffRoomDelivery: true, facultyRoomNote: 'E Block - 501' }));
  assert.equal(order.totalAmount, 55);
  assert.equal(order.deliveryFee, 5);
  const forged = { ...(await getDoc(doc(db('buyer'), 'orders', order.id))).data(), id: 'forged-fee', totalAmount: 60, deliveryFee: 10, dueAtCounter: 60, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db('buyer'));
  batch.set(doc(db('buyer'), 'orders/forged-fee'), forged);
  batch.set(doc(db('buyer'), 'users/buyer/pickupSecrets/forged-fee'), { pin: '1234', createdAt: serverTimestamp() });
  await assertFails(batch.commit());
});
test('Spark pickup cannot bypass the private PIN or readiness; five wrong PINs lock further attempts', async () => {
  const order = await createSparkOrders(db('buyer'), 'buyer').create(orderBody());
  const seller = createSparkOrders(db('seller', { seller: true }), 'seller');
  await assertFails(updateDoc(doc(db('seller', { seller: true }), 'orders', order.id), { orderStatus: 'Completed', completedAt: serverTimestamp(), updatedAt: serverTimestamp(), paymentStatus: 'CASH_COLLECTED' }));
  await assertSucceeds(seller.change('/status', { orderId: order.id, status: 'Ready for Pickup' }));
  const wrong = order.pickupPin === '0000' ? '9999' : '0000';
  for (let i = 0; i < 5; i++) await assert.rejects(seller.change('/verify-pickup', { orderId: order.id, pin: wrong }));
  require('node:assert/strict').equal((await getDoc(doc(db('buyer'), 'orders', order.id))).data().pickupAttempts, 5);
  await assert.rejects(seller.change('/verify-pickup', { orderId: order.id, pin: order.pickupPin }));
  await assertFails(updateDoc(doc(db('seller', { seller: true }), 'pickupVerifications', order.id), { pin: order.pickupPin }));
});
test('Spark new orders are cash-only; legacy UPI orders still require seller confirmation', async () => {
  const buyer = createSparkOrders(db('buyer'), 'buyer');
  const seller = createSparkOrders(db('seller', { seller: true }), 'seller');
  const cash = await buyer.create(orderBody('cash'));
  require('node:assert/strict').equal(cash.advanceAmount, 0);
  require('node:assert/strict').equal(cash.dueAtCounter, 50);
  require('node:assert/strict').equal(cash.advancePaymentStatus, 'NOT_REQUIRED');
  await assert.rejects(buyer.create({ ...orderBody('upi-disabled'), paymentMethod: 'UPI' }), /coming soon/);
  await seller.change('/status', { orderId: cash.id, status: 'Ready for Pickup' });
  await assertSucceeds(seller.change('/verify-pickup', { orderId: cash.id, pin: cash.pickupPin }));

  const upi = await buyer.create(orderBody('legacy-upi'));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orders', upi.id), {
    paymentMethod: 'UPI', paymentStatus: 'PENDING_MERCHANT_CONFIRMATION', dueAtCounter: 0
  }));
  await seller.change('/status', { orderId: upi.id, status: 'Ready for Pickup' });
  await assert.rejects(seller.change('/verify-pickup', { orderId: upi.id, pin: upi.pickupPin }));
  await seller.change('/confirm-payment', { orderId: upi.id });
  await assertSucceeds(seller.change('/verify-pickup', { orderId: upi.id, pin: upi.pickupPin }));

  const cancelled = await buyer.create(orderBody('legacy-cancel-upi'));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orders', cancelled.id), {
    paymentMethod: 'UPI', paymentStatus: 'PENDING_MERCHANT_CONFIRMATION', dueAtCounter: 0
  }));
  await seller.change('/confirm-payment', { orderId: cancelled.id });
  const result = await buyer.change('/cancel', { orderId: cancelled.id });
  require('node:assert/strict').equal(result.order.refundStatus, 'MERCHANT_REFUND_REQUIRED');
  await assert.rejects(seller.change('/status', { orderId: cancelled.id, status: 'Ready for Pickup' }));
  const cashCancelled = await buyer.create(orderBody('cancel-cash'));
  const cashRefund = await buyer.change('/cancel', { orderId: cashCancelled.id });
  require('node:assert/strict').equal(cashRefund.order.refundAmount, 0);
  require('node:assert/strict').equal(cashRefund.order.advanceRefundStatus, 'NOT_REQUIRED');
});
test('Spark maximum-size checkout remains within rule evaluation limits', async () => {
  const menu = Array.from({ length: 10 }, (_, index) => ({ id: `dish${index}`, name: `Dish ${index}`, price: 25 + index, isAvailable: true }));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'canteens/shop'), { menu }));
  const body = { ...orderBody('max-cart'), items: menu.slice(5).map(dish => ({ id: dish.id, qty: 1 })) };
  const result = await assertSucceeds(createSparkOrders(db('buyer'), 'buyer').create(body));
  assert.equal(result.totalAmount, 160);
  await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'locationTestAccess/buyer'),{enabled:true,expiresAt:Timestamp.fromMillis(Date.now()+3600000)}));
  const testOrder=await assertSucceeds(createSparkOrders(db('buyer'),'buyer').create({...body,requestId:'max-test-cart',testOrder:true,location:null}));
  assert.equal(testOrder.totalAmount,160); assert.equal(testOrder.testOrder,true);
  await assert.rejects(createSparkOrders(db('buyer'), 'buyer').create({ ...body, requestId: 'too-many', items: menu.map(dish => ({ id: dish.id, qty: 1 })) }), /up to 5/);
});
test('Spark banned buyers and unapproved canteens cannot place orders', async () => {
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'users/buyer'), { banStatus: 'perm_ban' }));
  await assertFails(createSparkOrders(db('buyer'), 'buyer').create(orderBody('banned')));
  await env.withSecurityRulesDisabled(async context => {
    await updateDoc(doc(context.firestore(), 'users/buyer'), { banStatus: 'active' });
    await updateDoc(doc(context.firestore(), 'sellerApprovals/seller'), { approved: false });
  });
  await assertFails(createSparkOrders(db('buyer'), 'buyer').create(orderBody('unapproved')));
});
test('Spark no-show requires 15 minutes and records an unclaimed order without changing bans', async () => {
  const buyer = createSparkOrders(db('buyer'), 'buyer');
  const seller = createSparkOrders(db('seller', { seller: true }), 'seller');
  const order = await buyer.create(orderBody('unclaimed'));
  await seller.change('/status', { orderId: order.id, status: 'Ready for Pickup' });
  await assert.rejects(seller.change('/abandon', { orderId: order.id }));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orders', order.id), { readyAt: Timestamp.fromMillis(Date.now() - 14 * 60 * 1000) }));
  await assert.rejects(seller.change('/abandon', { orderId: order.id }));
  await env.withSecurityRulesDisabled(context => updateDoc(doc(context.firestore(), 'orders', order.id), { readyAt: Timestamp.fromMillis(Date.now() - 16 * 60 * 1000) }));
  await assertSucceeds(seller.change('/abandon', { orderId: order.id }));
  await assertSucceeds(seller.change('/abandon', { orderId: order.id }));
  assert.equal((await getDoc(doc(db('buyer'), 'orders', order.id))).data().advanceRefundStatus, 'NOT_APPLICABLE');
  assert.equal((await getDoc(doc(db('buyer'), 'users/buyer'))).data().banStatus, 'active');
});
