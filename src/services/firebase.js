import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_CUSTOM_FIREBASE_CONFIG = '@skipq_custom_firebase_config_v1';

// Firebase web configuration identifies the project; it is not a secret. Service
// credentials, provider keys, and privileged operations must never be in this app.
const envConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || ''
};


let app = null;
let auth = null;
let db = null;
let isFirebaseConfigured = false;
let currentConfig = { ...envConfig };

// Helper to check if a config object has real credentials
export function isValidFirebaseConfig(cfg) {
  if (!cfg) return false;
  const { apiKey, projectId } = cfg;
  return (
    Boolean(apiKey) &&
    Boolean(projectId) &&
    apiKey !== 'your_api_key_here' &&
    !apiKey.includes('placeholder')
  );
}

export function getFirebaseStatus() {
  return {
    isConfigured: isFirebaseConfigured,
    projectId: currentConfig?.projectId || '',
    hasCredentials: isValidFirebaseConfig(currentConfig)
  };
}


// Initialize Firebase with given or default config
export function setupFirebase(cfg = envConfig) {
  if (!isValidFirebaseConfig(cfg)) {
    isFirebaseConfigured = false;
    return { isConfigured: false, app: null, auth: null, db: null };
  }

  try {
    if (getApps().length === 0) {
      app = initializeApp(cfg);
    } else {
      app = getApp();
    }

    // Configure Auth persistence
    if (!auth) {
      if (Platform.OS === 'web') {
        auth = getAuth(app);
      } else {
        try {
          auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage)
          });
        } catch (e) {
          auth = getAuth(app);
        }
      }
    }

    // Configure Firestore with offline persistent cache for resilient offline pickup pass access
    if (!db) {
      try {
        if (Platform.OS === 'web') {
          db = initializeFirestore(app, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager()
            })
          });
        } else {
          db = initializeFirestore(app, {
            localCache: persistentLocalCache({})
          });
        }
      } catch (e) {
        // Fallback to default getFirestore if already initialized or unsupported
        db = getFirestore(app);
      }
    }

    isFirebaseConfigured = true;
    currentConfig = cfg;
    console.log('Firebase successfully initialized for project:', cfg.projectId);
    return { isConfigured: true, app, auth, db };

  } catch (error) {
    console.warn('Firebase initialization note:', error.message);
    isFirebaseConfigured = false;
    return { isConfigured: false, app: null, auth: null, db: null };
  }
}

// Auto-run initialization on module import
setupFirebase(envConfig);

// Asynchronously check for custom config stored in AsyncStorage
export async function loadPersistedFirebaseConfig() {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_CUSTOM_FIREBASE_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (isValidFirebaseConfig(parsed)) {
        return setupFirebase(parsed);
      }
    }
  } catch (e) {
    console.log('Error loading saved Firebase config:', e);
  }
  return { isConfigured: isFirebaseConfigured, app, auth, db };
}

// Allow user to save new Firebase config from UI
export async function saveCustomFirebaseConfig(newConfig) {
  if (isValidFirebaseConfig(newConfig)) {
    await AsyncStorage.setItem(STORAGE_CUSTOM_FIREBASE_CONFIG, JSON.stringify(newConfig));
    return setupFirebase(newConfig);
  } else {
    throw new Error('Please provide at least a valid Firebase API Key and Project ID.');
  }
}

// Clear custom Firebase config to revert to local sandbox
export async function clearCustomFirebaseConfig() {
  await AsyncStorage.removeItem(STORAGE_CUSTOM_FIREBASE_CONFIG);
  isFirebaseConfigured = false;
  app = null;
  auth = null;
  db = null;
}

export {
  app,
  auth,
  db,
  isFirebaseConfigured,
  currentConfig,
  onAuthStateChanged,
  // Re-export common Firestore utilities for clean service imports
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  serverTimestamp
};
