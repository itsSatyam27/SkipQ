import React, { useState, useContext, useEffect } from 'react';
import { StyleSheet, View, StatusBar, TouchableOpacity, Text } from 'react-native';
import { AppProvider, AppContext } from './src/context/AppContext';
import Header from './src/components/Header';
import StudentRadarView from './src/components/StudentRadarView';
import StudentCartScreen from './src/components/StudentCartScreen';
import StudentProfileScreen from './src/components/StudentProfileScreen';
import SellerPosView from './src/components/SellerPosView';
import DigitalPickupPassModal from './src/components/DigitalPickupPassModal';
import AddMenuItemModal from './src/components/AddMenuItemModal';
import CreateCanteenModal from './src/components/CreateCanteenModal';
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

  const [passModalVisible, setPassModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [createCanteenModalVisible, setCreateCanteenModalVisible] = useState(false);
  const [vendorProfileModalVisible, setVendorProfileModalVisible] = useState(false);

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

  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj && activeOrderObj.orderStatus !== 'Completed' && activeOrderObj.orderStatus !== 'Cancelled';

  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);

  return (
    <View style={styles.appContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f3ee" />

      {/* Modern Top Header */}
      <Header
        onOpenPassModal={() => setPassModalVisible(true)}
        onOpenProfileModal={() => setCurrentTab('profile')}
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
      <DigitalPickupPassModal
        visible={passModalVisible}
        onClose={() => setPassModalVisible(false)}
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
    backgroundColor: '#f5f3ee',
  },
  bottomDockContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: '#f5f3ee',
  },
  bottomBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: '#1c2521',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2e3b34',
    paddingVertical: 9,
    paddingHorizontal: 8,
    shadowColor: '#172019',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 14,
  },
  bottomTabActive: {
    backgroundColor: '#314238',
  },
  bottomTabActiveCart: {
    backgroundColor: '#4d8062',
  },
  bottomTabActiveSeller: {
    backgroundColor: '#4d8062',
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
    fontSize: 16,
  },
  tabLabel: {
    color: '#aab9ae',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  tabLabelActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  tabLabelActiveCart: {
    color: '#ffffff',
    fontWeight: '900',
  },
  tabLabelActiveSeller: {
    color: '#ffffff',
    fontWeight: '900',
  },
  cartTabBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#e9b95a',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#1c2521',
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
    backgroundColor: '#e9b95a',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#1c2521',
  },
  loadingLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1c2521',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#172019',
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
    color: '#aab9ae',
    fontSize: 13,
    marginTop: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

