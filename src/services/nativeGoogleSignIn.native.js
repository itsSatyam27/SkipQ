import { Platform, TurboModuleRegistry } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from './firebase';

const cancelled = () => { const error = new Error('Sign-in cancelled.'); error.name = 'AbortError'; throw error; };

async function signInWithGoogleInExpoGo(signal) {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)) {
    throw new Error('Expo Go Google sign-in needs the Web OAuth client ID in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  if (signal?.aborted) cancelled();

  const returnUrl = AuthSession.makeRedirectUri({ path: 'oauth2redirect' });
  const proxyRedirectUri = AuthSession.getRedirectUrl();
  const discovery = { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' };
  const request = new AuthSession.AuthRequest({
    clientId: webClientId,
    redirectUri: returnUrl,
    responseType: AuthSession.ResponseType.IdToken,
    scopes: ['openid', 'profile', 'email'],
    prompt: 'select_account',
    usePKCE: false
  });
  const authorizationUrl = new URL(await request.makeAuthUrlAsync(discovery));
  authorizationUrl.searchParams.set('redirect_uri', proxyRedirectUri);

  const proxyStartUrl = new URL(`${proxyRedirectUri}/start`);
  proxyStartUrl.searchParams.set('authUrl', authorizationUrl.toString());
  proxyStartUrl.searchParams.set('returnUrl', returnUrl);
  const response = await request.promptAsync(discovery, { url: proxyStartUrl.toString() });
  if (response.type === 'cancel' || response.type === 'dismiss' || signal?.aborted) cancelled();
  if (response.type !== 'success') {
    throw new Error(response.error?.message || 'Google sign-in could not be completed.');
  }

  const token = response.params.id_token;
  if (!token) throw new Error('Google did not return an ID token. Check the Expo Go OAuth redirect URI in Google Cloud.');
  const result = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
  if (!result.user.emailVerified || !result.user.email) throw new Error('Choose a Google account with a verified email address.');
  return result.user;
}

export async function nativeGoogleSignIn(signal) {
  // Check before importing: the SDK throws at import time inside Expo Go.
  if (!TurboModuleRegistry.get('RNGoogleSignin')) return signInWithGoogleInExpoGo(signal);
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)) throw new Error('Android Google sign-in needs the Web OAuth client ID in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  if (signal?.aborted) cancelled();
  const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId, offlineAccess: false,
    ...(Platform.OS === 'ios' && process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ? { iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID } : {}) });
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    await GoogleSignin.signOut(); // Always allow choosing an account on the next login.
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success' || signal?.aborted) cancelled();
    const token = response.data?.idToken;
    if (!token) throw new Error('Google did not return an ID token. Check the Web OAuth client ID.');
    const result = await signInWithCredential(auth, GoogleAuthProvider.credential(token));
    if (!result.user.emailVerified || !result.user.email) throw new Error('Choose a Google account with a verified email address.');
    return result.user;
  } catch (error) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) cancelled();
    throw error;
  }
}
