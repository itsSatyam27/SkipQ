import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking
} from 'react-native';
import { AppContext } from '../context/AppContext';

export default function VendorProfileModal({ visible, onClose }) {
  const {
    userProfile,
    updateUserProfile,
    canteens,
    sellerShopId,
    updateCanteen,
    orders,
    setRole,
    restartOnboarding,
    logoutUser,
    firebaseActive
  } = useContext(AppContext);

  const currentShop = canteens.find(c => c.id === sellerShopId) || canteens[0] || {};

  // Merchant personal state
  const [vendorName, setVendorName] = useState(userProfile?.name || '');
  const [vendorPhone, setVendorPhone] = useState(userProfile?.phone || '');

  // Stall profile state
  const [stallName, setStallName] = useState(currentShop?.name || '');
  const [stallLocation, setStallLocation] = useState(currentShop?.location || '');
  const [merchantUpi, setMerchantUpi] = useState(currentShop?.upiId || '');
  const [openingHours, setOpeningHours] = useState(currentShop?.openingHours || '08:00 AM - 08:00 PM');
  const [isStallOpen, setIsStallOpen] = useState(currentShop?.status !== 'Closed');

  useEffect(() => {
    if (userProfile) {
      setVendorName(userProfile.name || '');
      setVendorPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  useEffect(() => {
    if (currentShop) {
      setStallName(currentShop.name || '');
      setStallLocation(currentShop.location || '');
      setMerchantUpi(currentShop.upiId || '');
      setOpeningHours(currentShop.openingHours || '08:00 AM - 08:00 PM');
      setIsStallOpen(currentShop.status !== 'Closed');
    }
  }, [currentShop]);

  if (!visible) return null;

  // Calculate Merchant Stats
  const shopOrders = (orders || []).filter(o => o.shopId === currentShop?.id);
  const completedOrders = shopOrders.filter(o => o.orderStatus === 'Completed');
  const todayRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const handleSaveStallProfile = async () => {
    if (!stallName.trim()) {
      Alert.alert('Validation Error', 'Please enter your Canteen / Stall name.');
      return;
    }

    try {
      // Update Merchant Profile
      await updateUserProfile({
        name: vendorName.trim(),
        phone: vendorPhone.trim(),
        userType: 'seller'
      });

      // Update Canteen in Database & App State
      if (currentShop?.id) {
        await updateCanteen(currentShop.id, {
          name: stallName.trim(),
          location: stallLocation.trim(),
          upiId: merchantUpi.trim(),
          openingHours: openingHours.trim(),
          status: isStallOpen ? 'Open' : 'Closed'
        });
      }

      Alert.alert('Settings Saved', 'Your Canteen & Merchant details have been updated.');
      onClose();
    } catch (e) {
      Alert.alert('Update Error', e.message || 'Failed to update canteen information.');
    }
  };

  const handleSwitchToStudent = () => {
    Alert.alert(
      'Switch to Student Mode',
      'Leave the Canteen POS and browse student food radar?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch to Student View',
          onPress: () => {
            onClose();
            setRole('buyer');
          }
        }
      ]
    );
  };

  const handleRestartSetup = () => {
    Alert.alert(
      'Change Role or Campus',
      'This will bring up the onboarding welcome screen where you can switch roles or change campus.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Change Role / Campus',
          onPress: async () => {
            onClose();
            await restartOnboarding();
          }
        }
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of SkipQ Merchant POS? You can log back in anytime with your registered phone number.',
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

  const sendSupportEmail = () => {
    const subject = encodeURIComponent('SkipQ seller support');
    const body = encodeURIComponent('Hi SkipQ team,\n\nI need help with:\n\n\nCanteen / stall name:');
    Linking.openURL(`mailto:skipqueue.official@gmail.com?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('Email unavailable', 'Please email skipqueue.official@gmail.com directly.')
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🏪 Merchant POS Account</Text>
              <Text style={styles.subtitle}>Manage kitchen credentials, stall details & payouts</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollList} showsVerticalScrollIndicator={false}>
            {/* Merchant Identity Card */}
            <View style={styles.merchantCard}>
              <View style={styles.merchantAvatar}>
                <Text style={styles.merchantAvatarEmoji}>🏪</Text>
              </View>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName}>{vendorName || 'Canteen Manager'}</Text>
                <Text style={styles.merchantSub}>📍 Silver Oak University • Campus Partner</Text>
                <View style={styles.roleChip}>
                  <View style={styles.activeDot} />
                  <Text style={styles.roleChipText}>KITCHEN OPERATOR</Text>
                </View>
              </View>
            </View>

            {/* Today's Sales Settlement Summary */}
            <View style={styles.salesCard}>
              <Text style={styles.salesCardLabel}>TODAY'S KITCHEN SETTLEMENT</Text>
              <View style={styles.salesRow}>
                <View style={styles.salesStatCol}>
                  <Text style={styles.salesAmount}>₹{todayRevenue.toFixed(0)}</Text>
                  <Text style={styles.salesSub}>Completed Revenue</Text>
                </View>
                <View style={styles.salesDivider} />
                <View style={styles.salesStatCol}>
                  <Text style={[styles.salesAmount, { color: '#38bdf8' }]}>{completedOrders.length}</Text>
                  <Text style={styles.salesSub}>Orders Handled</Text>
                </View>
              </View>
              <Text style={styles.payoutNotice}>
                ⚡ 100% of student UPI payments settle instantly to your registered UPI address.
              </Text>
            </View>

            {/* Stall Operating Status */}
            <View style={styles.sectionCard}>
              <View style={styles.statusToggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.statusToggleTitle}>Accepting Online Orders</Text>
                  <Text style={styles.statusToggleSub}>
                    {isStallOpen
                      ? '🟢 Stall is LIVE. Students can order dishes on the food radar.'
                      : '🔴 Stall is CLOSED. Your menu is temporarily hidden from ordering.'}
                  </Text>
                </View>
                <Switch
                  value={isStallOpen}
                  onValueChange={setIsStallOpen}
                  trackColor={{ false: '#ef4444', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Stall Information Form */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>🏬 Canteen Stall Profile</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CANTEEN / STALL NAME</Text>
                <TextInput
                  style={styles.textInput}
                  value={stallName}
                  onChangeText={setStallName}
                  placeholder="e.g. Silver Oak Central Food Court"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>CAMPUS LOCATION / BLOCK</Text>
                <TextInput
                  style={styles.textInput}
                  value={stallLocation}
                  onChangeText={setStallLocation}
                  placeholder="e.g. Central Courtyard, Opp. Block A"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>MERCHANT UPI ID (DIRECT PAYMENTS)</Text>
                <TextInput
                  style={styles.textInput}
                  value={merchantUpi}
                  onChangeText={setMerchantUpi}
                  placeholder="e.g. canteen.merchant@upi"
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>DAILY OPERATING HOURS</Text>
                <TextInput
                  style={styles.textInput}
                  value={openingHours}
                  onChangeText={setOpeningHours}
                  placeholder="e.g. 08:00 AM - 08:00 PM"
                  placeholderTextColor="#64748b"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>OPERATOR CONTACT PHONE</Text>
                <TextInput
                  style={styles.textInput}
                  value={vendorPhone}
                  onChangeText={setVendorPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={styles.saveStallBtn}
                onPress={handleSaveStallProfile}
                activeOpacity={0.85}
              >
                <Text style={styles.saveStallBtnText}>Save Stall Settings</Text>
              </TouchableOpacity>
            </View>

            {/* Cloud Database Sync */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>☁️ Cloud Synchronization</Text>
              <View style={styles.cloudInfoBox}>
                <Text style={styles.cloudInfoTitle}>
                  {firebaseActive ? '🟢 Live Cloud Firestore Active' : '⚡ Local KDS Sandbox'}
                </Text>
                <Text style={styles.cloudInfoSub}>
                  {firebaseActive
                    ? 'Orders placed by students across the campus sync to this kitchen POS in real time.'
                    : 'Operating on local device cache.'}
                </Text>
              </View>
            </View>

            {/* Switch Role to Student */}
            <View style={styles.switchRoleCard}>
              <Text style={styles.switchRoleTitle}>🎓 Student Food Ordering</Text>
              <Text style={styles.switchRoleSub}>
                Order food or browse menus from other stalls across the campus food court.
              </Text>
              <TouchableOpacity
                style={styles.switchRoleBtn}
                onPress={handleSwitchToStudent}
                activeOpacity={0.85}
              >
                <Text style={styles.switchRoleBtnText}>Switch to Student View ➔</Text>
              </TouchableOpacity>
            </View>

            {/* Account Actions */}
            <View style={styles.dangerCard}>
              <Text style={styles.dangerTitle}>Merchant Account Actions</Text>
              <View style={styles.dangerButtons}>
                <TouchableOpacity style={styles.onboardBtn} onPress={sendSupportEmail}>
                  <Text style={styles.onboardBtnText}>✉️ Feedback & Support</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.resetBtn} onPress={handleLogout}>
                  <Text style={styles.resetBtnText}>🚪 Log Out</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.onboardBtn} onPress={handleRestartSetup}>
                  <Text style={styles.onboardBtnText}>🏫 Change Role / Campus</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.82)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#070a13',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.5,
    borderColor: '#1e293b',
    maxHeight: '92%',
    paddingTop: 18,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollList: {
    flexGrow: 1,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1527',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 14,
  },
  merchantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#162238',
    borderWidth: 1.5,
    borderColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  merchantAvatarEmoji: {
    fontSize: 24,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  merchantSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#064e3b30',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#10b98140',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  roleChipText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  salesCard: {
    backgroundColor: '#091e1d',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#059669',
    padding: 16,
    marginBottom: 14,
  },
  salesCardLabel: {
    color: '#34d399',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  salesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  salesStatCol: {
    flex: 1,
  },
  salesAmount: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  salesSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 2,
  },
  salesDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#05966940',
    marginHorizontal: 14,
  },
  payoutNotice: {
    color: '#6ee7b7',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#05966930',
  },
  sectionCard: {
    backgroundColor: '#0d1527',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 14,
  },
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusToggleTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusToggleSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#162238',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    color: '#ffffff',
    fontSize: 13.5,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  saveStallBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveStallBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  cloudInfoBox: {
    backgroundColor: '#162238',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  cloudInfoTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cloudInfoSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 15,
  },
  configBtn: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  configBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
  },
  switchRoleCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#4338ca',
    padding: 16,
    marginBottom: 14,
  },
  switchRoleTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  switchRoleSub: {
    color: '#c7d2fe',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
    lineHeight: 16,
  },
  switchRoleBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  switchRoleBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  dangerCard: {
    backgroundColor: '#181119',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#451a24',
    padding: 16,
    marginBottom: 14,
  },
  dangerTitle: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  dangerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: '#27191d',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  resetBtnText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '700',
  },
  onboardBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  onboardBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
});
