import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

// Rollouts are explicit: adding a campus to the data does not publish it here.
const availableCampuses = DEFAULT_UNIVERSITIES.filter(campus => campus.id === 'sou');
export default function CampusSelectionScreen({ selectedId, onSelect, onContinue, onBack }) {
  const styles = useSellerStyles(baseStyles);
  const { light, toggle } = useSellerTheme();
  const selected = availableCampuses.some(campus => campus.id === selectedId);
  return <View style={styles.card}>
    <View style={styles.icon}>
      <Svg width={28} height={28} viewBox="0 0 24 24" aria-hidden>
        <Path d="m3 8 9-5 9 5M4 9h16M6 10v8m4-8v8m4-8v8m4-8v8M3 21h18M4 18h16" fill="none" stroke="#ffb313" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
    <Text style={styles.title}>{'Choose your\ncampus'}</Text>
    <Text style={styles.copy}>Find the canteens and pickup points at your university.</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="University or campus" style={styles.options}>
      {availableCampuses.map(campus => <TouchableOpacity key={campus.id} accessibilityRole="radio" accessibilityLabel={campus.name}
        aria-checked={selectedId === campus.id}
        accessibilityState={{ checked: selectedId === campus.id }} onPress={() => onSelect(campus.id)}
        style={[styles.campus, selectedId === campus.id && styles.selected]}>
        <View style={styles.campusDetails}>
          <Text style={styles.campusName}>{campus.name}</Text>
          <Text style={styles.city}>{campus.city}</Text>
          <Text style={styles.available}>AVAILABLE NOW</Text>
        </View>
        <View style={[styles.radio, selectedId === campus.id && styles.radioSelected]}>
          {selectedId === campus.id && <View style={styles.radioDot} />}
        </View>
      </TouchableOpacity>)}
    </View>
    <Text style={styles.rollout}>Starting with Silver Oak. More campuses will be added gradually.</Text>
    <View style={{ flex: 1, minHeight: 34 }} />
    <TouchableOpacity onPress={onContinue} disabled={!selected} accessibilityRole="button" accessibilityLabel="Continue to profile"
      style={[styles.button, !selected && { opacity: 0.5 }]}>
      <LinearGradient colors={['#ffb313', '#ffb313']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradient}>
        <Text style={styles.buttonText}>Continue to profile</Text>
        <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden><Path d="M5 12h14m-5-5 5 5-5 5" stroke="#090b0d" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
      </LinearGradient>
    </TouchableOpacity>
    <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to sign in" style={styles.back}>
      <Text style={styles.backText}>Back to sign in</Text>
    </TouchableOpacity>
  </View>;
}
const baseStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: 'transparent', paddingTop: 24, paddingBottom: 8 },
  icon: { backgroundColor: '#17191d', width: 54, height: 54, borderRadius: 18, borderWidth: 1, borderColor: '#26292e', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { color: '#f5f4f0', fontSize: 36, lineHeight: 36, fontWeight: '900', letterSpacing: -1.3 },
  copy: { color: '#a5a9b2', fontSize: 14, lineHeight: 22, marginTop: 8 },
  options: { marginTop: 26 },
  campus: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#26292e', borderRadius: 20, padding: 17 },
  selected: { borderColor: '#ffb313', backgroundColor: '#211a07' },
  campusDetails: { flex: 1 },
  campusName: { color: '#f5f4f0', fontSize: 17, lineHeight: 24, fontWeight: '700' },
  city: { color: '#a5a9b2', fontSize: 13, lineHeight: 20, marginTop: 4 },
  available: { color: '#47db85', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 10 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#94a3b8', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: '#ffb313' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ffb313' },
  rollout: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 16, marginBottom: 28 },
  button: { borderRadius: 14, overflow: 'hidden' },
  gradient: { minHeight: 52, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { color: '#090b0d', fontSize: 15, fontWeight: '700' },
  back: { alignItems: 'center', paddingVertical: 14, marginTop: 10 },
  backText: { color: '#ffb313', fontSize: 13, fontWeight: '600' },
});
