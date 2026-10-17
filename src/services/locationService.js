import { Platform, Linking } from 'react-native';
import * as Location from 'expo-location';
import { normalizePosition, gpsError } from './locationPolicy.cjs';

function webLocation() {
  if (typeof window !== 'undefined' && !window.isSecureContext) throw gpsError('INSECURE_ORIGIN', 'Browser location requires HTTPS or localhost. Open the HTTPS app address.');
  if (!globalThis.navigator?.geolocation) throw gpsError('LOCATION_UNAVAILABLE', 'Location is not supported by this browser. Try a browser with location services enabled.');
  return navigator.geolocation;
}
function webError(error) {
  if (error.code === 1) return gpsError('PERMISSION_DENIED', 'Location is blocked. Allow Location in this site’s browser permissions, then tap Retry GPS.', true);
  if (error.code === 3) return gpsError('LOCATION_TIMEOUT', 'GPS took too long. Turn on device location, move near a window and retry.');
  return gpsError('LOCATION_UNAVAILABLE', 'Could not find your location. Turn on device location and try again.');
}
export async function requestDevicePosition() {
  if (Platform.OS === 'web') {
    const geolocation = webLocation();
    const position = await new Promise((resolve, reject) => geolocation.getCurrentPosition(resolve, error => reject(webError(error)),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
    return normalizePosition(position);
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') throw gpsError('PERMISSION_DENIED', 'Allow location access for SkipQ in app settings, then retry.', !permission.canAskAgain);
  if (!await Location.hasServicesEnabledAsync()) throw gpsError('SERVICES_DISABLED', 'Device location is turned off. Turn it on, then retry GPS.', true);
  let timer;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(gpsError('LOCATION_TIMEOUT', 'GPS took too long. Move near a window and retry.')), 20000); })
    ]);
    return normalizePosition(position);
  } finally { clearTimeout(timer); }
}
export async function watchDevicePosition(onLocation, onError) {
  const update = position => { try { onLocation(normalizePosition(position)); } catch (error) { onError(error); } };
  if (Platform.OS === 'web') {
    const geolocation = webLocation();
    const id = geolocation.watchPosition(update, error => onError(webError(error)), { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
    return { remove: () => geolocation.clearWatch(id) };
  }
  return Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 }, update,
    message => onError(gpsError('LOCATION_UNAVAILABLE', String(message || 'Location updates stopped. Retry GPS.'))));
}
export async function openDeviceLocationSettings(code) {
  if (Platform.OS === 'web') return; // Browsers require user-managed site permissions.
  if (Platform.OS === 'android' && code === 'SERVICES_DISABLED') return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  return Linking.openSettings();
}
