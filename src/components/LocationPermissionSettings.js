import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { AppContext } from '../context/AppContext';
import { useSellerStyles } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';

export default function LocationPermissionSettings() {
  const s = useSellerStyles(styles);
  const { requestUserLocation, locationError } = useContext(AppContext);
  const [message, setMessage] = useState('Checking location access...');
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      if (Platform.OS === 'web') {
        if (!navigator.permissions?.query) { setMessage('Use Enable location to check browser access.'); return; }
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setMessage(result.state === 'granted' ? 'Location access allowed in this browser.' : result.state === 'denied' ? 'Location blocked. Allow it in your browser site settings.' : 'Location access has not been enabled.');
        return;
      }
      const permission = await Location.getForegroundPermissionsAsync();
      const services = await Location.hasServicesEnabledAsync();
      setMessage(permission.status === 'granted' ? services ? 'Allowed while using the app. Device location is on.' : 'Permission allowed, but device location is off.' : permission.canAskAgain ? 'Allow location to check that you are near your canteen.' : 'Location blocked. Allow access in phone settings.');
    } catch { setMessage('Could not check location access. Please retry.'); }
  };
  useEffect(() => {
    let active = true;
    if (active) void refresh();
    const listener = AppState.addEventListener('change', state => { if (active && state === 'active') void refresh(); });
    return () => { active = false; listener.remove(); };
  }, []);
  const enable = async () => {
    setBusy(true);
    try { await requestUserLocation(); await refresh(); }
    catch { setMessage('Could not get your location. Check permission and device location, then retry.'); }
    finally { setBusy(false); }
  };
  const settings = async () => {
    try {
      if (!await Location.hasServicesEnabledAsync() && Platform.OS === 'android') await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
      else await Linking.openSettings();
    } catch { setMessage('Open phone settings and allow Location for SkipQ.'); }
  };
  return <View style={s.card}><View style={s.heading}><InterfaceIcon name="location" size={20} color="#ffb313" /><Text style={s.title}>Campus location</Text></View>
    <Text accessibilityLiveRegion="polite" style={s.copy}>{message}</Text>
    <Text style={s.copy}>Used to confirm pickup range when ordering.</Text>
    {Boolean(locationError) && <Text style={s.copy}>{typeof locationError === 'string' ? locationError : locationError.message}</Text>}
    <View style={s.actions}><TouchableOpacity accessibilityRole="button" disabled={busy} onPress={enable} style={s.button}>{busy ? <ActivityIndicator color="#090b0d" /> : <Text style={s.buttonText}>Enable / Refresh location</Text>}</TouchableOpacity>
    {Platform.OS !== 'web' && <TouchableOpacity accessibilityRole="button" onPress={settings} style={s.settings}><Text style={s.settingsText}>Phone settings</Text></TouchableOpacity>}</View>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 18, padding: 18, marginBottom: 16 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 9 }, title: { color: '#f5f4f0', fontSize: 15, fontWeight: '700' }, copy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 10 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 }, button: { backgroundColor: '#ffb313', borderRadius: 12, minHeight: 43, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#090b0d', fontSize: 12, fontWeight: '700' }, settings: { padding: 12, justifyContent: 'center' }, settingsText: { color: '#ffb313', fontSize: 12, fontWeight: '600' },
});
