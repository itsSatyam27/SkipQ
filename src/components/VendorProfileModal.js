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



            {/* Account Actions */}
            <View style={styles.actionListCard}>
              <Text style={styles.actionListHeader}>MERCHANT CONTROLS</Text>

              <TouchableOpacity style={styles.actionListRow} onPress={sendSupportEmail} activeOpacity={0.7}>
                <View style={styles.actionListLeft}>
                  <Text style={styles.actionListEmoji}>✉️</Text>
                  <View>
                    <Text style={styles.actionListTitle}>Feedback & Support</Text>
                    <Text style={styles.actionListSub}>Contact the SkipQ team</Text>
                  </View>
                </View>
                <Text style={styles.actionListArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              <TouchableOpacity style={styles.actionListRow} onPress={handleRestartSetup} activeOpacity={0.7}>
                <View style={styles.actionListLeft}>
                  <Text style={styles.actionListEmoji}>🏫</Text>
                  <View>
                    <Text style={styles.actionListTitle}>Change Role / Campus</Text>
                    <Text style={styles.actionListSub}>Reconfigure initial setup</Text>
                  </View>
                </View>
                <Text style={styles.actionListArrow}>›</Text>
              </TouchableOpacity>

              <View style={styles.actionDivider} />

              <TouchableOpacity style={styles.actionListRow} onPress={handleLogout} activeOpacity={0.7}>
                <View style={styles.actionListLeft}>
                  <Text style={styles.actionListEmoji}>🚪</Text>
                  <View>
                    <Text style={[styles.actionListTitle, { color: '#ef4444' }]}>Log Out</Text>
                    <Text style={styles.actionListSub}>Sign out of this merchant POS session</Text>
                  </View>
                </View>
                <Text style={[styles.actionListArrow, { color: '#ef4444' }]}>›</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    maxHeight: '92%',
    paddingTop: 20,
    paddingHorizontal: 18,
    shadowColor: '#64748b',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  title: {
    color: '#0f172a',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 12.5,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  scrollList: {
    flexGrow: 1,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    marginBottom: 14,
  },
  merchantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#e6f2fb',
    borderWidth: 1.5,
    borderColor: '#0c52a3',
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
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  merchantSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#e6f2fb',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0c52a3',
  },
  roleChipText: {
    color: '#0c52a3',
    fontSize: 10,
    fontWeight: '900',
  },
  salesCard: {
    backgroundColor: '#0c52a3',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  salesCardLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
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
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  salesDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    marginHorizontal: 14,
  },
  payoutNotice: {
    color: '#ccfbf1',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusToggleTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  statusToggleSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  saveStallBtn: {
    backgroundColor: '#0c52a3',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  saveStallBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  cloudInfoBox: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 6,
  },
  cloudInfoTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  cloudInfoSub: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 15,
  },
  configBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  configBtnText: {
    color: '#0c52a3',
    fontSize: 13,
    fontWeight: '800',
  },
  switchRoleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  switchRoleTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  switchRoleSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
    lineHeight: 16,
  },
  switchRoleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0c52a3',
    paddingVertical: 12,
    alignItems: 'center',
  },
  switchRoleBtnText: {
    color: '#0c52a3',
    fontSize: 13.5,
    fontWeight: '900',
  },
  actionListCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionListHeader: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  actionListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionListLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionListEmoji: {
    fontSize: 18,
  },
  actionListTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  actionListSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  actionListArrow: {
    color: '#94a3b8',
    fontSize: 22,
    fontWeight: '300',
  },
  actionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 46,
  },
});
