import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import React, { useContext } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppContext } from '../context/AppContext';

export default function SellerPendingScreen() {
  const styles = useSellerStyles(baseStyles);
  const { userProfile } = useContext(AppContext);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>SELLER WORKSPACE</Text>
    <Text style={styles.title}>{userProfile.stallName || 'Your canteen'}</Text>
    <Text style={styles.subtitle}>Your counter, orders and menu in one place.</Text>
    <View style={styles.card}>
      <View style={styles.icon}><Svg width={30} height={30} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={9} fill="none" stroke="#0c52a3" strokeWidth={1.6} /><Path d="M12 7v5l3 2" fill="none" stroke="#0c52a3" strokeWidth={1.8} strokeLinecap="round" /></Svg></View>
      <Text style={styles.badge}>APPROVAL PENDING</Text>
      <Text style={styles.heading}>Registration received</Text>
      <Text style={styles.copy}>Your seller account is ready. The platform owner needs to approve your canteen before you can accept orders or publish a menu.</Text>
      <View style={styles.detail}><Text style={styles.label}>CANTEEN</Text><Text style={styles.value}>{userProfile.stallName || 'Not provided'}</Text><Text style={styles.label}>CAMPUS LOCATION</Text><Text style={styles.value}>{userProfile.stallLocation || 'Not provided'}</Text></View>
      <Text style={styles.hint}>This workspace unlocks automatically when approval is granted. Your account details are available in Account.</Text>
    </View>
  </ScrollView>;
}
const baseStyles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 130, width: '100%', maxWidth: 560, alignSelf: 'center' },
  eyebrow: { color: '#ffb313', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#f5f4f0', fontSize: 27, fontWeight: '800', marginTop: 8 },
  subtitle: { color: '#9b9fa9', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 22 },
  card: { backgroundColor: '#121417', borderRadius: 24, borderWidth: 1, borderColor: '#dce7f1', padding: 24 },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#edf6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  badge: { color: '#9a6700', backgroundColor: '#fff6d8', fontSize: 10, fontWeight: '800', letterSpacing: 0.7, padding: 8, borderRadius: 8, alignSelf: 'flex-start' },
  heading: { color: '#f5f4f0', fontSize: 22, fontWeight: '800', marginTop: 14 },
  copy: { color: '#9b9fa9', fontSize: 14, lineHeight: 22, marginTop: 10 },
  detail: { backgroundColor: '#f7f9fc', borderRadius: 14, padding: 16, marginVertical: 20 },
  label: { fontSize: 10, color: '#9b9fa9', fontWeight: '700', letterSpacing: 0.7 },
  value: { fontSize: 14, fontWeight: '600', color: '#e5e6e8', marginTop: 5, marginBottom: 14 },
  hint: { color: '#9b9fa9', fontSize: 12, lineHeight: 19 }
});
