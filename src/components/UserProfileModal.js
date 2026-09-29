import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';
import WalletTopUpModal from './WalletTopUpModal';

export default function UserProfileModal({ visible, onClose }) {
  const {
    userProfile,
    updateUserProfile,
    walletBalance,
    unclaimedOrderCount,
    banStatus,
    restartOnboarding,
    logoutUser,
    role,
    setRole
  } = useContext(AppContext);

  const [name, setName] = useState(userProfile?.name || '');
  const [rollNo, setRollNo] = useState(userProfile?.rollNo || '');
  const [facultyId, setFacultyId] = useState(userProfile?.facultyId || '');
  const [roomNumber, setRoomNumber] = useState(userProfile?.roomNumber || userProfile?.facultyRoomNote || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [topUpAmount, setTopUpAmount] = useState('200');
  const [topUpModalVisible, setTopUpModalVisible] = useState(false);
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState(200);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setRollNo(userProfile.rollNo || '');
      setFacultyId(userProfile.facultyId || '');
      setRoomNumber(userProfile.roomNumber || userProfile.facultyRoomNote || '');
      setPhone(userProfile.phone || '');
      setEmail(userProfile.email || '');
    }
  }, [userProfile]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter your Name.');
      return;
    }
    await updateUserProfile({
      name: name.trim(),
      rollNo: rollNo.trim(),
      facultyId: facultyId.trim(),
      roomNumber: roomNumber.trim(),
      facultyRoomNote: roomNumber.trim(),
      phone: phone.trim(),
      email: email.trim()
    });
    Alert.alert('Profile Updated', 'Your campus profile details have been saved.');
    onClose();
  };

  const handleAddMoney = (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to top up.');
      return;
    }
    setSelectedTopUpAmount(val);
    setTopUpModalVisible(true);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of SkipQ? You will need to verify with your mobile number to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await logoutUser();
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>👤 Account & Settings</Text>
              <Text style={styles.modalSubtitle}>
                {userProfile?.name || 'Campus Scholar'} • {userProfile?.phone ? `+91 ${userProfile.phone}` : 'Signed In'}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Wallet Card */}
            <View style={styles.walletCard}>
              <View>
                <Text style={styles.walletLabel}>SKIPQ SECURITY WALLET</Text>
                <Text style={styles.walletBal}>₹{walletBalance.toFixed(2)}</Text>
                <Text style={styles.walletDesc}>Used for refundable security deposit on Cash orders</Text>
              </View>
              <View style={styles.topUpRow}>
                {[100, 200, 500].map(amt => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.quickTopUpBtn}
                    onPress={() => handleAddMoney(amt)}
                  >
                    <Text style={styles.quickTopUpText}>+₹{amt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Account Standing */}
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                Standing: <Text style={{ color: banStatus === 'active' ? '#10b981' : '#ef4444', fontWeight: '800' }}>
                  {banStatus === 'active' ? '✅ Good Standing (0 Strikes)' : `⚠️ ${banStatus.toUpperCase()}`}
                </Text>
              </Text>
              <Text style={styles.statusSub}>Unclaimed Orders: {unclaimedOrderCount}</Text>
            </View>

            {/* Profile Fields */}
            <Text style={styles.sectionHeader}>PERSONAL DETAILS</Text>

            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Aarav Mehta"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />

            {userProfile?.userType === 'faculty' ? (
              <>
                <Text style={styles.label}>Faculty / Staff ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. FAC-CSE-402"
                  placeholderTextColor="#64748b"
                  value={facultyId}
                  onChangeText={setFacultyId}
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Cabin / Department Room (For Room Delivery)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Block B, 3rd Floor, Room 314"
                  placeholderTextColor="#64748b"
                  value={roomNumber}
                  onChangeText={setRoomNumber}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Campus Roll / Student Enrollment ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 210101120042"
                  placeholderTextColor="#64748b"
                  value={rollNo}
                  onChangeText={setRollNo}
                  autoCapitalize="characters"
                />
              </>
            )}

            <Text style={styles.label}>Mobile Phone (SMS Notifications)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 9876543210"
              placeholderTextColor="#64748b"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Campus Email</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. user@silveroakuni.ac.in"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* Save Button */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveProfile}>
              <Text style={styles.saveBtnText}>Save Profile Changes 💾</Text>
            </TouchableOpacity>

            {/* Log Out */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>🚪 Log Out of SkipQ</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Wallet Payment Method Top-Up Modal (UPI / Card / NetBanking) */}
      <WalletTopUpModal
        visible={topUpModalVisible}
        initialAmount={selectedTopUpAmount}
        onClose={() => setTopUpModalVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  walletCard: {
    backgroundColor: '#0c52a3',
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  walletLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  walletBal: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 4,
  },
  walletDesc: {
    color: '#ccfbf1',
    fontSize: 11.5,
    marginBottom: 12,
    fontWeight: '600',
  },
  topUpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTopUpBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  quickTopUpText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  statusBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  statusText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  statusSub: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    color: '#0c52a3',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  saveBtn: {
    backgroundColor: '#0c52a3',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
  logoutBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 32,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontWeight: '800',
    fontSize: 14,
  },
});

