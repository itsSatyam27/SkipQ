import {
  auth,
  db,
  isFirebaseConfigured,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from './firebase';
import { signInWithCustomToken, signInAnonymously, signOut } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_LOCAL_USER = '@skipq_local_user_profile_v1';
const STORAGE_APP_USER = '@skipq_user_profile_v2';
const STORAGE_USERS_MAP = '@skipq_registered_users_map';

// Check if a user already exists by phone number in Local Storage or Firestore
export async function getUserProfileByPhone(phone) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone) return null;

  // 1. Check local persistent accounts registry
  try {
    const rawMap = await AsyncStorage.getItem(STORAGE_USERS_MAP);
    if (rawMap) {
      const map = JSON.parse(rawMap);
      if (map[cleanPhone] && map[cleanPhone].name) {
        return map[cleanPhone];
      }
    }
  } catch (err) {
    console.log('Error reading local users map:', err);
  }

  // 2. Check local user profile backup
  try {
    const backupRaw = await AsyncStorage.getItem(STORAGE_LOCAL_USER);
    if (backupRaw) {
      const backup = JSON.parse(backupRaw);
      if (backup.phone && backup.phone.replace(/\D/g, '') === cleanPhone && backup.name) {
        return backup;
      }
    }
  } catch (err2) {}

  // 3. Check active app user profile
  try {
    const appUserRaw = await AsyncStorage.getItem(STORAGE_APP_USER);
    if (appUserRaw) {
      const appUser = JSON.parse(appUserRaw);
      if (appUser.phone && appUser.phone.replace(/\D/g, '') === cleanPhone && appUser.name) {
        return appUser;
      }
    }
  } catch (err3) {}

  // 4. Check Firestore users collection by phone
  if (isFirebaseConfigured && db) {
    try {
      // Check phone doc directly: users/phone_<cleanPhone>
      const phoneDocRef = doc(db, 'users', `phone_${cleanPhone}`);
      const phoneSnap = await getDoc(phoneDocRef);
      if (phoneSnap.exists()) {
        const data = phoneSnap.data();
        if (data && data.name) {
          await saveUserProfileToLocalRegistry(cleanPhone, data);
          return data;
        }
      }

      // Check current verified auth user if matching phone
      if (auth?.currentUser?.uid) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data && data.name) {
            await saveUserProfileToLocalRegistry(cleanPhone, data);
            return data;
          }
        }
      }
    } catch (fsErr) {
      console.log('Firestore getUserProfileByPhone note:', fsErr.message);
    }
  }

  return null;
}

export async function saveUserProfileToLocalRegistry(phone, profileData) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone || !profileData) return;
  try {
    const rawMap = await AsyncStorage.getItem(STORAGE_USERS_MAP);
    const map = rawMap ? JSON.parse(rawMap) : {};
    map[cleanPhone] = { ...map[cleanPhone], ...profileData, phone: cleanPhone };
    await AsyncStorage.setItem(STORAGE_USERS_MAP, JSON.stringify(map));
  } catch (e) {
    console.log('Error saving to local users registry:', e);
  }
}

export async function signInWithVerifiedOtp(customToken) {
  if (!isFirebaseConfigured || !auth) {
    return { uid: 'demo_user_uid', isAnonymous: true };
  }
  if (!customToken) throw new Error('The verification service did not return a sign-in token.');

  if (customToken.startsWith('mock_custom_token_')) {
    try {
      if (auth.currentUser) return auth.currentUser;
      const anon = await signInAnonymously(auth);
      return anon.user;
    } catch (e) {
      console.log('Firebase anon sign-in note:', e.message);
      return { uid: customToken.replace('mock_custom_token_', 'user_') };
    }
  }

  try {
    const credential = await signInWithCustomToken(auth, customToken);
    return credential.user;
  } catch (err) {
    console.log('signInWithCustomToken fallback note:', err.message);
    try {
      const anon = await signInAnonymously(auth);
      return anon.user;
    } catch (e2) {
      return { uid: `user_${Date.now()}` };
    }
  }
}

// Sign in user and sync profile to Firestore or Local Storage
export async function loginWithPhone({ phone, name, userType = 'student', universityId = 'sou', rollNo = '', facultyId = '', roomNumber = '' }) {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const authUid = auth?.currentUser?.uid || (cleanPhone ? `phone_${cleanPhone}` : `user_${Date.now()}`);
  const userDocId = authUid;

  if (isFirebaseConfigured && db) {
    try {
      const userDocRef = doc(db, 'users', userDocId);
      let existingData = {};
      try {
        const existingSnap = await getDoc(userDocRef);
        if (existingSnap.exists()) {
          existingData = existingSnap.data() || {};
        }
      } catch (getErr) {
        console.log('Firestore getDoc note:', getErr.message);
      }

      const firestorePayload = {
        uid: userDocId,
        authUid: authUid,
        phone: cleanPhone,
        name: name || 'Campus Student',
        userType,
        universityId,
        rollNo: rollNo || existingData.rollNo || '',
        facultyId: facultyId || existingData.facultyId || '',
        roomNumber: roomNumber || existingData.roomNumber || '',
        updatedAt: serverTimestamp()
      };

      if (!existingData.createdAt) {
        firestorePayload.createdAt = serverTimestamp();
      }

      // Write directly to users/<userDocId> in Firestore (excluding server-guarded keys)
      await setDoc(userDocRef, firestorePayload, { merge: true });

      const fullProfile = {
        ...firestorePayload,
        walletBalance: existingData.walletBalance === 500 ? 0 : (existingData.walletBalance ?? 0),
        unclaimedOrderCount: existingData.unclaimedOrderCount ?? 0,
        banStatus: existingData.banStatus || 'active'
      };

      await AsyncStorage.setItem(STORAGE_LOCAL_USER, JSON.stringify(fullProfile));
      await saveUserProfileToLocalRegistry(cleanPhone, fullProfile);
      return fullProfile;
    } catch (firestoreError) {
      console.log('Firestore write note:', firestoreError.message);
    }
  }

  // Fallback Local Profile
  const localProfile = {
    uid: userDocId,
    authUid: authUid,
    phone: cleanPhone,
    name: name || 'Campus Student',
    userType,
    universityId,
    rollNo: rollNo || '',
    facultyId: facultyId || '',
    roomNumber: roomNumber || '',
    walletBalance: 0,
    unclaimedOrderCount: 0,
    banStatus: 'active',
    updatedAt: new Date().toISOString()
  };

  await AsyncStorage.setItem(STORAGE_LOCAL_USER, JSON.stringify(localProfile));
  try {
    const cacheRaw = await AsyncStorage.getItem(STORAGE_USERS_MAP);
    const map = cacheRaw ? JSON.parse(cacheRaw) : {};
    map[cleanPhone] = localProfile;
    await AsyncStorage.setItem(STORAGE_USERS_MAP, JSON.stringify(map));
  } catch (cacheErr) {}
  return localProfile;
}

// Subscribe to real-time updates for a user's Firestore document
export function subscribeToUserProfile(uid, onUpdate) {
  if (!isFirebaseConfigured || !db || !uid) return () => {};

  try {
    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data());
      }
    }, (err) => {
      console.log('User profile snapshot error:', err);
    });
    return unsubscribe;
  } catch (e) {
    console.log('Error setting up user profile subscription:', e);
    return () => {};
  }
}

// Update user details in Firestore
export async function updateUserProfileDoc(uid, updates) {
  if (isFirebaseConfigured && db && uid) {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.log('Firestore user update error:', e);
    }
  }

  // Also update phone document if updates has a phone number
  if (isFirebaseConfigured && db && updates?.phone) {
    const cleanPhone = updates.phone.replace(/\D/g, '');
    if (cleanPhone && cleanPhone !== uid) {
      try {
        const phoneDocRef = doc(db, 'users', cleanPhone);
        await setDoc(phoneDocRef, {
          ...updates,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {}
    }
  }

  // Keep local storage updated
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LOCAL_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      const merged = { ...parsed, ...updates };
      await AsyncStorage.setItem(STORAGE_LOCAL_USER, JSON.stringify(merged));
    }
  } catch (err) {
    console.log('Local user update error:', err);
  }
}

// Sign out
export async function signOutUser() {
  if (isFirebaseConfigured && auth) {
    try {
      await signOut(auth);
    } catch (e) {
      console.log('Firebase signOut note:', e);
    }
  }
  await AsyncStorage.removeItem(STORAGE_LOCAL_USER);
}

// Listen for auth state changes
export function onAuthChange(callback) {
  if (!isFirebaseConfigured || !auth) return () => {};
  try {
    const { onAuthStateChanged } = require('firebase/auth');
    return onAuthStateChanged(auth, callback);
  } catch (e) {
    return () => {};
  }
}

// Sync user profile object to Firestore
export async function syncUserProfileToFirestore(userProfile) {
  if (!userProfile) return;
  const uid = userProfile.uid || (auth?.currentUser?.uid) || null;
  if (uid) {
    await updateUserProfileDoc(uid, userProfile);
  }
}
