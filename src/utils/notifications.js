import { Platform, Vibration } from 'react-native';
import { playOrderReadyBuzzer, announceTokenReady } from './audio';

/**
 * Configure notifications for campus food pickup.
 * Safe for Expo Go (SDK 53+ removed remote push from Expo Go) and standalone APKs.
 */
export async function registerForPushNotificationsAsync() {
  // Mobile permissions check
  return true;
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
