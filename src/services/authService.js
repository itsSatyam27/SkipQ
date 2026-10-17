import { auth, db, isFirebaseConfigured, doc, setDoc, getDoc, onSnapshot, serverTimestamp } from './firebase';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runTransaction } from 'firebase/firestore';

function session() {
  const user = auth?.currentUser;
  if (!isFirebaseConfigured || !db || !user || user.isAnonymous || !user.emailVerified || !user.email) throw new Error('Sign in with your verified Google account first.');
  return user;
}
export async function getUserProfile() {
  const user = session();
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) return null;
  const profile = { ...snapshot.data(), uid: user.uid };
  if (profile.email && profile.email !== user.email.toLowerCase()) throw new Error('Use the email linked to this account. Contact support for recovery.');
  const bannedUntil = profile.banUntil?.toMillis?.() || 0;
  if (profile.banStatus === 'perm_ban' || (profile.banStatus === 'temp_ban' && bannedUntil > Date.now())) {
    const error = new Error('This account is blocked from the platform.'); error.code = 'ACCOUNT_BLOCKED'; throw error;
  }
  return profile;
}
export async function registerAccountProfile(profile) {
  const user = session();
  const phone = String(profile.phone || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  const name = String(profile.name || '').trim();
  if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('Enter a valid 10-digit Indian mobile number.');
  if (!name || name.length > 100 || !['student', 'faculty', 'seller'].includes(profile.userType)) throw new Error('Enter your name and choose a campus role.');
  const userRef = doc(db, 'users', user.uid);
  const claimRef = doc(db, 'phoneClaims', phone);
  return runTransaction(db, async transaction => {
    const previous = await transaction.get(userRef);
    const claim = await transaction.get(claimRef);
    if (previous.exists()) {
      const existing = await getUserProfile();
      if (existing.phone !== phone || existing.email !== user.email.toLowerCase() || existing.userType !== profile.userType) throw new Error('Your registered email, phone and campus role cannot be changed.');
      if (!existing.profileComplete) throw new Error('This legacy account needs administrator migration before profile setup.');
      return existing;
    }
    if (claim.exists()) { const error = new Error('This phone number is already linked to another account. Please use a different number.'); error.code = 'PHONE_ALREADY_LINKED'; throw error; }
    const { sellerShopId: ignoredShopId, ...editable } = safeFields(profile);
    const saved = { ...editable, uid: user.uid, authUid: user.uid, name, phone, email: user.email.toLowerCase(),
      userType: profile.userType, emailVerified: true, phoneVerified: false, profileComplete: true,
      walletBalance: 0, banStatus: 'active', unclaimedOrderCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    // Rules require both creates together, and reject replacement of an existing claim.
    transaction.set(userRef, saved);
    transaction.set(claimRef, { claimed: true, createdAt: serverTimestamp() });
    return saved;
  }).catch(error => {
    if (error.code === 'permission-denied') throw new Error('Profile setup was denied. Publish the current Firestore rules, then try again.');
    throw error;
  });
}
const EDITABLE = ['name', 'rollNo', 'facultyId', 'roomNumber', 'facultyRoomNote', 'universityId', 'stallName', 'stallLocation', 'merchantUpi', 'sellerShopId'];
const safeFields = source => Object.fromEntries(EDITABLE.filter(key => source[key] !== undefined).map(key => [key, String(source[key]).trim().slice(0, 300)]));
export function subscribeToUserProfile(uid, onUpdate, onError = console.warn) {
  if (!isFirebaseConfigured || !db || uid !== auth?.currentUser?.uid) return () => {};
  return onSnapshot(doc(db, 'users', uid), snap => { if (snap.exists()) onUpdate({ ...snap.data(), uid }); }, onError);
}
export async function updateUserProfileDoc(uid, updates) {
  const user = session();
  if (uid !== user.uid) throw new Error('You can only edit your own profile.');
  const existing = await getUserProfile();
  for (const key of ['email', 'phone', 'userType']) {
    if (updates[key] !== undefined && updates[key] !== existing?.[key]) throw new Error(`Your linked ${key === 'userType' ? 'account type' : key} cannot be changed.`);
  }
  await setDoc(doc(db, 'users', uid), { ...safeFields(updates), updatedAt: serverTimestamp() }, { merge: true });
}
export async function syncUserProfileToFirestore(profile) { return updateUserProfileDoc(session().uid, profile); }
export function onAuthChange(callback) { return auth ? onAuthStateChanged(auth, callback) : () => {}; }
export async function signOutUser() {
  if (auth) await signOut(auth);
  await AsyncStorage.multiRemove(['@skipq_local_user_profile_v1', '@skipq_registered_users_map', '@skipq_user_profile_v2', '@skipq_orders_v2', '@skipq_wallet_bal_v2', '@skipq_active_pass_v2']);
}
