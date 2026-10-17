import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const roles = [
  { value: 'student', label: 'Student', detail: 'Order and collect from campus canteens.' },
  { value: 'faculty', label: 'Faculty / Staff', detail: 'Order food for your campus breaks.' },
  { value: 'seller', label: 'Canteen Seller', detail: 'Manage your menu and incoming orders.' },
];

export default function CampusRoleSelect({ value, onChange, disabled }) {
  const styles = useSellerStyles(baseStyles);
  const { light, toggle } = useSellerTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 16, y: 24, width: 280 });
  const trigger = useRef(null);
  const { width, height } = useWindowDimensions();
  useEffect(() => { setOpen(false); }, [width, height, disabled]);
  const close = () => { setOpen(false); trigger.current?.focus?.(); };
  const show = () => {
    Keyboard.dismiss();
    trigger.current?.measureInWindow((x, y, triggerWidth, triggerHeight) => {
      const menuWidth = Math.min(triggerWidth, width - 32);
      const menuHeight = 162;
      const top = y + triggerHeight + 6;
      setAnchor({ x: Math.max(16, Math.min(x, width - menuWidth - 16)),
        y: Math.max(24, Math.min(top + menuHeight <= height - 24 ? top : y - menuHeight - 6, height - menuHeight - 24)), width: menuWidth });
      setOpen(true);
    });
  };
  const selected = roles.find(role => role.value === value) || roles[0];
  return <View>
    <TouchableOpacity ref={trigger} style={[styles.trigger, open && styles.active]} onPress={show} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={`Campus role: ${selected.label}`}
      aria-expanded={open}
      accessibilityState={{ expanded: open, disabled }}>
      <Text style={styles.value}>{selected.label}</Text>
      <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden>
        <Path d={disabled ? 'M8 10V7a4 4 0 0 1 8 0v3M6 10h12v10H6Z' : open ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} fill="none" stroke="#64748b" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </TouchableOpacity>
    <Modal visible={open && !disabled} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Close campus role menu" />
      <View style={[styles.menu, { position: 'absolute', left: anchor.x, top: anchor.y, width: anchor.width }]} accessibilityViewIsModal accessibilityRole="radiogroup" accessibilityLabel="Choose campus role">
      {roles.map(role => <TouchableOpacity key={role.value} style={[styles.option, role.value === value && styles.selected]}
        accessibilityRole="radio" accessibilityState={{ checked: role.value === value }} accessibilityLabel={role.label}
        aria-checked={role.value === value}
        onPress={() => { onChange(role.value); close(); }}>
        <Text style={[styles.value, role.value === value && { color: '#0759ad' }]}>{role.label}</Text>
        {role.value === value && <Svg width={18} height={18} viewBox="0 0 24 24" aria-hidden><Path d="m5 12 4 4L19 6" fill="none" stroke="#0759ad" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
      </TouchableOpacity>)}
      </View>
      </View>
    </Modal>
    <Text style={styles.hint}>{disabled ? 'Your registered account role is fixed.' : selected.detail}</Text>
  </View>;
}
const baseStyles = StyleSheet.create({
  trigger: { minHeight: 50, borderWidth: 1, borderColor: '#26292e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#121417', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  active: { borderColor: '#2676c8', backgroundColor: '#121417' },
  value: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#f5f4f0' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.08)' },
  menu: { borderWidth: 1, borderColor: '#26292e', borderRadius: 12, padding: 5, backgroundColor: '#121417', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 12 },
  option: { minHeight: 46, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selected: { backgroundColor: '#292418' },
  hint: { fontSize: 12, lineHeight: 18, color: '#a5a9b2', marginTop: 7 },
});
