import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Modal, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import InterfaceIcon from './InterfaceIcon';
import { selectOwnedCanteen } from '../services/sellerCanteen.cjs';
import { validateSellerSettings } from '../services/sellerSettings.cjs';
import useReducedMotion from '../hooks/useReducedMotion';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

const sections = ['Canteen', 'Payments', 'Profile'];
const snapshot = (profile, shop) => ({ name: profile.name || '', stallName: shop?.name || '', location: shop?.location || '', upiId: shop?.upiId || '', openingHours: shop?.openingHours || '', isOpen: shop?.status === 'Open' });
function AvailabilitySwitch({ value, disabled, onChange }) {
  const styles = useSellerStyles(baseStyles);
  const reduced = useReducedMotion();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(position, { toValue: value ? 1 : 0, duration: reduced ? 0 : 170, useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [value, reduced, position]);
  return <TouchableOpacity accessibilityRole="switch" accessibilityLabel="Accept new orders" accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onChange(!value)} activeOpacity={0.8} style={styles.switchTouch}>
    <View style={[styles.switchTrack, { backgroundColor: value ? '#47db85' : '#41464f', opacity: disabled ? 0.5 : 1 }]}>
      <Animated.View style={[styles.switchThumb, { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, 22] }) }] }]} />
    </View>
  </TouchableOpacity>;
}
function SettingsSaveBar({ visible, saving, disabled, error, onSave, onReset }) {
  const styles = useSellerStyles(baseStyles);
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reduced ? 0 : 180, useNativeDriver: false });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, reduced, progress]);
  if (!mounted) return null;
  return <Animated.View style={{ opacity: progress, maxHeight: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 240] }), overflow: 'hidden' }}>
    <View style={styles.footer}><View style={styles.saveBar}>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <Text style={styles.saveBarHint}>Unsaved changes</Text>}
      <View style={styles.saveActions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Discard settings changes" disabled={saving} onPress={onReset} style={styles.discardButton}><Text style={styles.discardText}>Discard</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save seller settings" disabled={disabled || saving} onPress={onSave} style={[styles.save, { flex: 1 }, (disabled || saving) && styles.saveDisabled]}>{saving ? <ActivityIndicator color="#090b0d" /> : <><InterfaceIcon name="check" size={18} color="#090b0d" /><Text style={[styles.saveText, disabled && styles.saveTextDisabled]}>Save changes</Text></>}</TouchableOpacity>
      </View>
    </View></View>
  </Animated.View>;
}
function Field({ label, hint, locked, ...props }) {
  const styles = useSellerStyles(baseStyles);
  return <View style={styles.field}><View style={styles.fieldLabelRow}><Text style={[styles.label, { marginBottom: 0 }]}>{label}</Text>{locked && <InterfaceIcon name="lock" size={11} color="#797e89" />}</View><TextInput {...props} accessibilityLabel={label} editable={!locked} style={[styles.input, locked && styles.locked]} placeholderTextColor="#9aa8ba" />{hint && <Text style={styles.hint}>{hint}</Text>}</View>;
}
function Section({ title, copy, children }) {
  const styles = useSellerStyles(baseStyles);
  return <View style={styles.card}><Text style={styles.sectionTitle}>{title}</Text>{copy && <Text style={styles.copy}>{copy}</Text>}{children}</View>;
}
export default function VendorProfileModal({ visible, onClose = () => {}, embedded = false, requestedSection, settingsRequest }) {
  const styles = useSellerStyles(baseStyles);
  const { userProfile, canteens, sellerShopId, university, sellerApproved, saveSellerSettings, logoutUser } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const shop = selectOwnedCanteen(canteens, userProfile?.uid, university, sellerShopId, userProfile?.sellerShopId);
  const campus = DEFAULT_UNIVERSITIES.find(item => item.id === university);
  const [tab, setTab] = useState('Canteen');
  const [draft, setDraft] = useState(() => snapshot(userProfile, shop));
  const [baseline, setBaseline] = useState(() => JSON.stringify(snapshot(userProfile, shop)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const scrollRef = useRef(null);
  const selectTab = section => { setTab(section); scrollRef.current?.scrollTo({ y: 0, animated: false }); };
  useEffect(() => { if (sections.includes(requestedSection)) selectTab(requestedSection); }, [requestedSection, settingsRequest]);
  // A background profile heartbeat must not overwrite an operator's unsaved edits.
  useEffect(() => {
    if (!visible) return;
    const next = snapshot(userProfile, shop);
    setDraft(next); setBaseline(JSON.stringify(next)); setTab(sections.includes(requestedSection) ? requestedSection : 'Canteen'); setError(''); setSaved(false);
  }, [visible, shop?.id, userProfile?.uid]);
  const dirty = JSON.stringify(draft) !== baseline;
  const savedUpiId = JSON.parse(baseline).upiId.trim();
  const change = (key, value) => { setDraft(old => ({ ...old, [key]: value })); setSaved(false); setError(''); };
  const close = () => {
    if (saving) return;
    if (!dirty) { onClose(); return; }
    Alert.alert('Discard changes?', 'Your canteen settings have unsaved changes.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }]);
  };
  const save = async () => {
    if (saving || !shop || !sellerApproved) return;
    try {
      validateSellerSettings(draft);
      setSaving(true); setError('');
      await saveSellerSettings(shop.id, draft);
      setBaseline(JSON.stringify(draft)); setSaved(true);
      Alert.alert('Settings saved', 'Your canteen settings are up to date.');
    } catch (e) { setError(e.message || 'Could not save changes. Try again.'); }
    finally { setSaving(false); }
  };
  const support = () => Linking.openURL('mailto:skipqueue.official@gmail.com?subject=SkipQ%20seller%20support').catch(() => Alert.alert('Contact support', 'Email skipqueue.official@gmail.com for help.'));
  const logout = () => Alert.alert('Sign out?', dirty ? 'Your unsaved settings will be discarded.' : 'You can sign back in with your linked Google account.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: async () => { try { await logoutUser(); onClose(); } catch(e) { setError(e.message); } } }
  ]);
  if (!visible) return null;
  const content = <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.overlay, embedded && styles.embeddedOverlay]}>
      <View style={[styles.sheet, embedded ? { ...styles.embeddedSheet, paddingBottom: 86 + Math.max(12, insets.bottom) } : { paddingTop: Math.max(18, insets.top), paddingBottom: Math.max(12, insets.bottom) }]}>
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>SELLER WORKSPACE</Text><Text style={styles.title}>{embedded ? 'Account & settings' : 'Settings'}</Text></View>{!embedded && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close seller settings" disabled={saving} onPress={close} style={styles.close}><InterfaceIcon name="close" size={21} /></TouchableOpacity>}</View>
        <View style={styles.tabs} accessibilityRole="tablist">{sections.map(section => <TouchableOpacity key={section} accessibilityRole="tab" accessibilityState={{ selected: tab === section }} onPress={() => selectTab(section)} style={[styles.tab, tab === section && styles.tabActive]}><Text style={[styles.tabText, tab === section && styles.tabTextActive]}>{section}</Text></TouchableOpacity>)}</View>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.identity}><View style={styles.identityIcon}><InterfaceIcon name="shop" color="#ffb313" size={21} /></View><View style={{ flex: 1 }}><Text style={styles.shopName}>{shop?.name || userProfile.stallName || 'Your canteen'}</Text><Text style={styles.identityCopy}>{campus?.name || university}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{sellerApproved ? 'Approved' : 'Pending'}</Text></View></View>
          {!shop && <Text style={styles.notice}>Your canteen is being set up. Return to the workspace and finish setup before editing settings.</Text>}
          {tab === 'Canteen' && <>
            <Section title="Order availability" copy="Control when customers can place new orders.">
              <View style={styles.switchRow}><View style={{ flex: 1, paddingRight: 15 }}><Text style={styles.switchTitle}>{draft.isOpen ? 'Accepting orders' : 'Orders paused'}</Text><Text style={styles.hint}>{draft.isOpen ? 'Your canteen can receive new orders.' : 'Existing orders still need to be completed.'}</Text></View><AvailabilitySwitch value={draft.isOpen} disabled={!shop || saving} onChange={value => change('isOpen', value)} /></View>
              <Text style={styles.smallNote}>Availability changes take effect when you save.</Text>
            </Section>
            <Section title="Canteen details" copy="Keep the information customers see up to date.">
              <Field label="Canteen name" value={draft.stallName} onChangeText={value => change('stallName', value)} placeholder="Your canteen name" maxLength={100} locked={!shop || saving} />
              <Field label="Location on campus" value={draft.location} onChangeText={value => change('location', value)} placeholder="e.g. Block A, ground floor" maxLength={150} locked={!shop || saving} />
              <Field label="Opening hours" value={draft.openingHours} onChangeText={value => change('openingHours', value)} placeholder="e.g. 8:00 AM - 8:00 PM" hint="Shown as information. The availability switch controls ordering." maxLength={100} locked={!shop || saving} />
              <Field label="Campus" value={campus?.name || university} locked hint="Your registered campus is linked to this canteen." />
            </Section>
          </>}
          {tab === 'Payments' && <>
            <Section title="Payment methods" copy="Customers pay your canteen directly. SkipQ does not hold a wallet balance.">
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodHeading}>
                  <View style={styles.methodIcon}><InterfaceIcon name="cash" size={19} color="#ffb313" /></View>
                  <Text style={[styles.switchTitle, { flex: 1 }]}>Cash at pickup</Text>
                  <View style={styles.enabledBadge}><Text style={styles.methodBadge}>Enabled</Text></View>
                </View>
                <Text style={styles.paymentDescription}>Collect the full amount at the counter.</Text>
              </View>
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodHeading}>
                  <View style={styles.methodIcon}><InterfaceIcon name="phone" size={19} color="#ffb313" /></View>
                  <Text style={[styles.switchTitle, { flex: 1 }]}>UPI payment</Text>
                  <View style={[styles.enabledBadge, !savedUpiId && styles.cashOnlyBadge]}><Text style={[styles.methodBadge, !savedUpiId && styles.cashOnlyText]}>{savedUpiId ? 'Enabled' : 'Not set'}</Text></View>
                </View>
                <Text style={styles.paymentDescription}>{savedUpiId ? 'Customers can pay your saved UPI ID. Confirm receipt in your UPI app before marking a payment received.' : 'Add and save your merchant UPI ID to accept UPI payments.'}</Text>
              </View>
              <Field label="Merchant UPI ID" value={draft.upiId} onChangeText={value => change('upiId', value)} autoCapitalize="none" autoCorrect={false} placeholder="canteen@bank" maxLength={150} locked={!shop || saving} hint="Leave empty to offer cash only. Changes apply to new orders." />
            </Section>
            <View style={styles.paymentNote}><InterfaceIcon name="info" size={20} color="#ffb313" /><Text style={styles.paymentNoteText}>SkipQ does not verify bank receipt automatically. Refunds for confirmed UPI payments are handled directly by your canteen.</Text></View>
          </>}
          {tab === 'Profile' && <>
            <Section title="Operator account" copy="Your Google account and phone stay linked to your registration.">
              <View style={styles.operatorIdentity}><View style={styles.operatorAvatar}><Text style={styles.operatorInitial}>{(draft.name.trim() || 'S').charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.operatorName}>{userProfile.name || 'Your account'}</Text><Text style={styles.hint}>Seller</Text></View></View>
              <Field label="Full name" value={draft.name} onChangeText={value => change('name', value)} placeholder="Your full name" maxLength={100} locked={saving} />
              <Field label="Google email" value={userProfile.email || ''} locked />
              <Field label="Phone number" value={userProfile.phone || ''} locked />
              <Field label="Account type" value="Seller" locked />
            </Section>
            <Section title="Help and access">
              <TouchableOpacity accessibilityRole="button" onPress={support} style={styles.action}><View style={styles.accessIcon}><InterfaceIcon name="support" size={18} color="#b6bac2" /></View><View style={{ flex: 1 }}><Text style={styles.actionTitle}>Contact support</Text><Text style={styles.hint}>Get help with your account or canteen.</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
              <View style={styles.divider} />
              <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={logout} style={styles.action}><View style={[styles.accessIcon, { backgroundColor: '#27171c' }]}><InterfaceIcon name="logout" color="#ff536c" size={18} /></View><Text style={[styles.actionTitle, { color: '#bc4040', flex: 1 }]}>Sign out</Text><Text style={styles.chevron}>›</Text></TouchableOpacity>
            </Section>
          </>}
        </ScrollView>
        <SettingsSaveBar visible={dirty || saving || !!error} saving={saving} disabled={!shop || !sellerApproved} error={error} onSave={save} onReset={() => { setDraft(JSON.parse(baseline)); setError(''); setSaved(false); }} />
      </View>
    </KeyboardAvoidingView>
  </>;
  return embedded ? content : <Modal visible animationType="slide" transparent onRequestClose={close}>{content}</Modal>;
}
const baseStyles = StyleSheet.create({
  saveBar: { backgroundColor: '#17191d', borderWidth: 1, borderColor: '#26292e', borderRadius: 18, padding: 12 },
  saveBarHint: { color: '#b6bac2', fontSize: 11, fontWeight: '600', marginBottom: 10 },
  saveActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discardButton: { minHeight: 46, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  discardText: { color: '#b6bac2', fontSize: 12, fontWeight: '600' },
  paymentMethodCard: { backgroundColor: '#090b0d', borderWidth: 1, borderColor: '#22252a', borderRadius: 15, padding: 14, marginTop: 12 },
  paymentMethodHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  paymentDescription: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 10 },
  upiHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  cashOnlyBadge: { backgroundColor: '#25272c' },
  cashOnlyText: { color: '#a5a9b2' },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  methodIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#191b1d', alignItems: 'center', justifyContent: 'center' },
  enabledBadge: { backgroundColor: '#13291b', borderRadius: 15, paddingHorizontal: 11, paddingVertical: 6 },
  upiRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 19 },
  operatorIdentity: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, backgroundColor: '#090b0d', borderRadius: 14, marginTop: 4 },
  operatorAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center' },
  operatorInitial: { color: '#090b0d', fontSize: 20, fontWeight: '800' },
  operatorName: { color: '#f5f4f0', fontSize: 13, fontWeight: '700' },
  accessIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#191c20' },
  switchTouch: { minWidth: 52, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  switchTrack: { width: 50, height: 28, borderRadius: 14, padding: 3 },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#090b0d' },
  embeddedOverlay: { backgroundColor: '#090b0d', justifyContent: 'flex-start' },
  embeddedSheet: { flex: 1, height: '100%', maxWidth: 720, paddingTop: 12, borderTopLeftRadius: 0, borderTopRightRadius: 0, backgroundColor: '#090b0d' },
  overlay: { flex: 1, backgroundColor: '#14273d80', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 560, height: '96%', backgroundColor: '#090b0d', borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, paddingBottom: 18, gap: 14 },
  eyebrow: { color: '#ffb313', fontSize: 9, letterSpacing: 1.6, fontWeight: '700' },
  title: { color: '#f5f4f0', fontSize: 28, fontWeight: '800', letterSpacing: -0.7, marginTop: 5 },
  close: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#202329', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: '#17191d', borderRadius: 15, marginHorizontal: 20, marginBottom: 16 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 }, tabActive: { backgroundColor: '#ffb313' },
  tabText: { color: '#a5a9b2', fontSize: 12, fontWeight: '600' }, tabTextActive: { color: '#090b0d', fontWeight: '700' },
  content: { paddingHorizontal: 18, paddingBottom: 16 }, identity: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 20, paddingHorizontal: 3 },
  identityIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: '#26292e', backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },
  shopName: { color: '#f5f4f0', fontSize: 15, fontWeight: '700' }, identityCopy: { color: '#8495a8', fontSize: 10, marginTop: 5 },
  badge: { backgroundColor: '#15231c', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 }, badgeText: { color: '#47db85', fontSize: 9, fontWeight: '600' },
  card: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 19, padding: 18, marginBottom: 16 },
  sectionTitle: { color: '#f5f4f0', fontSize: 16, fontWeight: '700' }, copy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 6, marginBottom: 13 },
  field: { marginTop: 16 }, label: { color: '#b6bac2', fontSize: 11, fontWeight: '600', marginBottom: 8 },
  input: { minHeight: 47, backgroundColor: '#090b0d', borderWidth: 1, borderColor: '#26292e', borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: '#f5f4f0' },
  locked: { backgroundColor: '#17191d', color: '#a5a9b2' }, hint: { color: '#a5a9b2', fontSize: 11, lineHeight: 17, marginTop: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, backgroundColor: '#090b0d', borderRadius: 14, padding: 14 }, switchTitle: { fontSize: 13, color: '#e5e6e8', fontWeight: '600' }, smallNote: { color: '#8293a7', fontSize: 10, marginTop: 13 },
  methodRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12, padding: 13, backgroundColor: '#090b0d', borderRadius: 14 }, methodBadge: { color: '#47db85', fontSize: 10, fontWeight: '600' }, divider: { height: 1, backgroundColor: '#26292e', marginVertical: 17 },
  paymentNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#211a07', borderWidth: 1, borderColor: '#3a2c07', padding: 16, borderRadius: 18 }, paymentNoteText: { flex: 1, color: '#f5cf76', fontSize: 11, lineHeight: 18 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, actionTitle: { fontSize: 13, color: '#e5e6e8', fontWeight: '600' }, chevron: { fontSize: 24, color: '#8fa0b4' },
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#090b0d' }, footerHint: { fontSize: 10, color: '#8d9bad', textAlign: 'center', marginBottom: 10 },
  save: { flexDirection: 'row', gap: 7, minHeight: 46, backgroundColor: '#ffb313', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, saveDisabled: { backgroundColor: '#17191d', borderWidth: 1, borderColor: '#26292e' }, saveTextDisabled: { color: '#7f8793' }, saveText: { color: '#090b0d', fontWeight: '700', fontSize: 14 },
  error: { color: '#b43f3f', fontSize: 12, lineHeight: 18, marginBottom: 10 }, saved: { color: '#2a8a6a', fontSize: 12, textAlign: 'center', marginBottom: 10 }, notice: { color: '#8b651d', fontSize: 12, lineHeight: 19, marginBottom: 15 }
});
