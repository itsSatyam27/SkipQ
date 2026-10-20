import { auth, db, isFirebaseConfigured, collection, doc, setDoc, getDocs, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from './firebase';
import { runTransaction, writeBatch } from 'firebase/firestore';
import { validateSellerSettings } from './sellerSettings.cjs';
import { ensureRegisteredCanteen } from './registeredCanteen.cjs';
import { isSellerApproved } from './sellerAccess';
import { aggregateDishRatings } from '../utils/dishRatings.cjs';
export async function seedCanteensIfEmpty() {}
export async function saveSellerSettingsInFirestore(id, draft) {
  const user = await seller();
  const changes = validateSellerSettings(draft);
  const batch = writeBatch(db);
  batch.update(doc(db, 'canteens', id), { ...changes.canteen, updatedAt: serverTimestamp() });
  batch.update(doc(db, 'users', user.uid), { ...changes.profile, updatedAt: serverTimestamp() });
  await batch.commit();
  return changes;
}
export async function provisionRegisteredCanteen(campus) {
  const user = await seller();
  return ensureRegisteredCanteen({ db, uid: user.uid, campus,
    api: { collection, doc, query, where, getDocs, runTransaction, serverTimestamp } });
}
export function subscribeToCanteens(universityId, onUpdate, onError = console.warn) {
  if (!isFirebaseConfigured || !db) return () => {};
  let shops = [], disposed = false;
  const listeners = new Map(), ratings = new Map();
  const emit = () => { if (!disposed) onUpdate(shops.map(shop => ({ ...shop, dishRatings: ratings.get(shop.id) || {} }))); };
  const stop = onSnapshot(query(collection(db, 'canteens'), where('universityId', '==', universityId)), snapshot => {
    shops = snapshot.docs.map(snap => ({ ...snap.data(), id: snap.id }));
    const ids = new Set(shops.map(shop => shop.id));
    for (const [id, unsubscribe] of listeners) if (!ids.has(id)) { unsubscribe(); listeners.delete(id); ratings.delete(id); }
    for (const shop of shops) if (!listeners.has(shop.id)) {
      listeners.set(shop.id, onSnapshot(query(collection(db, 'dishReviews'), where('shopId', '==', shop.id)), result => {
        ratings.set(shop.id, aggregateDishRatings(result.docs.map(snap => snap.data()))); emit();
      }, error => { ratings.delete(shop.id); emit(); onError(error); }));
    }
    emit();
  }, onError);
  return () => { disposed = true; stop(); listeners.forEach(unsubscribe => unsubscribe()); };
}
async function seller() {
  const user = auth?.currentUser;
  if (!isFirebaseConfigured || !db || !user || !await isSellerApproved()) {
    throw new Error('Campus approval is required before managing a canteen.');
  }
  return user;
}
export async function createCanteenInFirestore(data) {
  const user = await seller();
  const ref = doc(collection(db, 'canteens'));
  const payload = { ...data, id: ref.id, ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await setDoc(ref, payload);
  return payload;
}
export async function updateCanteenInFirestore(id, fields) {
  await seller();
  if (fields.ownerId || fields.id) throw new Error('Canteen ownership cannot be changed.');
  await updateDoc(doc(db, 'canteens', id), { ...fields, updatedAt: serverTimestamp() });
}
export async function deleteCanteenFromFirestore(id) { await seller(); return deleteDoc(doc(db, 'canteens', id)); }
export const updateMenuInFirestore = (id, menu) => updateCanteenInFirestore(id, { menu });
export const createCanteen = createCanteenInFirestore;
export const updateCanteenInDb = updateCanteenInFirestore;
export const deleteCanteenFromDb = deleteCanteenFromFirestore;
export const updateMenuInDb = updateMenuInFirestore;
