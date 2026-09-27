import React, { useContext, useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList, Platform, StatusBar, Animated } from 'react-native';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

export default function Header({
  onOpenPassModal,
  onOpenProfileModal,
  onOpenHistoryModal,
  isPillVisible,
  onToggleActivePill
}) {
  const {
    university,
    setUniversity,
    role,
    setRole,
    activeOrderId,
    orders,
    walletBalance,
    userProfile,
    banStatus,
    banUntil,
    firebaseActive
  } = useContext(AppContext);
  const [uniModalVisible, setUniModalVisible] = useState(false);

  const pulseBeacon = useRef(new Animated.Value(1)).current;

  const activeUniObj = DEFAULT_UNIVERSITIES.find(u => u.id === university) || DEFAULT_UNIVERSITIES[0];
  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj && activeOrderObj.orderStatus !== 'Completed' && activeOrderObj.orderStatus !== 'Cancelled';

  useEffect(() => {
    if (hasActivePass) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseBeacon, {
            toValue: 1.35,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseBeacon, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [hasActivePass]);

  return (
    <View style={styles.headerWrapper}>
      <View style={styles.headerContainer}>
        {/* Top Minimal Bar */}
        <View style={styles.topRow}>
          {/* Brand & Campus Picker */}
          <TouchableOpacity style={styles.brandContainer} onPress={() => setUniModalVisible(true)} activeOpacity={0.7}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <View style={styles.brandInfo}>
              <View style={styles.brandNameRow}>
                <Text style={styles.brandName}>SkipQ</Text>
                <View style={styles.campusBadge}>
                  <Text style={styles.campusBadgeText}>SOU</Text>
                </View>
              </View>
              <View style={styles.campusPickerLine}>
                <Text style={styles.campusPickerText} numberOfLines={1}>
                  📍 {activeUniObj.name}
                </Text>
                <Text style={styles.campusPickerArrow}>▾</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Right Action Chips */}
          <View style={styles.rightActions}>
            {/* Active Booking Icon (triggers floating dynamic countdown pill) */}
            {hasActivePass && (
              <TouchableOpacity
                style={[styles.activeBookingIconBtn, isPillVisible && styles.activeBookingIconBtnOpen]}
                onPress={onToggleActivePill}
                activeOpacity={0.75}
              >
                <View style={styles.bookingIconWrap}>
                  <Text style={styles.bookingEmoji}>
                    {activeOrderObj.orderStatus === 'Ready' || activeOrderObj.orderStatus === 'Ready for Pickup'
                      ? '🔔'
                      : '🎫'}
                  </Text>
                  <Animated.View
                    style={[
                      styles.beaconDot,
                      {
                        backgroundColor:
                          activeOrderObj.orderStatus === 'Ready' || activeOrderObj.orderStatus === 'Ready for Pickup'
                            ? '#10b981'
                            : '#38bdf8',
                        transform: [{ scale: pulseBeacon }]
                      }
                    ]}
                  />
                </View>
                <Text style={styles.bookingTokenText}>#{activeOrderObj.tokenNumber || 'SQ'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.avatarBtn} onPress={onOpenProfileModal} activeOpacity={0.75}>
              <Text style={styles.avatarText}>{(userProfile?.name || 'S').trim().charAt(0).toUpperCase()}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Vendor Mode Banner (ONLY shown when seller/canteen staff is active) */}
        {role === 'seller' && (
          <View style={styles.sellerBanner}>
            <Text style={styles.sellerBannerText}>🏪 Merchant Kitchen POS Active</Text>
            <TouchableOpacity style={styles.sellerSwitchBtn} onPress={() => setRole('buyer')}>
              <Text style={styles.sellerSwitchText}>Switch to Student ➔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Account Penalty Banner */}
        {banStatus !== 'active' && (
          <View style={[styles.banBanner, banStatus === 'perm_ban' ? styles.banPerm : styles.banTemp]}>
            <Text style={styles.banBannerText}>
              {banStatus === 'perm_ban'
                ? '🚫 Account suspended due to unclaimed orders'
                : `⚠️ Temporary restriction active (${banUntil ? new Date(banUntil).toLocaleDateString() : '3 days'})`}
            </Text>
          </View>
        )}
      </View>

      {/* University Modal */}
      <Modal visible={uniModalVisible} animationType="slide" transparent onRequestClose={() => setUniModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Campus</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setUniModalVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={DEFAULT_UNIVERSITIES}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.uniItem, university === item.id && styles.uniItemActive]}
                  onPress={() => {
                    setUniversity(item.id);
                    setUniModalVisible(false);
                  }}
                >
                  <View style={styles.uniItemLeft}>
                    <Text style={styles.uniEmoji}>🎓</Text>
                    <View>
                      <Text style={[styles.uniItemTitle, university === item.id && styles.uniItemTitleActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.uniItemCity}>{item.city}</Text>
                    </View>
                  </View>
                  {university === item.id && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrapper: {
    backgroundColor: '#f5f3ee',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2ded5',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#1c2521',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#172019',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  brandInfo: {
    justifyContent: 'center',
  },
  brandNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    color: '#1c2521',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  campusBadge: {
    backgroundColor: '#e5eee8',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c7d8cc',
  },
  campusBadgeText: {
    color: '#376048',
    fontSize: 8.5,
    fontWeight: '900',
  },
  campusPickerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  campusPickerText: {
    color: '#65736a',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 160,
  },
  campusPickerArrow: {
    color: '#9a9187',
    fontSize: 11,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cloudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  cloudPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  cloudPillSandbox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  cloudDot: {
    fontSize: 8,
  },
  cloudText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
  },
  cloudTextActive: {
    color: '#10b981',
  },
  walletPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  walletText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  activeBookingIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1c2521',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#4d8062',
  },
  activeBookingIconBtnOpen: {
    backgroundColor: '#314238',
    borderColor: '#a8d0b4',
    shadowColor: '#4d8062',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  bookingIconWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingEmoji: {
    fontSize: 13,
  },
  beaconDot: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bookingTokenText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e5eee8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#c7d8cc',
  },
  avatarText: {
    color: '#376048',
    fontSize: 12,
    fontWeight: '800',
  },
  sellerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  sellerBannerText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  sellerSwitchBtn: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sellerSwitchText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  banBanner: {
    padding: 6,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  banTemp: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  banPerm: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  banBannerText: {
    color: '#f8fafc',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  uniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
  },
  uniItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
    borderWidth: 1,
  },
  uniItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uniEmoji: {
    fontSize: 18,
  },
  uniItemTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
  },
  uniItemTitleActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  uniItemCity: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  checkIcon: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '900',
  },
});
