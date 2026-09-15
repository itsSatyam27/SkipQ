import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, Text } from 'react-native';
import { AppProvider, AppContext } from './src/context/AppContext';
import Header from './src/components/Header';
import StudentRadarView from './src/components/StudentRadarView';
import StudentCartScreen from './src/components/StudentCartScreen';
import StudentProfileScreen from './src/components/StudentProfileScreen';
import SellerPosView from './src/components/SellerPosView';
import OrderCheckoutModal from './src/components/OrderCheckoutModal';
import DigitalPickupPassModal from './src/components/DigitalPickupPassModal';
import AddMenuItemModal from './src/components/AddMenuItemModal';
import CreateCanteenModal from './src/components/CreateCanteenModal';
import UserProfileModal from './src/components/UserProfileModal';
import OrderHistoryModal from './src/components/OrderHistoryModal';
import OnboardingFlow from './src/components/OnboardingFlow';
import FirebaseConfigModal from './src/components/FirebaseConfigModal';
import DynamicActiveBookingPill from './src/components/DynamicActiveBookingPill';
import CustomAlertModal from './src/components/CustomAlertModal';
import VendorProfileModal from './src/components/VendorProfileModal';
import { registerAlertListener, unregisterAlertListener } from './src/utils/customAlert';

function MainScreen() {
  const {
    role,
    setRole,
    cart,
    activeOrderId,
    orders,
    firebaseConfigModalVisible,
    setFirebaseConfigModalVisible,
    refreshFirebaseState,
    addToCart
  } = useContext(AppContext);

  const [currentTab, setCurrentTab] = useState('explore'); // 'explore' | 'cart' | 'profile'
  const [activeBookingPillVisible, setActiveBookingPillVisible] = useState(false);
  const [globalAlert, setGlobalAlert] = useState(null);

  useEffect(() => {
    registerAlertListener(alertData => {
      setGlobalAlert(alertData);
    });
    return () => {
      unregisterAlertListener();
    };
  }, []);

  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const [passModalVisible, setPassModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [createCanteenModalVisible, setCreateCanteenModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [vendorProfileModalVisible, setVendorProfileModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const handleSelectOrderItem = (shopObj, itemObj) => {
    addToCart(shopObj, itemObj);
    setCurrentTab('cart');
  };

  const handleOpenCartCheckout = () => {
    setCurrentTab('cart');
  };

  const handleOpenEditItem = itemObj => {
    setEditingMenuItem(itemObj);
    setAddItemModalVisible(true);
  };

  const handleOrderPlaced = newOrder => {
    setActiveBookingPillVisible(true);
  };

  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj && activeOrderObj.orderStatus !== 'Completed' && activeOrderObj.orderStatus !== 'Cancelled';

  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);

  return (
    <View style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#070a13" />

      {/* Modern Top Header */}
      <Header
        onOpenPassModal={() => setPassModalVisible(true)}
        onOpenProfileModal={() => setCurrentTab('profile')}
        onOpenHistoryModal={() => setCurrentTab('cart')}
        isPillVisible={activeBookingPillVisible}
        onToggleActivePill={() => setActiveBookingPillVisible(prev => !prev)}
      />

      {/* Floating Dynamic Countdown Island Capsule */}
      <DynamicActiveBookingPill
        visible={activeBookingPillVisible}
        activeOrder={activeOrderObj}
        onClose={() => setActiveBookingPillVisible(false)}
        onOpenPassModal={() => {
          setActiveBookingPillVisible(false);
          setPassModalVisible(true);
        }}
      />

      {/* Main View Switcher */}
      {role === 'buyer' ? (
        currentTab === 'explore' ? (
          <StudentRadarView
            onSelectOrderItem={handleSelectOrderItem}
            onOpenCartCheckout={handleOpenCartCheckout}
            onOpenPassModal={() => setPassModalVisible(true)}
            onOpenHistoryModal={() => setCurrentTab('cart')}
          />
        ) : currentTab === 'cart' ? (
          <StudentCartScreen
            onNavigateToExplore={() => setCurrentTab('explore')}
            onOpenPassModal={() => setPassModalVisible(true)}
            onOrderPlaced={() => setActiveBookingPillVisible(true)}
          />
        ) : (
          <StudentProfileScreen
            onNavigateToExplore={() => setCurrentTab('explore')}
          />
        )
      ) : (
        <SellerPosView
          onOpenAddItemModal={() => {
            setEditingMenuItem(null);
            setAddItemModalVisible(true);
          }}
          onOpenEditItemModal={handleOpenEditItem}
          onOpenCreateCanteenModal={() => setCreateCanteenModalVisible(true)}
        />
      )}

      {/* Modals */}
      <OrderCheckoutModal
        visible={checkoutVisible}
        target={checkoutTarget}
        onClose={() => setCheckoutVisible(false)}
        onOrderPlaced={handleOrderPlaced}
      />

      <DigitalPickupPassModal
        visible={passModalVisible}
        onClose={() => setPassModalVisible(false)}
      />

      <OrderHistoryModal
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        onReorderSuccess={() => {
          setCheckoutTarget(null);
          setCheckoutVisible(true);
        }}
      />

      <AddMenuItemModal
        visible={addItemModalVisible}
        editItem={editingMenuItem}
        onClose={() => {
          setAddItemModalVisible(false);
          setEditingMenuItem(null);
        }}
      />

      <CreateCanteenModal
        visible={createCanteenModalVisible}
        onClose={() => setCreateCanteenModalVisible(false)}
      />

      <UserProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />

      <VendorProfileModal
        visible={vendorProfileModalVisible}
        onClose={() => setVendorProfileModalVisible(false)}
      />

      <FirebaseConfigModal
        visible={firebaseConfigModalVisible}
        onClose={() => setFirebaseConfigModalVisible(false)}
        onConfigSaved={() => {
          refreshFirebaseState();
        }}
      />

      {/* Global Dark Glassmorphic Alert Dialog */}
      <CustomAlertModal
        alertData={globalAlert}
        onClose={() => setGlobalAlert(null)}
      />

      {/* Floating Frosted Glass Bottom Dock */}
      <View style={styles.bottomDockContainer}>
        <View style={styles.bottomBar}>
          {role === 'buyer' ? (
            <>
              {/* 1. Explore Tab: All dishes & stalls */}
              <TouchableOpacity
                style={[styles.bottomTab, currentTab === 'explore' && styles.bottomTabActive]}
                onPress={() => setCurrentTab('explore')}
                activeOpacity={0.8}
              >
                <View style={[styles.tabIconWrap, currentTab === 'explore' && styles.tabIconWrapActive]}>
                  <Text style={styles.tabIcon}>🍽️</Text>
                </View>
                <Text style={[styles.tabLabel, currentTab === 'explore' && styles.tabLabelActive]}>Explore</Text>
              </TouchableOpacity>

              {/* 2. Cart Tab: Items to buy, active pass & past orders */}
              <TouchableOpacity
                style={[styles.bottomTab, currentTab === 'cart' && styles.bottomTabActiveCart]}
                onPress={() => setCurrentTab('cart')}
                activeOpacity={0.8}
              >
                <View style={styles.cartTabWrap}>
                  <Text style={styles.tabIcon}>🛒</Text>
                  {cartTotalItems > 0 ? (
                    <View style={styles.cartTabBadge}>
                      <Text style={styles.cartTabBadgeText}>{cartTotalItems}</Text>
                    </View>
                  ) : hasActivePass ? (
                    <View style={styles.activeDot} />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    currentTab === 'cart'
                      ? styles.tabLabelActiveCart
                      : cartTotalItems > 0
                      ? { color: '#10b981', fontWeight: '800' }
                      : null
                  ]}
                >
                  Cart
                </Text>
              </TouchableOpacity>

              {/* 3. Profile Tab: Student info, wallet, bypass & canteen switcher */}
              <TouchableOpacity
                style={[styles.bottomTab, currentTab === 'profile' && styles.bottomTabActive]}
                onPress={() => setCurrentTab('profile')}
                activeOpacity={0.8}
              >
                <View style={[styles.tabIconWrap, currentTab === 'profile' && styles.tabIconWrapActive]}>
                  <Text style={styles.tabIcon}>👤</Text>
                </View>
                <Text style={[styles.tabLabel, currentTab === 'profile' && styles.tabLabelActive]}>Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* Seller POS Tabs */}
              <TouchableOpacity
                style={[styles.bottomTab, styles.bottomTabActiveSeller]}
                onPress={() => {}}
              >
                <View style={[styles.tabIconWrap, styles.tabIconWrapActiveSeller]}>
                  <Text style={styles.tabIcon}>📋</Text>
                </View>
                <Text style={[styles.tabLabel, styles.tabLabelActiveSeller]}>Live Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomTab}
                onPress={() => {
                  setEditingMenuItem(null);
                  setAddItemModalVisible(true);
                }}
              >
                <Text style={styles.tabIcon}>➕</Text>
                <Text style={styles.tabLabel}>Add Dish</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.bottomTab} onPress={() => setVendorProfileModalVisible(true)}>
                <Text style={styles.tabIcon}>👤</Text>
                <Text style={styles.tabLabel}>Account</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

function AppRoot() {
  const { isOnboardingComplete } = useContext(AppContext);

  if (isOnboardingComplete === null) {
    return (
      <View style={[styles.appContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#070a13" />
        <View style={styles.loadingLogo}>
          <Text style={styles.loadingLogoText}>Q</Text>
        </View>
        <Text style={styles.loadingText}>SkipQ • Silver Oak University</Text>
      </View>
    );
  }

  if (!isOnboardingComplete) {
    return <OnboardingFlow />;
  }

  return <MainScreen />;
}

export default function App() {
  return (
    <AppProvider>
      <AppRoot />
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#070a13',
  },
  bottomDockContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: '#070a13',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: 14,
  },
  bottomTabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
  },
  bottomTabActiveCart: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  bottomTabActiveSeller: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
  },
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapActive: {
    transform: [{ scale: 1.1 }],
  },
  tabIconWrapActiveCart: {
    transform: [{ scale: 1.1 }],
  },
  tabIconWrapActiveSeller: {
    transform: [{ scale: 1.1 }],
  },
  cartTabWrap: {
    position: 'relative',
  },
  passTabWrap: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 17,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#818cf8',
    fontWeight: '900',
  },
  tabLabelActiveCart: {
    color: '#10b981',
    fontWeight: '900',
  },
  tabLabelActiveSeller: {
    color: '#10b981',
    fontWeight: '900',
  },
  cartTabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#10b981',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  cartTabBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: '#06b6d4',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  loadingLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingLogoText: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

