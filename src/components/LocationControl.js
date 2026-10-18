import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useContext } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppContext } from '../context/AppContext';
import { isUsableLocation } from '../services/locationPolicy.cjs';
import { getDistanceInMeters, formatDistance, isWithinOrderingPerimeter } from '../utils/distance';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

export default function LocationControl({ compact = false }) {
  const styles = useSellerStyles(baseStyles);
  const { light } = useSellerTheme();
  const { userLocation, locationStatus, locationError, requestUserLocation, openLocationSettings, university, locationTesting } = useContext(AppContext);
  const ready = isUsableLocation(userLocation);
  const busy = locationStatus === 'locating';
  const campus = DEFAULT_UNIVERSITIES.find(item => item.id === university) || DEFAULT_UNIVERSITIES[0];
  const distance = ready ? getDistanceInMeters(userLocation.lat, userLocation.lng, campus.lat, campus.lng) : null;
  const onCampus = ready && isWithinOrderingPerimeter(distance, userLocation.accuracy);
  const refresh = async () => { try { await requestUserLocation(); } catch { /* Shared error is shown below. */ } };
  const label = busy ? 'Locating…' : ready ? onCampus ? 'On campus' : `${formatDistance(distance)} away` : locationError ? 'Retry GPS' : 'Enable GPS';
  const icon = <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden>
    <Circle cx={12} cy={12} r={6} fill="none" stroke={onCampus ? '#087d73' : '#0759ad'} strokeWidth={1.8} />
    <Path d="M12 2v4m0 12v4M2 12h4m12 0h4" stroke={onCampus ? '#087d73' : '#0759ad'} strokeWidth={1.8} strokeLinecap="round" />
  </Svg>;
  if (locationTesting) return <View style={compact ? [styles.chip, { backgroundColor: light ? '#fff5d9' : '#292418' }] : styles.panel}>
    <Text style={compact ? [styles.chipText, { color: light ? '#946200' : '#ffb313' }] : styles.title}>{compact ? 'Test location' : 'Location test mode'}</Text>
    {!compact && <Text style={styles.copy}>Temporary testing access is active for this account. Campus GPS checks are skipped and orders are marked as test orders.</Text>}
  </View>;
  if (compact) return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh GPS location" disabled={busy} onPress={refresh}
    style={[styles.chip, onCampus && styles.chipReady]}>
    {busy ? <ActivityIndicator size="small" color="#0759ad" /> : icon}<Text style={styles.chipText}>{label}</Text>
  </TouchableOpacity>;
  return <View style={styles.panel}>
    <View style={styles.heading}>{icon}<Text style={styles.title}>{busy ? 'Finding your location' : ready ? 'Campus location' : 'Enable location to order'}</Text></View>
    <Text style={styles.copy} accessibilityLiveRegion="polite">{locationError?.message || (busy ? 'Keep device location on while we get an accurate fix.' : ready
      ? `${onCampus ? 'Near your campus' : `${formatDistance(distance)} from campus`}. Accuracy about ${Math.round(userLocation.accuracy)}m.`
      : 'Allow location access to check that you are near the canteen. You can keep browsing without it.')}</Text>
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Enable or retry GPS" disabled={busy} onPress={refresh} style={styles.button}>
        <Text style={styles.buttonText}>{busy ? 'Locating…' : ready ? 'Refresh location' : locationError ? 'Retry GPS' : 'Enable location'}</Text>
      </TouchableOpacity>
      {locationError?.needsSettings && Platform.OS !== 'web' && <TouchableOpacity accessibilityRole="button" onPress={() => openLocationSettings().catch(() => {})} style={styles.settings}>
        <Text style={styles.settingsText}>Open settings</Text>
      </TouchableOpacity>}
    </View>
  </View>;
}
const baseStyles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 18, backgroundColor: '#eaf3fd', flexShrink: 0 },
  chipReady: { backgroundColor: '#e6f7f1' }, chipText: { color: '#17486c', fontSize: 11, fontWeight: '700' },
  panel: { borderWidth: 1, borderColor: '#d5e4f3', borderRadius: 16, padding: 14, marginVertical: 12, backgroundColor: '#f3f8ff' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 }, title: { color: '#173953', fontSize: 14, fontWeight: '700' },
  copy: { color: '#52677d', fontSize: 12, lineHeight: 19, marginTop: 8 }, actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  button: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, backgroundColor: '#ffb313' }, buttonText: { color: '#090b0d', fontWeight: '700', fontSize: 12 },
  settings: { padding: 10 }, settingsText: { color: '#ffb313', fontSize: 12, fontWeight: '700' },
});
