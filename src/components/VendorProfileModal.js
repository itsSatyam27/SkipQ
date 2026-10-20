import AppUpdateSettings from './AppUpdateSettings';
import NotificationSettings from './NotificationSettings';
import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Modal, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import InterfaceIcon from './InterfaceIcon';
import { selectOwnedCanteen } from '../services/sellerCanteen.cjs';
import { validateSellerSettings, parseWorkingHours, formatWorkingTime, formatWorkingHours } from '../services/sellerSettings.cjs';
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
function WorkingHoursPicker({ visible, value, target, styles, onCancel, onConfirm }) {
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [period, setPeriod] = useState('AM');
  useEffect(() => {
    if (!visible) return;
    const total = Number(value) || 0;
    const hours = Math.floor(total / 60) % 24;
    setHour(hours % 12 || 12);
    setMinute(total % 60);
    setPeriod(hours < 12 ? 'AM' : 'PM');
  }, [visible, value]);
  const selectedMinutes = (hour % 12 + (period === 'PM' ? 12 : 0)) * 60 + minute;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <View style={styles.timePickerOverlay}>
      <View style={styles.timePickerCard}>
        <Text style={styles.timePickerTitle}>Select {target === 'start' ? 'start' : 'end'} time</Text>
        <Text style={styles.timePreview}>{formatWorkingTime(selectedMinutes)}</Text>
        <Text style={styles.timePickerLabel}>Hour</Text>
        <View style={styles.timeOptions}>
          {Array.from({ length: 12 }, (_, index) => index + 1).map(option => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ checked: hour === option }} onPress={() => setHour(option)} style={[styles.timeOption, hour === option && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, hour === option && styles.timeOptionTextSelected]}>{option}</Text></TouchableOpacity>)}
        </View>
        <Text style={styles.timePickerLabel}>Minutes</Text>
        <View style={styles.timeOptions}>
          {Array.from({ length: 12 }, (_, index) => index * 5).map(option => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ checked: minute === option }} onPress={() => setMinute(option)} style={[styles.timeOption, minute === option && styles.timeOptionSelected]}><Text style={[styles.timeOptionText, minute === option && styles.timeOptionTextSelected]}>{String(option).padStart(2, '0')}</Text></TouchableOpacity>)}
        </View>
        <View style={styles.periodRow}>
          {['AM', 'PM'].map(option => <TouchableOpacity key={option} accessibilityRole="radio" accessibilityState={{ checked: period === option }} onPress={() => setPeriod(option)} style={[styles.periodOption, period === option && styles.periodOptionSelected]}><Text style={[styles.periodOptionText, period === option && styles.periodOptionTextSelected]}>{option}</Text></TouchableOpacity>)}
        </View>
        <View style={styles.timePickerActions}>
          <TouchableOpacity accessibilityRole="button" onPress={onCancel} style={styles.timeCancel}><Text style={styles.timeCancelText}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => onConfirm(selectedMinutes)} style={[styles.save, { flex: 1 }]}><Text style={styles.saveText}>Set time</Text></TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>;
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
  const [showHowTo, setShowHowTo] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null);
  const [timePickerValue, setTimePickerValue] = useState(0);
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
  const workingHours = parseWorkingHours(draft.openingHours);
  useEffect(() => {
    if (!visible || dirty || saving) return;
    const next = snapshot(userProfile, shop);
    setDraft(next);
    setBaseline(JSON.stringify(next));
  }, [visible, dirty, saving, shop?.status, shop?.name, shop?.location, shop?.upiId, shop?.openingHours, userProfile?.name]);
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
  const openTimePicker = target => {
    setTimePickerValue(workingHours[target === 'start' ? 0 : 1]);
    setTimePickerTarget(target);
  };
  const setWorkingTime = value => {
    const next = [...workingHours];
    next[timePickerTarget === 'start' ? 0 : 1] = value;
    change('openingHours', formatWorkingHours(next[0], next[1]));
    setTimePickerTarget(null);
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
          <View style={styles.identity}><View style={styles.identityIcon}><InterfaceIcon name="shop" color="#ffb313" size={21} /></View><View style={{ flex: 1 }}><Text style={styles.shopName}>{shop?.name || userProfile.stallName || 'Your canteen'}</Text><Text style={styles.identityCopy}>{campus?.name || university}</Text></View><View style={styles.badge}><Text style={styles.badgeText}>{sellerApproved ? 'Approved' : 'Not approved'}</Text></View></View>
          {!shop && <Text style={styles.notice}>Your canteen is being set up. Return to the workspace and finish setup before editing settings.</Text>}
          {tab === 'Canteen' && <>
            <Section title="Order availability" copy="Control when customers can place new orders.">
              <View style={styles.switchRow}><View style={{ flex: 1, paddingRight: 15 }}><Text style={styles.switchTitle}>{draft.isOpen ? 'Accepting orders' : 'Orders paused'}</Text><Text style={styles.hint}>{draft.isOpen ? 'Your canteen can receive new orders.' : 'Existing orders still need to be completed.'}</Text></View><AvailabilitySwitch value={draft.isOpen} disabled={!shop || saving} onChange={value => change('isOpen', value)} /></View>
              <Text style={styles.smallNote}>Availability changes take effect when you save.</Text>
            </Section>
            <Section title="Canteen details" copy="Keep the information customers see up to date.">
              <Field label="Canteen name" value={draft.stallName} onChangeText={value => change('stallName', value)} placeholder="Your canteen name" maxLength={100} locked={!shop || saving} />
              <Field label="Location on campus" value={draft.location} onChangeText={value => change('location', value)} placeholder="e.g. Block A, ground floor" maxLength={150} locked={!shop || saving} />
              <View style={styles.field}>
                <View style={styles.fieldLabelRow}><Text style={[styles.label, { marginBottom: 0 }]}>Working hours</Text></View>
                <View style={styles.workingHoursRow}>
                  {[['start', 'Opens'], ['end', 'Closes']].map(([target, label]) => <View key={target} style={styles.workingHoursColumn}>
                    <Text style={styles.workingHoursLabel}>{label}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Select ${label.toLowerCase()} time`} disabled={!shop || saving} onPress={() => openTimePicker(target)} style={[styles.input, styles.workingHoursButton, (!shop || saving) && styles.locked]}>
                      <InterfaceIcon name="clock" size={17} color="#ffb313" />
                      <Text style={styles.workingHoursValue}>{draft.openingHours ? formatWorkingTime(workingHours[target === 'start' ? 0 : 1]) : 'Select time'}</Text>
                      <Text style={styles.workingHoursChevron}>›</Text>
                    </TouchableOpacity>
                  </View>)}
                </View>
                <Text style={styles.hint}>Set when customers can visit your canteen. Use the availability switch to pause orders.</Text>
              </View>
              <Field label="Campus" value={campus?.name || university} locked hint="Your registered campus is linked to this canteen." />
            </Section>
          </>}
          {tab === 'Payments' && <>
            <Section title="Payment methods" copy="Cash is currently available. Online payments will be added later.">
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodHeading}>
                  <View style={styles.methodIcon}><InterfaceIcon name="cash" size={19} color="#ffb313" /></View>
                  <Text style={[styles.switchTitle, { flex: 1 }]}>Cash at pickup</Text>
                  <View style={styles.enabledBadge}><Text style={styles.methodBadge}>Enabled</Text></View>
                </View>
                <Text style={styles.paymentDescription}>Collect the full order amount in cash at pickup or staff-room delivery.</Text>
              </View>
              <View style={styles.paymentMethodCard}>
                <View style={styles.paymentMethodHeading}>
                  <View style={styles.methodIcon}><InterfaceIcon name="phone" size={19} color="#ffb313" /></View>
                  <Text style={[styles.switchTitle, { flex: 1 }]}>UPI payment</Text>
                  <View style={[styles.enabledBadge, styles.cashOnlyBadge]}><Text style={[styles.methodBadge, styles.cashOnlyText]}>Coming soon</Text></View>
                </View>
                <Text style={styles.paymentDescription}>Customers cannot select UPI yet. It will be available in a future update.</Text>
              </View>
            </Section>
          </>}
          {tab === 'Profile' && <>
            <Section title="Operator account" copy="Your Google account and phone stay linked to your registration.">
              <View style={styles.operatorIdentity}><View style={styles.operatorAvatar}><Text style={styles.operatorInitial}>{(draft.name.trim() || 'S').charAt(0).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={styles.operatorName}>{userProfile.name || 'Your account'}</Text><Text style={styles.hint}>Seller</Text></View></View>
              <Field label="Full name" value={draft.name} onChangeText={value => change('name', value)} placeholder="Your full name" maxLength={100} locked={saving} />
              <Field label="Google email" value={userProfile.email || ''} locked />
              <Field label="Phone number" value={userProfile.phone || ''} locked />
              <Field label="Account type" value="Seller" locked />
            </Section>
            <AppUpdateSettings />
            <NotificationSettings />
            <Section title="Help and access">
              <TouchableOpacity accessibilityRole="button" onPress={() => setShowHowTo(true)} style={styles.action}><View style={styles.accessIcon}><InterfaceIcon name="info" size={18} color="#ffb313" /></View><View style={{ flex: 1 }}><Text style={styles.actionTitle}>How to use seller POS</Text><Text style={styles.hint}>Orders, payments, pickup and no-shows.</Text></View><Text style={styles.chevron}>›</Text></TouchableOpacity>
              <View style={styles.divider} />
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
  return <>{embedded ? content : <Modal visible animationType="slide" transparent onRequestClose={close}>{content}</Modal>}
    <WorkingHoursPicker visible={!!timePickerTarget} value={timePickerValue} target={timePickerTarget} styles={styles} onCancel={() => setTimePickerTarget(null)} onConfirm={setWorkingTime} />
    <Modal visible={showHowTo} transparent animationType="fade" onRequestClose={() => setShowHowTo(false)}>
      <View style={styles.guideOverlay}>
        <View style={styles.guideCard}>
          <View style={styles.guideHeader}><View style={styles.guideIcon}><InterfaceIcon name="info" size={20} color="#ffb313" /></View><View style={{ flex: 1 }}><Text style={styles.guideTitle}>How to use seller POS</Text><Text style={styles.hint}>A quick guide to handling orders</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close seller guide" onPress={() => setShowHowTo(false)} style={styles.guideClose}><Text style={styles.guideCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.guideContent}>
            <SellerGuideStep styles={styles} number="1" title="Review incoming orders">Open Orders to check each order’s dishes, pickup time and any student group-collector or faculty staff-room delivery details.</SellerGuideStep>
            <SellerGuideStep styles={styles} number="2" title="Payment is cash only">Collect the full order amount in cash at pickup or staff-room delivery. UPI payments are coming soon.</SellerGuideStep>
            <SellerGuideStep styles={styles} number="3" title="Prepare and mark Ready">Start preparing the order and mark it Ready for Pickup when it is complete.</SellerGuideStep>
            <SellerGuideStep styles={styles} number="4" title="Collect payment and hand over">Collect the full amount in cash. Then ask the customer to show their pass and scan its QR or enter its PIN.</SellerGuideStep>
            <View style={styles.guideNotice}><Text style={styles.guideNoticeText}>No-show: wait until the order has been Ready for 15 minutes before marking it No-Show. If the customer has already paid cash and the order is cancelled, arrange its return directly; UPI payments are coming soon.</Text></View>
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" onPress={() => setShowHowTo(false)} style={styles.guideDone}><Text style={styles.guideDoneText}>Got it</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>;
}
function SellerGuideStep({ styles, number, title, children }) {
  return <View style={styles.guideStep}><View style={styles.guideNumber}><Text style={styles.guideNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={styles.guideStepTitle}>{title}</Text><Text style={styles.guideStepCopy}>{children}</Text></View></View>;
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
  workingHoursRow: { flexDirection: 'row', gap: 12 },
  workingHoursColumn: { flex: 1, minWidth: 0 },
  workingHoursLabel: { color: '#a5a9b2', fontSize: 11, fontWeight: '600', marginBottom: 7 },
  workingHoursButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 7 },
  workingHoursValue: { flex: 1, color: '#f5f4f0', fontSize: 13, fontWeight: '600' },
  workingHoursChevron: { color: '#a5a9b2', fontSize: 22, lineHeight: 24 },
  timePickerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.55)' },
  timePickerCard: { width: '100%', maxWidth: 440, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 22, padding: 20 },
  timePickerTitle: { color: '#f5f4f0', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  timePreview: { color: '#ffb313', fontSize: 28, fontWeight: '800', textAlign: 'center', marginVertical: 14 },
  timePickerLabel: { color: '#a5a9b2', fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 7 },
  timeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeOption: { width: '15%', minHeight: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#191c20', borderWidth: 1, borderColor: '#26292e', borderRadius: 9 },
  timeOptionSelected: { backgroundColor: '#292418', borderColor: '#ffb313' },
  timeOptionText: { color: '#e5e6e8', fontSize: 12, fontWeight: '600' },
  timeOptionTextSelected: { color: '#ffb313', fontWeight: '800' },
  periodRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  periodOption: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#191c20', borderWidth: 1, borderColor: '#26292e', borderRadius: 10 },
  periodOptionSelected: { backgroundColor: '#292418', borderColor: '#ffb313' },
  periodOptionText: { color: '#e5e6e8', fontSize: 12, fontWeight: '600' },
  periodOptionTextSelected: { color: '#ffb313', fontWeight: '800' },
  timePickerActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  timeCancel: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#202329', borderRadius: 12 },
  timeCancelText: { color: '#b6bac2', fontSize: 12, fontWeight: '700' },
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
  guideOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.7)' }, guideCard: { width: '100%', maxWidth: 500, maxHeight: '90%', borderRadius: 22, borderWidth: 1, borderColor: '#34373d', backgroundColor: '#121417', padding: 18 }, guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#26292e' }, guideIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#211a07' }, guideTitle: { color: '#f5f4f0', fontSize: 17, fontWeight: '800' }, guideClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#202329' }, guideCloseText: { color: '#f5f4f0', fontSize: 25, lineHeight: 28 }, guideContent: { paddingVertical: 5 }, guideStep: { flexDirection: 'row', gap: 12, paddingVertical: 13 }, guideNumber: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#292418' }, guideNumberText: { color: '#ffb313', fontSize: 12, fontWeight: '800' }, guideStepTitle: { color: '#f5f4f0', fontSize: 13, fontWeight: '700' }, guideStepCopy: { color: '#a5a9b2', fontSize: 11, lineHeight: 17, marginTop: 4 }, guideNotice: { backgroundColor: '#211a07', borderWidth: 1, borderColor: '#3a2c07', borderRadius: 13, padding: 12, marginTop: 4 }, guideNoticeText: { color: '#f5cf76', fontSize: 11, lineHeight: 17 }, guideDone: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#ffb313', marginTop: 13 }, guideDoneText: { color: '#090b0d', fontSize: 13, fontWeight: '800' },
  footer: { paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#090b0d' }, footerHint: { fontSize: 10, color: '#8d9bad', textAlign: 'center', marginBottom: 10 },
  save: { flexDirection: 'row', gap: 7, minHeight: 46, backgroundColor: '#ffb313', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, saveDisabled: { backgroundColor: '#17191d', borderWidth: 1, borderColor: '#26292e' }, saveTextDisabled: { color: '#7f8793' }, saveText: { color: '#090b0d', fontWeight: '700', fontSize: 14 },
  error: { color: '#b43f3f', fontSize: 12, lineHeight: 18, marginBottom: 10 }, saved: { color: '#2a8a6a', fontSize: 12, textAlign: 'center', marginBottom: 10 }, notice: { color: '#8b651d', fontSize: 12, lineHeight: 19, marginBottom: 15 }
});
