import http from 'node:http';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { notificationFor } from './policy.js';

// This secret belongs only in Render's environment, never in EXPO_PUBLIC_*.
initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
const db = getFirestore();
async function bodyOf(req) {
  let value = '';
  for await (const chunk of req) { value += chunk; if (value.length > 4096) throw new Error('Request too large'); }
  return JSON.parse(value || '{}');
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  // Native apps do not require CORS. Web push is intentionally not enabled here.
  if (req.method === 'GET' && req.url === '/health') { res.end('{"ok":true}'); return; }
  try {
    if (req.method !== 'POST' || !['/devices', '/events'].includes(req.url)) { res.writeHead(404); res.end('{}'); return; }
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
    if (!bearer) throw new Error('Sign in first');
    const identity = await getAuth().verifyIdToken(bearer, true);
    if (!identity.email_verified || identity.firebase?.sign_in_provider !== 'google.com') throw new Error('Verified Google sign-in required');
    const profile = await db.doc(`users/${identity.uid}`).get();
    const user = profile.data();
    if (!user?.profileComplete || user.banStatus === 'perm_ban' || (user.banStatus === 'temp_ban' && user.banUntil?.toMillis() > Date.now())) throw new Error('Account unavailable');
    const body = await bodyOf(req);
    if (req.url === '/devices') {
      if (body.remove === true) {
        await db.doc(`pushDevices/${identity.uid}`).delete();
        res.end('{"ok":true}'); return;
      }
      if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 4096 || body.platform !== 'android') throw new Error('Invalid Android token');
      // A single current device per account; replacing it removes stale device delivery.
      await db.doc(`pushDevices/${identity.uid}`).set({ token: body.token, updatedAt: FieldValue.serverTimestamp() });
      res.end('{"ok":true}'); return;
    }
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(body.orderId || '') || !['created', 'ready'].includes(body.event)) throw new Error('Invalid order event');
    const order = (await db.doc(`orders/${body.orderId}`).get()).data();
    if (!order) throw new Error('Order missing');
    const event = notificationFor(order, identity.uid, body.event);
    const seller = (await db.doc(`sellerApprovals/${order.sellerId}`).get()).data();
    if (!seller?.approved) throw new Error('Seller approval required');
    const device = (await db.doc(`pushDevices/${event.uid}`).get()).data();
    if (!device?.token) { res.end('{"ok":true,"status":"no-device"}'); return; }
    const delivery = db.doc(`pushDeliveries/${body.orderId}_${body.event}`);
    const claimed = await db.runTransaction(async tx => {
      const old = (await tx.get(delivery)).data();
      if (old?.sentAt || old?.leaseUntil?.toMillis() > Date.now()) return false;
      tx.set(delivery, { leaseUntil: Timestamp.fromMillis(Date.now() + 120000) }); return true;
    });
    if (!claimed) { res.end('{"ok":true,"status":"already-queued"}'); return; }
    try {
      await getMessaging().send({ token: device.token, notification: { title: event.title, body: event.body }, data: { orderId: body.orderId, event: body.event }, android: { priority: 'high', notification: { channelId: 'orders', sound: 'default', tag: `${body.orderId}_${body.event}` }, ttl: 30 * 60 * 1000 } });
      await delivery.set({ sentAt: FieldValue.serverTimestamp() });
    } catch (error) {
      await delivery.delete();
      if (error.code === 'messaging/registration-token-not-registered') await db.doc(`pushDevices/${event.uid}`).delete();
      throw error;
    }
    res.end('{"ok":true}');
  } catch { res.writeHead(403); res.end('{"error":"Notification request could not be completed"}'); }
});
server.listen(Number(process.env.PORT || 3000), '0.0.0.0');
