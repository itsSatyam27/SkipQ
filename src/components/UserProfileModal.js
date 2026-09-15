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

export default function UserProfileModal({ visible, onClose }) {
  const {
    userProfile,
    updateUserProfile,
    walletBalance,
    topUpWallet,
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

  const handleAddMoney = async (amount) => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount to top up.');
      return;
    }
    await topUpWallet(val);
    Alert.alert('₹' + val + ' Added', `Your new SkipQ Wallet balance is ₹${walletBalance + val}`);
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  walletCard: {
    backgroundColor: '#1e1b4b',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 14,
  },
  walletLabel: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  walletBal: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    marginVertical: 4,
  },
  walletDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 10,
  },
  topUpRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTopUpBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  quickTopUpText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  statusBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  statusSub: {
    color: '#94a3b8',
    fontSize: 12,
  },
  sectionHeader: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveBtn: {
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
  },
  saveBtnText: {
    color: '#090d16',
    fontWeight: '800',
    fontSize: 14,
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  logoutBtnText: {
    color: '#f87171',
    fontWeight: '800',
    fontSize: 14,
  }
});

