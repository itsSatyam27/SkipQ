import React, { useContext, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, FlatList, SafeAreaView } from 'react-native';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';

export default function Header({ onOpenPassModal, onOpenProfileModal, onOpenHistoryModal }) {
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
    banUntil
  } = useContext(AppContext);
  const [uniModalVisible, setUniModalVisible] = useState(false);

  const activeUniObj = DEFAULT_UNIVERSITIES.find(u => u.id === university) || DEFAULT_UNIVERSITIES[0];
  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj && activeOrderObj.orderStatus !== 'Completed' && activeOrderObj.orderStatus !== 'Cancelled';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerContainer}>
        {/* Top Row: Brand, User Profile, Wallet & Active Pass */}
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.brandWrapper} onPress={onOpenProfileModal}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.brandName}>SkipQ</Text>
                <Text style={styles.campusBadge}>LIVE</Text>
              </View>
              <Text style={styles.brandTagline} numberOfLines={1}>
                {userProfile?.name ? `👋 ${userProfile.name}` : 'Zero-Queue Campus Canteen'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.rightActions}>
            {/* Wallet Balance Badge */}
            <TouchableOpacity style={styles.walletBadge} onPress={onOpenProfileModal}>
              <Text style={styles.walletText}>👛 ₹{walletBalance.toFixed(0)}</Text>
            </TouchableOpacity>

            {/* Order History Button */}
            {onOpenHistoryModal && (
              <TouchableOpacity style={styles.profileBtn} onPress={onOpenHistoryModal}>
                <Text style={styles.profileBtnIcon}>📜</Text>
              </TouchableOpacity>
            )}

            {/* Profile Avatar Button */}
            <TouchableOpacity style={styles.profileBtn} onPress={onOpenProfileModal}>
              <Text style={styles.profileBtnIcon}>👤</Text>
            </TouchableOpacity>

            {/* Active Pass Badge */}
            {hasActivePass && (
              <TouchableOpacity style={styles.activePassPill} onPress={onOpenPassModal}>
                <Text style={styles.activePassPillText}>🎫 #{activeOrderObj.tokenNumber}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Penalty Warning Banner */}
        {banStatus !== 'active' && (
          <View style={[styles.banBanner, banStatus === 'perm_ban' ? styles.banPerm : styles.banTemp]}>
            <Text style={styles.banBannerText}>
              {banStatus === 'perm_ban'
                ? '🚫 ACCOUNT PERMANENTLY BANNED due to uncollected orders'
                : `⚠️ TEMPORARY BAN ACTIVE: Blocked until ${banUntil ? new Date(banUntil).toLocaleDateString() : '3 days'}`}
            </Text>
          </View>
        )}

        {/* Controls Row: Campus Selector & Role Toggle */}
        <View style={styles.controlsRow}>
          {/* Campus Selector */}
          <TouchableOpacity style={styles.uniPickerBtn} onPress={() => setUniModalVisible(true)}>
            <Text style={styles.uniPickerText} numberOfLines={1}>
              📍 {activeUniObj.name}
            </Text>
            <Text style={styles.uniDropdownArrow}>▼</Text>
          </TouchableOpacity>

          {/* Role Switcher */}
          <View style={styles.roleSegment}>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'buyer' && styles.roleBtnActive]}
              onPress={() => setRole('buyer')}
            >
              <Text style={[styles.roleBtnText, role === 'buyer' && styles.roleBtnTextActive]}>
                🎓 Student
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.roleBtn, role === 'seller' && styles.roleBtnActive]}
              onPress={() => setRole('seller')}
            >
              <Text style={[styles.roleBtnText, role === 'seller' && styles.roleBtnTextActive]}>
                🏪 Canteen POS
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* University Modal */}
      <Modal visible={uniModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Campus / University</Text>
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
                  <View>
                    <Text style={[styles.uniItemText, university === item.id && styles.uniItemTextActive]}>
                      🏫 {item.name}
                    </Text>
                    <Text style={styles.uniItemCity}>{item.city}</Text>
                  </View>
                  {university === item.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setUniModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#0b1120',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  brandWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logoBadge: {
    width: 36,
    height: 36,
    backgroundColor: '#6366f1',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  campusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    color: '#10b981',
    fontSize: 8,
    fontWeight: '900',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  brandTagline: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#06b6d4',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  walletText: {
    color: '#06b6d4',
    fontSize: 11,
    fontWeight: '800',
  },
  profileBtn: {
    backgroundColor: '#1e293b',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  profileBtnIcon: {
    fontSize: 13,
  },
  activePassPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  activePassPillText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  banBanner: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
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
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  uniPickerBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  uniPickerText: {
    color: '#f1f5f9',
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  uniDropdownArrow: {
    color: '#64748b',
    fontSize: 9,
    marginLeft: 4,
  },
  roleSegment: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
  },
  roleBtnActive: {
    backgroundColor: '#6366f1',
  },
  roleBtnText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  roleBtnTextActive: {
    color: '#ffffff',
  },
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
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  uniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  uniItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  uniItemText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
  },
  uniItemTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  uniItemCity: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#6366f1',
    fontWeight: '900',
    fontSize: 16,
  },
  modalCloseBtn: {
    marginTop: 14,
    padding: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#94a3b8',
    fontWeight: '700',
  }
});
