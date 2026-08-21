import React, { useState, useContext } from 'react';
import { StyleSheet, View, SafeAreaView, StatusBar, TouchableOpacity, Text } from 'react-native';
import { AppProvider, AppContext } from './src/context/AppContext';
import Header from './src/components/Header';
import StudentRadarView from './src/components/StudentRadarView';
import SellerPosView from './src/components/SellerPosView';
import OrderCheckoutModal from './src/components/OrderCheckoutModal';
import DigitalPickupPassModal from './src/components/DigitalPickupPassModal';
import AddMenuItemModal from './src/components/AddMenuItemModal';
import CreateCanteenModal from './src/components/CreateCanteenModal';
import UserProfileModal from './src/components/UserProfileModal';
import OrderHistoryModal from './src/components/OrderHistoryModal';
import OnboardingFlow from './src/components/OnboardingFlow';

function MainScreen() {
  const { role, setRole, cart, activeOrderId, orders } = useContext(AppContext);

  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [checkoutVisible, setCheckoutVisible] = useState(false);

  const [passModalVisible, setPassModalVisible] = useState(false);
  const [addItemModalVisible, setAddItemModalVisible] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [createCanteenModalVisible, setCreateCanteenModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const handleSelectOrderItem = (shopObj, itemObj) => {
    setCheckoutTarget({ shop: shopObj, item: itemObj });
    setCheckoutVisible(true);
  };

  const handleOpenCartCheckout = () => {
    setCheckoutTarget(null); // Indicates cart checkout
    setCheckoutVisible(true);
  };

  const handleOpenEditItem = itemObj => {
    setEditingMenuItem(itemObj);
    setAddItemModalVisible(true);
  };

  const handleOrderPlaced = newOrder => {
    setPassModalVisible(true);
  };

  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj && activeOrderObj.orderStatus !== 'Completed' && activeOrderObj.orderStatus !== 'Cancelled';

  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);

  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1120" />

      {/* Modern Top Header */}
      <Header
        onOpenPassModal={() => setPassModalVisible(true)}
        onOpenProfileModal={() => setProfileModalVisible(true)}
        onOpenHistoryModal={() => setHistoryModalVisible(true)}
      />

      {/* Main View Switcher */}
      {role === 'buyer' ? (
        <StudentRadarView
          onSelectOrderItem={handleSelectOrderItem}
          onOpenCartCheckout={handleOpenCartCheckout}
          onOpenPassModal={() => setPassModalVisible(true)}
          onOpenHistoryModal={() => setHistoryModalVisible(true)}
        />
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

      {/* Mobile Bottom Navigation Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.bottomTab, role === 'buyer' && styles.bottomTabActive]}
          onPress={() => setRole('buyer')}
        >
          <Text style={styles.tabIcon}>🎓</Text>
          <Text style={[styles.tabLabel, role === 'buyer' && styles.tabLabelActive]}>
            Student Radar
          </Text>
        </TouchableOpacity>

        {role === 'buyer' && cartTotalItems > 0 && (
          <TouchableOpacity style={styles.bottomTab} onPress={handleOpenCartCheckout}>
            <View>
              <Text style={styles.tabIcon}>🛒</Text>
              <View style={styles.cartTabBadge}>
                <Text style={styles.cartTabBadgeText}>{cartTotalItems}</Text>
              </View>
            </View>
            <Text style={[styles.tabLabel, { color: '#10b981', fontWeight: '800' }]}>Cart</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.bottomTab} onPress={() => setPassModalVisible(true)}>
          <View>
            <Text style={styles.tabIcon}>🎫</Text>
            {hasActivePass && <View style={styles.activeDot} />}
          </View>
          <Text style={[styles.tabLabel, hasActivePass && { color: '#06b6d4' }]}>Pickup Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTab} onPress={() => setHistoryModalVisible(true)}>
          <Text style={styles.tabIcon}>📜</Text>
          <Text style={styles.tabLabel}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bottomTab, role === 'seller' && styles.bottomTabActive]}
          onPress={() => setRole('seller')}
        >
          <Text style={styles.tabIcon}>🏪</Text>
          <Text style={[styles.tabLabel, role === 'seller' && styles.tabLabelActive]}>
            Canteen POS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomTab} onPress={() => setProfileModalVisible(true)}>
          <Text style={styles.tabIcon}>👤</Text>
          <Text style={styles.tabLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function AppRoot() {
  const { isOnboardingComplete } = useContext(AppContext);

  if (isOnboardingComplete === null) {
    // Initial storage loading splash
    return (
      <SafeAreaView style={[styles.appContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>Q</Text>
        </View>
        <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 12, fontWeight: '700' }}>Loading SkipQ...</Text>
      </SafeAreaView>
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
    backgroundColor: '#090d16',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabActive: {
    opacity: 1,
  },
  tabIcon: {
    fontSize: 18,
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#6366f1',
    fontWeight: '900',
  },
  cartTabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#10b981',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  activeDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#06b6d4',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

