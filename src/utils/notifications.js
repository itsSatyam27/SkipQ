import { Platform, Vibration } from 'react-native';
import { playOrderReadyBuzzer, announceTokenReady } from './audio';
import { auth } from '../services/firebase';

// Owner-approved HTTPS Render endpoint only. No credentials are sent until set.
const configuredUrl = (process.env.EXPO_PUBLIC_PUSH_API_URL || '').replace(/\/$/, '');
const pushApi = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(configuredUrl) ? configuredUrl : '';
let initialized = false;
async function pushRequest(path, body, timeoutMs = 90000) {
  if (!pushApi || !auth?.currentUser) return;
  const token = await auth.currentUser.getIdToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${pushApi}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error('Push server request failed');
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
  if (Platform.OS !== 'android' || !pushApi) return false;
  try {
    const notifications = require('expo-notifications');
    await notifications.setNotificationChannelAsync('orders', { name: 'Orders and pickups', importance: notifications.AndroidImportance.HIGH, sound: 'default', vibrationPattern: [0, 300, 150, 300] });
    const permission = await notifications.getPermissionsAsync();
    const status = permission.status === 'granted' ? permission : await notifications.requestPermissionsAsync();
    if (status.status !== 'granted') return false;
    if (!initialized) {
      notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
      initialized = true;
    }
    const device = await notifications.getDevicePushTokenAsync();
    await pushRequest('/devices', { token: device.data, platform: 'android' });
    return true;
  } catch { console.warn('Push registration unavailable; check the development build and push server configuration.'); return false; }
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
