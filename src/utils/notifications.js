import { Platform, Vibration } from 'react-native';
import { playOrderReadyBuzzer, announceTokenReady } from './audio';
import { auth } from '../services/firebase';

// Owner-approved HTTPS Render endpoint only. No credentials are sent until set.
const configuredUrl = (process.env.EXPO_PUBLIC_PUSH_API_URL || '').replace(/\/$/, '');
const pushApi = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(configuredUrl) ? configuredUrl : '';
let initialized = false;
let registrationStatus = { state: 'idle', message: 'Enable order and pickup notifications.' };
const statusListeners = new Set();
export const getPushRegistrationStatus = () => registrationStatus;
export function subscribePushRegistrationStatus(listener) {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}
function updateStatus(state, message) {
  registrationStatus = { state, message };
  statusListeners.forEach(listener => listener(registrationStatus));
}
async function pushRequest(path, body, timeoutMs = 90000) {
  if (!pushApi || !auth?.currentUser) {
    const error = new Error('Sign in and configure the notification server first.');
    error.code = 'sign-in-required';
    throw error;
  }
  const token = await auth.currentUser.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${pushApi}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' });
    if (!response.ok) {
      const error = new Error(`Notification server returned HTTP ${response.status}.`);
      error.code = `http-${response.status}`;
      throw error;
    }
    const result = await response.json();
    if (result.status === 'no-device') throw new Error('The receiving account has not enabled notifications on its phone.');
    return result;
  } finally { clearTimeout(timeout); }
}

export async function notifyOrderEvent(orderId, event) {
  try { await pushRequest('/events', { orderId, event }); }
  catch { console.warn('Order saved, but background notification could not be sent.'); }
}

export async function unregisterPushDevice() {
  try { await pushRequest('/devices', { remove: true }, 3000); }
  catch { /* Signing out must remain available when the server is offline. */ }
}

/**
 * Configure notifications for campus food pickup.
 * Safe for Expo Go (SDK 53+ removed remote push from Expo Go) and standalone APKs.
 */
export async function registerForPushNotificationsAsync() {
  if (Platform.OS !== 'android') { updateStatus('unavailable', 'Open the Android app to enable phone notifications.'); return false; }
  if (!pushApi) { updateStatus('error', 'Notification server is not configured.'); return false; }
  let stage = 'channel';
  updateStatus('loading', 'Enabling order notifications...');
  try {
    const notifications = require('expo-notifications');
    // SDK 57 treats an explicit sound string as a bundled custom filename.
    // Omitting sound selects Android's system default notification sound.
    await notifications.setNotificationChannelAsync('orders', { name: 'Orders and pickups', importance: notifications.AndroidImportance.HIGH, vibrationPattern: [0, 300, 150, 300] });
    stage = 'permission';
    const permission = await notifications.getPermissionsAsync();
    const status = permission.status === 'granted' ? permission : await notifications.requestPermissionsAsync();
    if (status.status !== 'granted') { updateStatus('denied', 'Notifications are off. Allow them in phone settings.'); return false; }
    if (!initialized) {
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      initialized = true;
    }
    stage = 'device-token';
    const device = await notifications.getDevicePushTokenAsync();
    stage = 'server-registration';
    await pushRequest('/devices', { token: device.data, platform: 'android' });
    updateStatus('enabled', 'Order notifications are enabled on this phone.');
    return true;
  } catch (error) {
    const code = /^[a-zA-Z0-9/_-]{1,80}$/.test(error?.code || '') ? error.code : 'unavailable';
    updateStatus('error', stage === 'server-registration' ? `Could not register this phone (${code}). Tap Retry.` : stage === 'device-token' ? `Could not get a Firebase push token (${code}). Check Google Play services and your connection.` : 'Could not enable notifications. Check phone settings and retry.');
    console.warn(`Push registration failed at ${stage} (${code}).`);
    return false;
  }
}

/**
 * Triggers notification and alert when order becomes ready for pickup
 */
export async function sendOrderReadyNotification(order) {
  if (!order) return;
  const token = order.tokenNumber || order.tokenNo || '';
  const shop = order.shopName || order.canteenName || 'Campus Canteen';

  try {
    // Vibrate device
    Vibration.vibrate([0, 300, 150, 300]);
    // Announce token via speech and buzzer
    announceTokenReady(token, shop);
  } catch (err) {
    console.log('Order ready notification note:', err?.message);
  }
}
