import AppUpdateSettings from './AppUpdateSettings';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppContext } from '../context/AppContext';
import { useSellerStyles } from '../context/SellerTheme';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import InterfaceIcon from './InterfaceIcon';
import NotificationSettings from './NotificationSettings';
import LocationPermissionSettings from './LocationPermissionSettings';

const values = p => ({ name: p?.name || '', rollNo: p?.rollNo || '', facultyRoomNote: p?.facultyRoomNote || '' });
function Field({ label, locked = false, ...props }) {
  const s = useSellerStyles(baseStyles);
  return <View style={s.field}><View style={s.labelRow}><Text style={s.label}>{label}</Text>{locked && <InterfaceIcon name="lock" size={12} color="#a5a9b2" />}</View><TextInput {...props} accessibilityLabel={label} editable={!locked && !props.disabled} style={[s.input, locked && s.locked]} placeholderTextColor="#79818f" /></View>;
}
export default function StudentProfileScreen() {
  const s = useSellerStyles(baseStyles);
  const { userProfile, updateUserProfile, logoutUser, restartOnboarding, university } = useContext(AppContext);
  const [tab, setTab] = useState('Profile');
  const [draft, setDraft] = useState(() => values(userProfile));
  const [baseline, setBaseline] = useState(() => JSON.stringify(values(userProfile)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHowTo, setShowHowTo] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const uidRef = useRef(userProfile?.uid);
  const scroll = useRef(null);
  useEffect(() => {
    if (uidRef.current !== userProfile?.uid || !dirtyRef.current) {
      const next = values(userProfile);
      setDraft(next); setBaseline(JSON.stringify(next)); setError('');
      uidRef.current = userProfile?.uid;
    }
  }, [userProfile?.uid, userProfile?.name, userProfile?.rollNo, userProfile?.facultyRoomNote]);
  const change = (key, value) => { setDraft(old => ({ ...old, [key]: value })); setError(''); };
  const discard = () => { setDraft(JSON.parse(baseline)); setError(''); };
  const save = async () => {
    if (saving || !dirty) return;
    if (!draft.name.trim()) { setError('Add your name so the counter can identify your order.'); return; }
    const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()]));
    setSaving(true); setError('');
    try { await updateUserProfile(next); setDraft(next); setBaseline(JSON.stringify(next)); }
    catch (e) { setError(e.message || 'Could not save. Please retry.'); }
    finally { setSaving(false); }
  };
  const confirmAction = (title, message, action, destructive = false) => Alert.alert(title, dirty ? `${message} Unsaved profile changes will be discarded.` : message, [{ text: 'Cancel', style: 'cancel' }, { text: destructive ? 'Log out' : 'Continue', style: destructive ? 'destructive' : 'default', onPress: action }]);
  const feedback = () => Linking.openURL('mailto:skipqueue.official@gmail.com?subject=SkipQ%20feedback').catch(() => Alert.alert('Contact SkipQ', 'Email skipqueue.official@gmail.com for help.'));
  const faculty = userProfile?.userType === 'faculty';
  const campus = DEFAULT_UNIVERSITIES.find(c => c.id === (userProfile?.universityId || university));
  const action = (icon, title, copy, onPress, danger = false) => <TouchableOpacity accessibilityRole="button" disabled={saving} onPress={onPress} style={s.action}><View style={s.icon}><InterfaceIcon name={icon} color={danger ? '#ef4444' : '#ffb313'} size={19} /></View><View style={s.actionCopy}><Text style={[s.actionTitle, danger && s.danger]}>{title}</Text><Text style={s.copy}>{copy}</Text></View><InterfaceIcon name="chevron" size={17} color="#a5a9b2" /></TouchableOpacity>;
  return <View style={s.container}><ScrollView ref={scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>{faculty ? 'FACULTY ACCOUNT' : 'STUDENT ACCOUNT'}</Text><Text style={s.title}>Account & settings</Text><Text style={s.subtitle}>Your campus details, permissions and support.</Text>
    <View style={s.tabs}>{['Profile', 'Permissions', 'Help'].map(item => <TouchableOpacity key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => { setTab(item); scroll.current?.scrollTo({ y: 0, animated: false }); }} style={[s.tab, tab === item && s.tabActive]}><Text style={[s.tabText, tab === item && s.tabTextActive]}>{item}</Text></TouchableOpacity>)}</View>
    <View style={s.identity}><View style={s.avatar}><Text style={s.initial}>{(userProfile?.name || 'S').slice(0, 1).toUpperCase()}</Text></View><View style={s.actionCopy}><Text style={s.identityName}>{userProfile?.name || 'Your account'}</Text><Text style={s.copy}>{campus?.name || 'Your campus'}</Text><Text style={s.role}>{faculty ? 'Faculty' : 'Student'} · Google linked</Text></View></View>
    {tab === 'Profile' && <>
      <View style={s.card}><Text style={s.cardTitle}>Personal details</Text><Text style={s.subtitle}>Help your canteen identify you at pickup.</Text>
        <Field label="Full name" value={draft.name} onChangeText={v => change('name', v)} disabled={saving} maxLength={80} autoCapitalize="words" placeholder="Your full name" />
        {!faculty && <Field label="Enrollment number · optional" value={draft.rollNo} onChangeText={v => change('rollNo', v)} disabled={saving} maxLength={50} placeholder="Your enrollment number" />}
        {faculty && <Field label="Department / room · optional" value={draft.facultyRoomNote} onChangeText={v => change('facultyRoomNote', v)} disabled={saving} maxLength={160} placeholder="e.g. Block B, Room 204" />}
        <Field label="Phone number" value={userProfile?.phone || ''} locked keyboardType="phone-pad" />
        <Field label="Google email" value={userProfile?.email || ''} locked autoCapitalize="none" />
        <View style={s.notice}><InterfaceIcon name="lock" size={14} color="#a5a9b2" /><Text style={[s.copy, { flex: 1 }]}>Your linked email, phone and account type are fixed after signup.</Text></View>
      </View>
      <View style={s.card}><View style={s.cardHeading}><InterfaceIcon name="cash" color="#ffb313" size={21} /><Text style={s.cardTitle}>Pay at your canteen</Text></View><Text style={s.subtitle}>Pay the full order amount in cash at pickup or delivery. UPI payments are coming soon.</Text></View>
    </>}
    {tab === 'Permissions' && <><NotificationSettings /><LocationPermissionSettings /></>}
    {tab === 'Help' && <><AppUpdateSettings /><View style={s.card}>
      {action('info', 'How to use SkipQ', 'A quick guide to ordering and pickup', () => setShowHowTo(true))}
      {action('support', 'Feedback & Support', 'Contact the SkipQ team', feedback)}
      {action('location', 'Campus and role', 'Review your campus setup', () => confirmAction('Review campus setup?', 'You will return to setup. Your saved orders stay safe.', restartOnboarding))}
      {action('logout', 'Log out', 'Sign out of this device', () => confirmAction('Log out?', 'You will return to the welcome screen.', logoutUser, true), true)}
    </View></>}
    {(dirty || saving || error) && <View style={s.saveBar}><Text accessibilityLiveRegion="polite" style={[s.copy, error && s.danger]}>{error || 'Unsaved profile changes'}</Text><View style={s.saveActions}><TouchableOpacity accessibilityRole="button" disabled={saving} onPress={discard} style={s.discard}><Text style={s.discardText}>Discard</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Save profile changes" disabled={saving} onPress={save} style={s.save}>{saving ? <ActivityIndicator color="#090b0d" /> : <><InterfaceIcon name="check" size={18} color="#090b0d" /><Text style={s.saveText}>Save changes</Text></>}</TouchableOpacity></View></View>}
  </ScrollView>
    <Modal visible={showHowTo} transparent animationType="fade" onRequestClose={() => setShowHowTo(false)}>
      <View style={s.guideOverlay}>
        <View style={s.guideCard}>
          <View style={s.guideHeader}><View style={s.guideIcon}><InterfaceIcon name="info" size={20} color="#ffb313" /></View><View style={{ flex: 1 }}><Text style={s.guideTitle}>How to use SkipQ</Text><Text style={s.copy}>{faculty ? 'Faculty ordering guide' : 'Student ordering guide'}</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close guide" onPress={() => setShowHowTo(false)} style={s.guideClose}><Text style={s.guideCloseText}>×</Text></TouchableOpacity></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.guideContent}>
            <GuideStep number="1" title="Choose your food">Open Explore, pick a canteen, add dishes, then review your cart.</GuideStep>
            <GuideStep number="2" title="Choose pickup or delivery">{faculty ? 'Choose pickup or staff-room delivery. Delivery adds ₹5; enter a clear room or department location.' : 'Choose a pickup time. For group pickup, add the collector’s name so the canteen knows who is collecting.'}</GuideStep>
            <GuideStep number="3" title="Pay the canteen">Pay the full order amount in cash at pickup{faculty ? ' or staff-room delivery' : ''}. UPI payments are coming soon.</GuideStep>
            <GuideStep number="4" title="Collect your order">Show your pickup pass and give the seller your PIN or QR when the order is ready.</GuideStep>
            <View style={s.guideNotice}><Text style={s.guideNoticeText}>The seller will mark your order Ready when it is prepared. Please collect it promptly. If the canteen cancels, contact them about any cash you may already have paid.</Text></View>
          </ScrollView>
          <TouchableOpacity accessibilityRole="button" onPress={() => setShowHowTo(false)} style={s.guideDone}><Text style={s.guideDoneText}>Got it</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}
function GuideStep({ number, title, children }) {
  const s = useSellerStyles(baseStyles);
  return <View style={s.guideStep}><View style={s.guideNumber}><Text style={s.guideNumberText}>{number}</Text></View><View style={{ flex: 1 }}><Text style={s.guideStepTitle}>{title}</Text><Text style={s.guideStepCopy}>{children}</Text></View></View>;
}
const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090b0d' }, content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingTop: 16, paddingBottom: 145 },
  eyebrow: { color: '#ffb313', fontSize: 10, letterSpacing: 1.8, fontWeight: '700', marginBottom: 9 }, title: { color: '#f5f4f0', fontSize: 27, fontWeight: '800', letterSpacing: -0.8 }, subtitle: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 6 },
  tabs: { flexDirection: 'row', backgroundColor: '#121417', borderRadius: 16, padding: 4, marginTop: 23, marginBottom: 22, borderWidth: 1, borderColor: '#26292e' }, tab: { flex: 1, minHeight: 43, justifyContent: 'center', alignItems: 'center', borderRadius: 12 }, tabActive: { backgroundColor: '#ffb313' }, tabText: { color: '#a5a9b2', fontSize: 12, fontWeight: '700' }, tabTextActive: { color: '#090b0d' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 23 }, avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#090b0d', fontSize: 24, fontWeight: '800' }, identityName: { color: '#f5f4f0', fontSize: 17, fontWeight: '700' }, role: { color: '#ffb313', fontSize: 10, marginTop: 5 },
  card: { borderWidth: 1, borderColor: '#26292e', backgroundColor: '#121417', borderRadius: 20, padding: 18, marginBottom: 16 }, cardTitle: { color: '#f5f4f0', fontSize: 16, fontWeight: '700' }, cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  field: { marginTop: 18 }, labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 }, label: { color: '#a5a9b2', fontSize: 11, fontWeight: '600' }, input: { color: '#f5f4f0', backgroundColor: '#090b0d', borderColor: '#26292e', borderWidth: 1, borderRadius: 12, minHeight: 47, paddingHorizontal: 13, paddingVertical: 12, fontSize: 13 }, locked: { color: '#a5a9b2', backgroundColor: '#17191d' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 16 }, copy: { color: '#a5a9b2', fontSize: 11, lineHeight: 17, marginTop: 2 }, action: { flexDirection: 'row', gap: 11, alignItems: 'center', paddingVertical: 15 }, icon: { width: 37, height: 37, borderRadius: 11, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' }, actionCopy: { flex: 1, minWidth: 0 }, actionTitle: { color: '#f5f4f0', fontSize: 13, fontWeight: '600' }, danger: { color: '#ef4444' },
  guideOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.7)' }, guideCard: { width: '100%', maxWidth: 500, maxHeight: '90%', borderRadius: 22, borderWidth: 1, borderColor: '#34373d', backgroundColor: '#121417', padding: 18 }, guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#26292e' }, guideIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#211a07' }, guideTitle: { color: '#f5f4f0', fontSize: 17, fontWeight: '800' }, guideClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#202329' }, guideCloseText: { color: '#f5f4f0', fontSize: 25, lineHeight: 28 }, guideContent: { paddingVertical: 5 }, guideStep: { flexDirection: 'row', gap: 12, paddingVertical: 13 }, guideNumber: { width: 27, height: 27, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#292418' }, guideNumberText: { color: '#ffb313', fontSize: 12, fontWeight: '800' }, guideStepTitle: { color: '#f5f4f0', fontSize: 13, fontWeight: '700' }, guideStepCopy: { color: '#a5a9b2', fontSize: 11, lineHeight: 17, marginTop: 4 }, guideNotice: { backgroundColor: '#211a07', borderWidth: 1, borderColor: '#3a2c07', borderRadius: 13, padding: 12, marginTop: 4 }, guideNoticeText: { color: '#f5cf76', fontSize: 11, lineHeight: 17 }, guideDone: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#ffb313', marginTop: 13 }, guideDoneText: { color: '#090b0d', fontSize: 13, fontWeight: '800' },
  saveBar: { backgroundColor: '#121417', borderColor: '#26292e', borderWidth: 1, borderRadius: 18, padding: 16, marginTop: 4 }, saveActions: { flexDirection: 'row', gap: 10, marginTop: 12 }, discard: { paddingHorizontal: 16, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#26292e', borderRadius: 12 }, discardText: { color: '#a5a9b2', fontSize: 12, fontWeight: '600' }, save: { flex: 1, flexDirection: 'row', gap: 8, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#ffb313' }, saveText: { color: '#090b0d', fontSize: 13, fontWeight: '700' },
});
