import { Platform } from 'react-native';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { nativeGoogleSignIn } from './nativeGoogleSignIn';

export function googleSignInErrorMessage(error) {
  const messages = {
    'auth/operation-not-allowed': 'Google sign-in is not enabled for SkipQ yet. Please contact the app owner to enable it.',
    'auth/unauthorized-domain': 'Google sign-in is not available on this web address yet. Please contact the app owner.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then try again.',
    'auth/network-request-failed': 'Could not connect to Google. Check your internet connection and try again.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open. Finish signing in there or try again.',
    '10': 'Android Google configuration does not match. Register this build’s SHA-1 fingerprint and com.skipq.app in Firebase, then check the Web OAuth client ID.',
    'DEVELOPER_ERROR': 'Check the Android package name, signing fingerprint and Web OAuth client ID.',
    'PLAY_SERVICES_NOT_AVAILABLE': 'Update Google Play services on this device, then try again.',
    'IN_PROGRESS': 'Google sign-in is already open. Finish choosing your account first.'
  };
  return messages[error?.code] || error?.message || 'Could not sign in. Please try again.';
}

export async function signInGoogleOnWeb() {
  if (Platform.OS !== 'web') throw new Error('Use native Google sign-in on this device.');
  if (!isFirebaseConfigured || !auth) throw new Error('Google sign-in is not configured.');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  if (!result.user.emailVerified || !result.user.email) throw new Error('Choose a Google account with a verified email address.');
  return result.user;
}
export async function signInWithGoogle({ signal } = {}) {
  if (!isFirebaseConfigured || !auth) throw new Error('Google sign-in is not configured.');
  return Platform.OS === 'web' ? signInGoogleOnWeb() : nativeGoogleSignIn(signal);
}
