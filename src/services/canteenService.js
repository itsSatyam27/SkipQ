import {
  auth,
  db,
  isFirebaseConfigured,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from './firebase';

// Production: No dummy canteens are seeded. Canteens must be created by real vendors.
export async function seedCanteensIfEmpty() {
  return;
}

// Subscribe to real-time canteens updates for a campus
export function subscribeToCanteens(param1, param2) {
  if (!isFirebaseConfigured || !db) return () => {};

  let universityId = 'sou';
  let onUpdate = () => {};

  if (typeof param1 === 'function') {
    onUpdate = param1;
    if (typeof param2 === 'string') universityId = param2;
  } else {
    if (typeof param1 === 'string') universityId = param1;
    if (typeof param2 === 'function') onUpdate = param2;
  }

  try {
    const canteensRef = collection(db, 'canteens');
    const q = universityId
      ? query(canteensRef, where('universityId', '==', universityId))
      : canteensRef;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      onUpdate(list);
    }, (error) => {
      console.log('Firestore canteens subscription note:', error.message);
    });

    return unsubscribe;
  } catch (e) {
    console.log('Error setting up canteens listener:', e);
    return () => {};
  }
}

// Create a new canteen in Firestore
export async function createCanteenInFirestore(canteenData) {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const id = canteenData.id || `shop-${Date.now().toString().slice(-4)}`;
    const canteenDocRef = doc(db, 'canteens', id);
    const ownerId = canteenData.ownerId || auth?.currentUser?.uid || 'vendor_user';
    const payload = {
      ...canteenData,
      id,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(canteenDocRef, payload, { merge: true });
    return payload;
  } catch (e) {
    console.log('Error creating canteen in Firestore:', e);
    return null;
  }
}

// Update canteen fields
export async function updateCanteenInFirestore(canteenId, updatedFields) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const canteenDocRef = doc(db, 'canteens', canteenId);
    await setDoc(canteenDocRef, {
      ...updatedFields,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.log('Error updating canteen in Firestore:', e);
  }
}

// Delete canteen
export async function deleteCanteenFromFirestore(canteenId) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const canteenDocRef = doc(db, 'canteens', canteenId);
    await deleteDoc(canteenDocRef);
  } catch (e) {
    console.log('Error deleting canteen from Firestore:', e);
  }
}

// Update menu array on canteen
export async function updateMenuInFirestore(canteenId, newMenuArray) {
  if (!isFirebaseConfigured || !db) return;

  try {
    const canteenDocRef = doc(db, 'canteens', canteenId);
    await setDoc(canteenDocRef, {
      menu: newMenuArray,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.log('Error updating menu in Firestore:', e);
  }
}

// Clean aliases for AppContext
export const createCanteen = createCanteenInFirestore;
export const updateCanteenInDb = updateCanteenInFirestore;
export const deleteCanteenFromDb = deleteCanteenFromFirestore;
export const updateMenuInDb = updateMenuInFirestore;

