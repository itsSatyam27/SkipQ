import http from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { notificationFor } from './policy.js';

const require = createRequire(import.meta.url);
const { createHandlers } = require('../functions/production.js');

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function bodyOf(req) {
  let value = '';
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 4096) throw requestError(413, 'Request is too large.');
  }
  try { return JSON.parse(value || '{}'); }
  catch { throw requestError(400, 'Request body must be valid JSON.'); }
}

export function createServer({ db, auth, messaging }) {
  const handlers = createHandlers({ db, auth, Timestamp });
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') { res.end('{"ok":true}'); return; }

    const isOffboarding = req.method === 'POST' && req.url === '/admin/offboard-user';
    try {
      if (isOffboarding) {
        const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
        if (!bearer) throw requestError(401, 'Sign in is required.');
        let identity;
        try { identity = await auth.verifyIdToken(bearer, true); }
        catch { throw requestError(401, 'Sign in again to continue.'); }
        if (identity.email_verified !== true || !identity.email
          || (identity.firebase?.sign_in_provider !== 'google.com' && identity.googleVerified !== true)) {
          throw requestError(403, 'Sign in with your verified Google account to continue.');
        }
        const result = await handlers.offboardUser(identity, await bodyOf(req));
        res.end(JSON.stringify(result));
        return;
      }
      if (req.method !== 'POST' || !['/devices', '/events'].includes(req.url)) {
        res.writeHead(404); res.end('{}'); return;
      }
      const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
      if (!bearer) throw new Error('Sign in first');
      const identity = await auth.verifyIdToken(bearer, true);
      if (!identity.email_verified || identity.firebase?.sign_in_provider !== 'google.com') throw new Error('Verified Google sign-in required');
      const profile = await db.doc(`users/${identity.uid}`).get();
      const user = profile.data();
      if (!user?.profileComplete || user.universityStatus === 'LEFT' || user.banStatus === 'perm_ban'
        || (user.banStatus === 'temp_ban' && user.banUntil?.toMillis() > Date.now())) throw new Error('Account unavailable');
      const body = await bodyOf(req);
      if (req.url === '/devices') {
        if (body.remove === true) {
          await db.doc(`pushDevices/${identity.uid}`).delete();
          res.end('{"ok":true}'); return;
        }
        if (typeof body.token !== 'string' || body.token.length < 20 || body.token.length > 4096 || body.platform !== 'android') throw new Error('Invalid Android token');
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
        await messaging.send({ token: device.token, notification: { title: event.title, body: event.body }, data: { orderId: body.orderId, event: body.event }, android: { priority: 'high', notification: { channelId: 'orders', sound: 'default', tag: `${body.orderId}_${body.event}` }, ttl: 30 * 60 * 1000 } });
        await delivery.set({ sentAt: FieldValue.serverTimestamp() });
      } catch (error) {
        await delivery.delete();
        if (error.code === 'messaging/registration-token-not-registered') await db.doc(`pushDevices/${event.uid}`).delete();
        throw error;
      }
      res.end('{"ok":true}');
    } catch (error) {
      const code = /^[a-zA-Z0-9/_-]{1,80}$/.test(error?.code || '') ? error.code : 'request-rejected';
      console.error('Push request failed', { path: req.url, code });
      if (isOffboarding) {
        const status = Number.isInteger(error.status) ? error.status : 500;
        res.writeHead(status);
        res.end(JSON.stringify({ code: error.status ? error.code : undefined, message: error.status ? error.message : 'The service is temporarily unavailable. Please retry.' }));
      } else {
        res.writeHead(403); res.end('{"error":"Notification request could not be completed"}');
      }
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  createServer({ db: getFirestore(), auth: getAuth(), messaging: getMessaging() })
    .listen(Number(process.env.PORT || 3000), '0.0.0.0');
}
