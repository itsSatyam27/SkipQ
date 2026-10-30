import * as Crypto from 'expo-crypto';
import { Timestamp, runTransaction } from 'firebase/firestore';
import { auth, db, doc, getDoc, serverTimestamp } from './firebase';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);

async function code() {
  const bytes = await Crypto.getRandomBytesAsync(8);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

export async function createPickupInvite(orderId) {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Sign in before sharing pickup access.');
  const orderRef = doc(db, 'orders', orderId);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inviteCode = await code();
    const inviteRef = doc(db, 'pickupInvites', inviteCode);
    try {
      await runTransaction(db, async tx => {
        const [order, existing] = await Promise.all([tx.get(orderRef), tx.get(inviteRef)]);
        if (!order.exists() || order.data().buyerId !== user.uid) throw new Error('Only the buyer can share this order.');
        if (!['Preparing', 'Ready for Pickup'].includes(order.data().orderStatus)) throw new Error('Only an active order can be shared.');
        if (existing.exists()) throw new Error('CODE_COLLISION');
        tx.set(inviteRef, { orderId, ownerId: user.uid, status: 'PENDING', expiresAt: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000), createdAt: serverTimestamp() });
      });
      return inviteCode;
    } catch (error) { if (error.message !== 'CODE_COLLISION') throw error; }
  }
  throw new Error('Could not create a secure pickup code. Please retry.');
}

export async function acceptPickupInvite(value, collectorName) {
  const user = auth?.currentUser;
  const inviteCode = normalize(value);
  if (!user || !db) throw new Error('Sign in before accepting pickup access.');
  if (inviteCode.length !== 8) throw new Error('Enter the 8-character pickup code.');
  const inviteRef = doc(db, 'pickupInvites', inviteCode);
  return runTransaction(db, async tx => {
    const invite = await tx.get(inviteRef);
    if (!invite.exists()) throw new Error('Pickup code not found. Check the code and retry.');
    const data = invite.data();
    if (data.ownerId === user.uid) throw new Error('This is your own order.');
    if (data.status !== 'PENDING' || data.expiresAt?.toMillis?.() <= Date.now()) throw new Error('This pickup code has expired or was revoked.');
    const order = await tx.get(doc(db, 'orders', data.orderId));
    if (!order.exists() || !['Preparing', 'Ready for Pickup'].includes(order.data().orderStatus)) throw new Error('This order is no longer available.');
    tx.set(doc(db, 'pickupDelegations', data.orderId), { orderId: data.orderId, ownerId: data.ownerId, collectorId: user.uid, collectorName: String(collectorName || '').trim().slice(0, 100), inviteCode, status: 'ACCEPTED', acceptedAt: serverTimestamp(), expiresAt: data.expiresAt });
    tx.update(inviteRef, { status: 'ACCEPTED', collectorId: user.uid, acceptedAt: serverTimestamp() });
    tx.update(doc(db, 'orders', data.orderId), { delegatedCollectorId: user.uid, delegatedCollectorName: String(collectorName || '').trim().slice(0, 100), delegationStatus: 'ACCEPTED', delegationAcceptedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return data.orderId;
  });
}

export async function revokePickupDelegation(orderId) {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Sign in first.');
  const ref = doc(db, 'pickupDelegations', orderId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists() || snapshot.data().ownerId !== user.uid) throw new Error('No active roommate pickup was found.');
  return runTransaction(db, async tx => { tx.update(ref, { status: 'REVOKED', revokedAt: serverTimestamp() }); tx.update(doc(db,'orders',orderId),{delegationStatus:'REVOKED',delegationRevokedAt:serverTimestamp(),updatedAt:serverTimestamp()}); });
}
