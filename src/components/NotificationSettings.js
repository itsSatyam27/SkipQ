import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSellerStyles } from '../context/SellerTheme';
import { getPushRegistrationStatus, registerForPushNotificationsAsync, subscribePushRegistrationStatus } from '../utils/notifications';
import InterfaceIcon from './InterfaceIcon';

export default function NotificationSettings() {
  const styles = useSellerStyles(baseStyles);
  const [status, setStatus] = useState(getPushRegistrationStatus);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribePushRegistrationStatus(setStatus), []);
  const retry = async () => {
    setBusy(true);
    try { await registerForPushNotificationsAsync(); setStatus(getPushRegistrationStatus()); }
    finally { setBusy(false); }
  };
  return <View style={styles.card}>
    <View style={styles.heading}><InterfaceIcon name="orders" color="#ffb313" size={20} /><Text style={styles.title}>Order notifications</Text></View>
    <Text accessibilityLiveRegion="polite" style={styles.copy}>{status.message}</Text>
    {Platform.OS === 'android' && <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry order notifications" disabled={busy || status.state === 'loading'} onPress={retry} style={styles.button}>{busy || status.state === 'loading' ? <ActivityIndicator color="#090b0d" /> : <Text style={styles.buttonText}>{status.state === 'enabled' ? 'Refresh connection' : 'Enable / Retry'}</Text>}</TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => Linking.openSettings()} style={styles.settings}><Text style={styles.settingsText}>Phone settings</Text></TouchableOpacity>
    </View>}
  </View>;
}
const baseStyles = StyleSheet.create({
  card: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 18, padding: 18, marginBottom: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  title: { color: '#f5f4f0', fontSize: 15, fontWeight: '700' },
  copy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  button: { backgroundColor: '#ffb313', borderRadius: 12, minHeight: 43, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#090b0d', fontSize: 12, fontWeight: '700' },
  settings: { padding: 12, justifyContent: 'center' }, settingsText: { color: '#ffb313', fontSize: 12, fontWeight: '600' },
});
