import React, { useContext, useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList, Platform, StatusBar, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    sellerShopId,
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

  const isSeller = role === 'seller';

  return (
    <View style={[styles.headerWrapper, isSeller && styles.headerWrapperSeller]}>
      <View style={styles.headerContainer}>
        {/* Top Minimal Bar */}
        <View style={styles.topRow}>
          {/* Brand & Campus Picker */}
          <TouchableOpacity style={styles.brandContainer} onPress={() => setUniModalVisible(true)} activeOpacity={0.7}>
            <LinearGradient
              colors={['#0747a6', '#0097a7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoBadge}
            >
              <Image
                source={require('../../assets/icon.png')}
                style={styles.headerMascotImage}
                resizeMode="contain"
              />
            </LinearGradient>
            <View style={styles.brandInfo}>
              <Text style={[styles.brandName, isSeller && styles.brandNameSeller]}>SkipQ</Text>
              <Text style={[styles.campusPickerText, isSeller && styles.campusPickerTextSeller]} numberOfLines={1}>
                {activeUniObj.name}
              </Text>
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
            <TouchableOpacity
              style={[styles.avatarBtn, isSeller && styles.avatarBtnSeller]}
              onPress={onOpenProfileModal}
              activeOpacity={0.75}
            >
              <Text style={[styles.avatarText, isSeller && styles.avatarTextSeller]}>
                {(userProfile?.name || 'S').trim().charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        </View>


        {/* Student View: Quick Return to Vendor POS if user has a registered stall */}
        {role === 'buyer' && (userProfile?.stallName || userProfile?.userType === 'seller' || sellerShopId) && (
          <View style={[styles.sellerBanner, styles.vendorAvailableBanner]}>
            <Text style={[styles.sellerBannerText, styles.vendorAvailableText]} numberOfLines={1}>
              👨‍🍳 Stall: {userProfile?.stallName || 'My Canteen'}
            </Text>
            <TouchableOpacity style={[styles.sellerSwitchBtn, styles.vendorAvailableBtn]} onPress={() => setRole('seller')} activeOpacity={0.8}>
              <Text style={styles.sellerSwitchText}>Open Kitchen POS ➔</Text>
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
    backgroundColor: '#edf3f8',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 4 : 10,
    borderBottomWidth: 0,
  },
  headerWrapperSeller: {
    backgroundColor: '#edf3f8',
    borderBottomWidth: 0,
  },
  logoBadgeSeller: {},
  logoTextSeller: {
    color: '#ffffff',
  },
  brandNameSeller: {
    color: '#0f172a',
  },
  campusBadgeSeller: {},
  campusBadgeTextSeller: {},
  campusPickerTextSeller: {
    color: '#5a6e85',
  },
  campusPickerArrowSeller: {},
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
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  headerMascotImage: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  brandInfo: {
    justifyContent: 'center',
  },
  brandName: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
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
    backgroundColor: '#ffffff',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#b9d9f5',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  activeBookingIconBtnOpen: {
    backgroundColor: '#e6f2fb',
    borderColor: '#0c52a3',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
    color: '#0c52a3',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#b9d9f5',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarBtnSeller: {
    backgroundColor: '#ffffff',
    borderColor: '#b9d9f5',
  },
  avatarText: {
    color: '#0c52a3',
    fontSize: 13,
    fontWeight: '900',
  },
  avatarTextSeller: {
    color: '#0c52a3',
    fontWeight: '900',
  },
  sellerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e6f4ea',
    borderWidth: 1,
    borderColor: '#a3cfbb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 8,
  },
  sellerBannerText: {
    color: '#0f5132',
    fontSize: 12,
    fontWeight: '800',
  },
  sellerSwitchBtn: {
    backgroundColor: '#198754',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  sellerSwitchText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  vendorAvailableBanner: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  vendorAvailableText: {
    color: '#92400e',
  },
  vendorAvailableBtn: {
    backgroundColor: '#d97706',
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
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '70%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  uniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  uniItemActive: {
    backgroundColor: '#e6f2fb',
    borderColor: '#0c52a3',
    borderWidth: 1.5,
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
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  uniItemTitleActive: {
    color: '#0c52a3',
    fontWeight: '800',
  },
  uniItemCity: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  checkIcon: {
    color: '#0c52a3',
    fontSize: 16,
    fontWeight: '900',
  },
});
