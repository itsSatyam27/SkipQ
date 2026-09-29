import React, { useContext, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../context/AppContext';
import WalletTopUpModal from './WalletTopUpModal';

const Field = ({ label, last, ...props }) => (
  <View style={[styles.field, last && styles.fieldLast]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput style={styles.fieldInput} placeholderTextColor="#94a3b8" {...props} />
  </View>
);

export default function StudentProfileScreen() {
  const { userProfile, updateUserProfile, walletBalance, logoutUser, restartOnboarding, setRole, sellerShopId } = useContext(AppContext);
  const [name, setName] = useState(userProfile?.name || '');
  const [rollNo, setRollNo] = useState(userProfile?.rollNo || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [userType, setUserType] = useState(userProfile?.userType || 'student');
  const [facultyRoomNote, setFacultyRoomNote] = useState(userProfile?.facultyRoomNote || '');
  const [topUpAmount, setTopUpAmount] = useState('200');
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState(200);

  useEffect(() => {
    if (!userProfile) return;
    setName(userProfile.name || '');
    setRollNo(userProfile.rollNo || '');
    setPhone(userProfile.phone || '');
    setUserType(userProfile.userType || 'student');
    setFacultyRoomNote(userProfile.facultyRoomNote || '');
  }, [userProfile]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Add your name', 'Your name helps the counter identify your order.');
    await updateUserProfile({
      name: name.trim(),
      rollNo: rollNo.trim(),
      phone: phone.trim(),
      userType,
      facultyRoomNote: facultyRoomNote.trim()
    });
    Alert.alert('Saved', 'Your profile is up to date.');
  };

  const handleOpenTopUp = value => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert('Enter an amount', 'Please enter a valid wallet top-up amount.');
    setSelectedTopUpAmount(amount);
    setTopUpModalVisible(true);
  };

  const changeSetup = () =>
    Alert.alert('Change campus or role?', 'You will return to setup, but your saved data stays safe.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: restartOnboarding }
    ]);

  const logout = () =>
    Alert.alert('Log out?', 'You will return to the welcome screen.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logoutUser }
    ]);

  const sendFeedback = () => {
    const subject = encodeURIComponent('SkipQ feedback');
    const body = encodeURIComponent('Hi SkipQ team,\n\nMy feedback:\n\n\nDevice / app version (optional):');
    Linking.openURL(`mailto:skipqueue.official@gmail.com?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('Email unavailable', 'Please email skipqueue.official@gmail.com directly.')
    );
  };

  const firstName = name.trim().split(' ')[0] || 'Student';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top greeting */}
        <View style={styles.topLine}>
          <View>
            <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
            <Text style={styles.title}>Hello, {firstName}</Text>
          </View>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>ACTIVE</Text>
          </View>
        </View>

        {/* Identity Card */}
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.trim() ? name.trim()[0].toUpperCase() : 'S'}</Text>
          </View>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{name || 'Campus student'}</Text>
            <Text style={styles.campus}>Silver Oak University • SOU</Text>
            <Text style={styles.memberId}>{rollNo ? `ID: ${rollNo}` : 'Add your enrollment number'}</Text>
          </View>
          <TouchableOpacity style={styles.saveMini} onPress={save}>
            <Text style={styles.saveMiniText}>SAVE</Text>
          </TouchableOpacity>
        </View>

        {/* Ocean Breeze Hero Wallet Card */}
        <LinearGradient
          colors={['#0747a6', '#0070d2', '#00a3c4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          <View style={styles.walletHeader}>
            <View>
              <Text style={styles.walletLabel}>SKIPQ SECURITY WALLET</Text>
              <Text style={styles.walletAmount}>₹{walletBalance.toFixed(0)}</Text>
            </View>
            <View style={styles.walletMark}>
              <Text style={styles.walletMarkText}>Q</Text>
            </View>
          </View>
          <Text style={styles.walletMessage}>Available balance for quick counter food ordering & deposits.</Text>
          <View style={styles.quickAmounts}>
            {[100, 200, 500].map(amount => (
              <TouchableOpacity key={amount} style={styles.amountButton} onPress={() => handleOpenTopUp(amount)}>
                <Text style={styles.amountText}>+ ₹{amount}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.customAmountRow}>
            <TextInput
              style={styles.amountInput}
              value={topUpAmount}
              onChangeText={setTopUpAmount}
              keyboardType="numeric"
              placeholder="Custom amount"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
            />
            <TouchableOpacity style={styles.addButton} onPress={() => handleOpenTopUp(topUpAmount)}>
              <Text style={styles.addButtonText}>ADD</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Account Type Selector */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionKicker}>ACCOUNT TYPE</Text>
          <Text style={styles.sectionHint}>Select how you collect orders at campus counters</Text>
        </View>
        <View style={styles.segment}>
          <TouchableOpacity
            style={[styles.segmentOption, userType === 'student' && styles.segmentSelected]}
            onPress={() => setUserType('student')}
          >
            <Text style={[styles.segmentTitle, userType === 'student' && styles.segmentTitleSelected]}>Student</Text>
            <Text style={[styles.segmentSub, userType === 'student' && styles.segmentSubSelected]}>Standard pickup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentOption, userType === 'faculty' && styles.segmentSelected]}
            onPress={() => setUserType('faculty')}
          >
            <Text style={[styles.segmentTitle, userType === 'faculty' && styles.segmentTitleSelected]}>Faculty</Text>
            <Text style={[styles.segmentSub, userType === 'faculty' && styles.segmentSubSelected]}>Express collection</Text>
          </TouchableOpacity>
        </View>
        {userType === 'faculty' && (
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>⭐ Faculty Express is active</Text>
            <Text style={styles.noteText}>Your order is prioritized at the counter. Add a default room for staff collection.</Text>
            <TextInput
              style={styles.noteInput}
              value={facultyRoomNote}
              onChangeText={setFacultyRoomNote}
              placeholder="Department / staff room (e.g. Block B, Room 204)"
              placeholderTextColor="#94a3b8"
            />
          </View>
        )}

        {/* Personal Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.cardTitle}>Personal details</Text>
          <Text style={styles.cardCaption}>Only the counter details that matter.</Text>
          <Field label="NAME" value={name} onChangeText={setName} placeholder="Your full name" />
          <Field label="ENROLLMENT NUMBER" value={rollNo} onChangeText={setRollNo} placeholder="e.g. 210101120042" />
          <Field label="PHONE" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" last />
          <TouchableOpacity style={styles.saveButton} onPress={save}>
            <Text style={styles.saveButtonText}>SAVE CHANGES</Text>
          </TouchableOpacity>
        </View>

        {/* Actions Card */}
        <View style={styles.actionsCard}>
          {(userProfile?.stallName || userProfile?.userType === 'seller' || sellerShopId) && (
            <>
              <TouchableOpacity style={styles.actionRow} onPress={() => setRole('seller')}>
                <View>
                  <Text style={[styles.actionTitle, { color: '#0c52a3' }]}>🏪 Merchant Kitchen POS</Text>
                  <Text style={styles.actionSub}>Switch to KDS for {userProfile?.stallName || 'your stall'}</Text>
                </View>
                <Text style={[styles.actionArrow, { color: '#0c52a3' }]}>›</Text>
              </TouchableOpacity>
              <View style={styles.divider} />
            </>
          )}
          <TouchableOpacity style={styles.actionRow} onPress={sendFeedback}>
            <View>
              <Text style={styles.actionTitle}>Feedback & Support</Text>
              <Text style={styles.actionSub}>Contact the SkipQ team</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={changeSetup}>
            <View>
              <Text style={styles.actionTitle}>Campus and role</Text>
              <Text style={styles.actionSub}>Change your setup</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={logout}>
            <View>
              <Text style={styles.logoutTitle}>Log out</Text>
              <Text style={styles.actionSub}>Sign out of this device</Text>
            </View>
            <Text style={styles.logoutArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />

        {/* Wallet Payment Method Top-Up Modal */}
        <WalletTopUpModal
          visible={topUpModalVisible}
          initialAmount={selectedTopUpAmount}
          onClose={() => setTopUpModalVisible(false)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edf3f8',
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingTop: 16,
    paddingBottom: 160,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 2,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ccfbf1',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0f766e',
  },
  statusText: {
    color: '#0f766e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#0c52a3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  identityCopy: {
    flex: 1,
  },
  name: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  campus: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  memberId: {
    color: '#0c52a3',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  saveMini: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  saveMiniText: {
    color: '#0c52a3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  walletCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#0070d2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  walletLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  walletAmount: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 2,
  },
  walletMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  walletMarkText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  walletMessage: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  amountButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  amountText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  customAmountRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  amountInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    color: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    fontWeight: '700',
  },
  addButton: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  addButtonText: {
    color: '#0c52a3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  sectionHeader: {
    marginBottom: 8,
  },
  sectionKicker: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sectionHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  segmentOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  segmentSelected: {
    backgroundColor: '#0c52a3',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentTitle: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  segmentTitleSelected: {
    color: '#ffffff',
  },
  segmentSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  segmentSubSelected: {
    color: '#ccfbf1',
  },
  noteCard: {
    backgroundColor: '#e6f2fb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  noteTitle: {
    color: '#0c52a3',
    fontSize: 13,
    fontWeight: '900',
  },
  noteText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  noteInput: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
  },

  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  cardCaption: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  field: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldInput: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
    minHeight: 24,
  },
  saveButton: {
    backgroundColor: '#0c52a3',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 16,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  actionsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  logoutTitle: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
  actionSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  actionArrow: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '300',
  },
  logoutArrow: {
    color: '#ef4444',
    fontSize: 22,
    fontWeight: '300',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 18,
  },
  bottomSpace: {
    height: 20,
  },
});
