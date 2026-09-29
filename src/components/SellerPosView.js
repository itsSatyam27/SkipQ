import React, { useContext, useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Image,
  Platform,
  StatusBar,
  Dimensions,
  useWindowDimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../context/AppContext';
import { announceTokenReady } from '../utils/audio';

export default function SellerPosView({
  onOpenAddItemModal,
  onOpenEditItemModal,
  onOpenCreateCanteenModal
}) {
  const {
    canteens,
    sellerShopId,
    setSellerShopId,
    userProfile,
    toggleItemStock,
    updateItemPrice,
    deleteMenuItem,
    deleteCanteen,
    orders,
    markOrderReady,
    markOrderCompleted,
    verifyAndCompleteOrder,
    confirmUpiPayment,
    cancelOrder,
    markOrderAbandoned,
    university,
    rushModeActive,
    toggleRushMode
  } = useContext(AppContext);

  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'menu', 'analytics'
  const [orderFilter, setOrderFilter] = useState('active'); // 'active', 'completed'
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [qrScanModalVisible, setQrScanModalVisible] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [orderToVerify, setOrderToVerify] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [chefBatchCollapsed, setChefBatchCollapsed] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(true);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [selectedOrderActionSheet, setSelectedOrderActionSheet] = useState(null);

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Math.max(windowHeight, Dimensions.get('screen').height);
  const screenWidth = Math.max(windowWidth, Dimensions.get('screen').width);

  // Auto-request camera permissions if QR scanner modal is opened
  useEffect(() => {
    if (qrScanModalVisible && (!permission || !permission.granted)) {
      requestPermission();
    }
  }, [qrScanModalVisible, permission]);

  // Barcode / QR Handler for instant pickup verification
  const handleBarcodeScanned = async ({ data }) => {
    if (!isScanningActive || !data) return;
    setIsScanningActive(false);

    // Expected format: SKIPQ-PASS:<orderId>:<pickupPin> or raw orderId / token
    let scannedOrderId = null;
    let scannedPin = null;

    if (typeof data === 'string' && data.startsWith('SKIPQ-PASS:')) {
      const parts = data.split(':');
      scannedOrderId = parts[1];
      scannedPin = parts[2];
    } else {
      scannedOrderId = String(data).trim();
    }

    const matchedOrder = orders.find(
      o => o.id === scannedOrderId || String(o.tokenNumber) === scannedOrderId
    );

    if (matchedOrder) {
      try {
        const pinToUse = scannedPin || matchedOrder.pickupPin || '0000';
        await verifyAndCompleteOrder(matchedOrder.id, pinToUse);
        Alert.alert(
          '✅ Handover Verified!',
          `Token #${matchedOrder.tokenNumber} for ${matchedOrder.buyerName || 'Student'} completed successfully.`
        );
        setQrScanModalVisible(false);
      } catch (err) {
        Alert.alert('Scan Verification Note', err.message || 'Could not complete order.');
        setTimeout(() => setIsScanningActive(true), 1500);
      }
    } else {
      Alert.alert(
        'Pass Not Found',
        `Scanned payload "${data}" does not match an active order in this canteen.`,
        [{ text: 'Try Again', onPress: () => setIsScanningActive(true) }]
      );
    }
  };

  // Menu Management state
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const campusCanteens = canteens.filter(c => c.universityId === university);
  const currentShop = useMemo(() => {
    // 1. Try to find match by sellerShopId
    if (sellerShopId) {
      const match = campusCanteens.find(c => c.id === sellerShopId);
      if (match) return match;
    }
    // 2. Try to find match by owner ID
    if (userProfile?.uid) {
      const match = campusCanteens.find(c => c.ownerId === userProfile.uid);
      if (match) return match;
    }
    // 3. Try to match by stall name entered during onboarding
    if (userProfile?.stallName) {
      const match = campusCanteens.find(
        c => c.name && c.name.trim().toLowerCase() === userProfile.stallName.trim().toLowerCase()
      );
      if (match) return match;
      // Synthesize stall from user profile
      return {
        id: sellerShopId || `stall-${(userProfile.stallName || 'shop').toLowerCase().replace(/\s+/g, '-')}`,
        name: userProfile.stallName,
        location: userProfile.stallLocation || 'Silver Oak University Campus',
        openingHours: '08:00 AM - 08:00 PM',
        upiId: userProfile.merchantUpi || 'canteen@upi',
        phone: userProfile.phone || '+91 98765 43210',
        status: 'Open',
        rating: 5.0,
        currentQueue: 0,
        avgWaitMins: 5,
        menu: []
      };
    }
    // 4. Fallback to first campus canteen or a default stall
    return campusCanteens[0] || {
      id: sellerShopId || 'shop-vendor',
      name: userProfile?.name ? `${userProfile.name}'s Canteen` : 'My Campus Canteen',
      location: 'Silver Oak University Campus',
      openingHours: '08:00 AM - 08:00 PM',
      upiId: 'canteen@upi',
      phone: '+91 98765 43210',
      status: 'Open',
      rating: 5.0,
      currentQueue: 0,
      avgWaitMins: 5,
      menu: []
    };
  }, [canteens, university, sellerShopId, userProfile]);

  const shopOrders = currentShop ? orders.filter(o => o.shopId === currentShop.id) : [];
  const activeOrders = shopOrders.filter(
    o => o.orderStatus !== 'Completed' && o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Abandoned'
  );
  const completedOrders = shopOrders.filter(
    o => o.orderStatus === 'Completed' || o.orderStatus === 'Cancelled' || o.orderStatus === 'Abandoned'
  );

  // Sort Active Orders: Faculty Express orders first!
  const sortedActiveOrders = useMemo(() => {
    return [...activeOrders].sort((a, b) => {
      if (a.isFacultyExpress && !b.isFacultyExpress) return -1;
      if (!a.isFacultyExpress && b.isFacultyExpress) return 1;
      return 0;
    });
  }, [activeOrders]);

  // Chef Batching: Aggregate items across all preparing orders
  const chefBatchList = useMemo(() => {
    const counts = {};
    activeOrders.forEach(ord => {
      if (ord.orderStatus === 'Preparing') {
        (ord.items || []).forEach(it => {
          const name = it.name || it.title || 'Item';
          counts[name] = (counts[name] || 0) + (it.qty || 1);
        });
      }
    });
    return Object.entries(counts).map(([name, qty]) => ({ name, qty }));
  }, [activeOrders]);

  // Analytics Calculation
  const totalRevenue = shopOrders
    .filter(o => o.orderStatus === 'Completed')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Menu filtering
  const menuItems = currentShop.menu || [];
  const categories = ['All', ...new Set(menuItems.map(i => i.category || 'Snacks'))];
  const filteredMenu = useMemo(() => {
    let items = menuItems;
    if (categoryFilter !== 'All') {
      items = items.filter(i => (i.category || 'Snacks') === categoryFilter);
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase().trim();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, categoryFilter, menuSearch]);

  const inStockCount = menuItems.filter(i => i.isAvailable).length;
  const outOfStockCount = menuItems.filter(i => !i.isAvailable).length;

  const handleSellerCancel = orderId => {
    Alert.alert(
      'Cancel Student Order',
      'Are you sure you want to cancel this order? The student will be issued an instant 100% refund.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const msg = await cancelOrder(orderId, 'seller');
            Alert.alert('Order Cancelled', `Student refunded. ${msg}`);
          }
        }
      ]
    );
  };

  const handleMarkAbandoned = (orderId, buyerName) => {
    Alert.alert(
      'Mark Order Unclaimed / No-Show',
      `Did ${buyerName} fail to pick up this order? This will forfeit their 10% security deposit and issue a strike & temporary ban penalty.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Penalty & Mark Unclaimed',
          style: 'destructive',
          onPress: async () => {
            const { newUnclaimedCount, newBanStatus } = await markOrderAbandoned(orderId);
            Alert.alert(
              'No-Show Penalty Applied',
              `Order marked abandoned. Student strikes: ${newUnclaimedCount}. Status: ${newBanStatus.toUpperCase()}.`
            );
          }
        }
      ]
    );
  };

  const handleDeleteDish = (itemId, itemName) => {
    Alert.alert('Delete Dish', `Are you sure you want to remove "${itemName}" from your live menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMenuItem(currentShop.id, itemId)
      }
    ]);
  };

  const handleDeleteCurrentCanteen = () => {
    Alert.alert('Delete Canteen', `Permanently delete "${currentShop.name}" and remove all items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Canteen',
        style: 'destructive',
        onPress: async () => {
          await deleteCanteen(currentShop.id);
          Alert.alert('Canteen Deleted', 'The canteen has been removed.');
        }
      }
    ]);
  };

  return (
    <View style={styles.rootWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Seller Header: Ocean Breeze Blue-to-Teal Hero Card */}
        <LinearGradient
          colors={['#0747a6', '#0070d2', '#00a3c4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sellerHeader}
        >
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerSubtitle}>Vendor KDS • Live stall</Text>
              <Text style={styles.shopTitle} numberOfLines={1}>
                {currentShop.name}
              </Text>
              <Text style={styles.shopLoc}>{currentShop.location || 'Near Library'}</Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={[styles.rushBtnHeader, rushModeActive && styles.rushBtnHeaderActive]}
                onPress={toggleRushMode}
                activeOpacity={0.85}
              >
                <Text style={styles.rushBtnIcon}>{rushModeActive ? '🔥' : '⚡'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerScanBtn}
                onPress={async () => {
                  setIsScanningActive(true);
                  setIsCameraReady(false);
                  if (!permission?.granted) {
                    const res = await requestPermission();
                    if (!res?.granted) {
                      setQrScanModalVisible(true);
                      return;
                    }
                  }
                  setQrScanModalVisible(true);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.headerScanBtnText}>📷 QR</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Stats: 2 Live kitchen, ₹0 Revenue, 2 Dishes */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{activeOrders.length}</Text>
              <Text style={styles.statLbl}>Live kitchen</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₹{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.statLbl}>Revenue</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{menuItems.length}</Text>
              <Text style={styles.statLbl}>Dishes</Text>
            </View>
          </View>
        </LinearGradient>

        {/* POS Sub-Navigation — Segmented Control */}
        <View style={styles.subTabBar}>
          <TouchableOpacity
            style={[styles.subTabBtn, activeTab === 'orders' && styles.subTabBtnActive]}
            onPress={() => setActiveTab('orders')}
            activeOpacity={0.85}
          >
            <Text style={[styles.subTabText, activeTab === 'orders' && styles.subTabTextActive]}>
              Orders {activeOrders.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, activeTab === 'menu' && styles.subTabBtnActive]}
            onPress={() => setActiveTab('menu')}
            activeOpacity={0.85}
          >
            <Text style={[styles.subTabText, activeTab === 'menu' && styles.subTabTextActive]}>
              Menu {menuItems.length}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, activeTab === 'analytics' && styles.subTabBtnActive]}
            onPress={() => setActiveTab('analytics')}
            activeOpacity={0.85}
          >
            <Text style={[styles.subTabText, activeTab === 'analytics' && styles.subTabTextActive]}>
              Stats
            </Text>
          </TouchableOpacity>
        </View>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 1: KITCHEN DISPLAY SYSTEM (KDS) — ORDERS       */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <View style={styles.panel}>
          {/* Chef Batching List Banner (Aggregate items needed now) */}
          {chefBatchList.length > 0 && (
            <View style={styles.batchBanner}>
              <TouchableOpacity
                style={styles.batchBannerHeader}
                onPress={() => setChefBatchCollapsed(!chefBatchCollapsed)}
                activeOpacity={0.8}
              >
                <View style={styles.batchTitleRow}>
                  <Text style={styles.batchIcon}>👨‍🍳</Text>
                  <Text style={styles.batchTitle}>CHEF BATCH LIST (COOKING NOW)</Text>
                  <View style={styles.batchCountBadge}>
                    <Text style={styles.batchCountText}>{chefBatchList.reduce((s, b) => s + b.qty, 0)} total</Text>
                  </View>
                </View>
                <Text style={styles.batchToggle}>{chefBatchCollapsed ? 'Show ▼' : 'Hide ▲'}</Text>
              </TouchableOpacity>
              {!chefBatchCollapsed && (
                <View style={styles.batchPillsWrap}>
                  {chefBatchList.map((bItem, bIdx) => (
                    <View key={bIdx} style={styles.batchPill}>
                      <Text style={styles.batchPillQty}>{bItem.qty}x</Text>
                      <Text style={styles.batchPillName}>{bItem.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Active / Completed Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, orderFilter === 'active' && styles.filterPillActive]}
              onPress={() => setOrderFilter('active')}
            >
              <Text style={[styles.filterPillText, orderFilter === 'active' && styles.filterPillTextActive]}>
                🔥 Live ({activeOrders.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, orderFilter === 'completed' && styles.filterPillActive]}
              onPress={() => setOrderFilter('completed')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  orderFilter === 'completed' && styles.filterPillTextActive
                ]}
              >
                📜 History ({completedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {(orderFilter === 'active' ? sortedActiveOrders : completedOrders).length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>☕</Text>
              <Text style={styles.noOrdersText}>
                {orderFilter === 'active' ? 'No incoming orders right now.' : 'No past orders yet.'}
              </Text>
            </View>
          ) : (
            (orderFilter === 'active' ? sortedActiveOrders : completedOrders).map(order => {
              const isPreparing = order.orderStatus === 'Preparing';
              const isReady = order.orderStatus === 'Ready' || order.orderStatus === 'Ready for Pickup';
              const isCompleted = order.orderStatus === 'Completed';
              const isCancelled = order.orderStatus === 'Cancelled';
              const isAbandoned = order.orderStatus === 'Abandoned';
              const elapsedMins = order.timestamp
                ? Math.max(1, Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000))
                : 1;

              const isCash = order.paymentMethod === 'Cash';
              const dueAmount = order.dueAtCounter !== undefined
                ? order.dueAtCounter
                : Math.max(0, order.totalAmount - (order.upfrontPaid || Math.ceil(order.totalAmount * 0.1)));

              return (
                <View
                  key={order.id}
                  style={[
                    styles.kdsCard,
                    isCash ? styles.kdsCardCashEdge : styles.kdsCardOnlineEdge
                  ]}
                >
                  {/* Card Top: Token Pill + Price */}
                  <View style={styles.kdsCardHeaderRow}>
                    <View style={styles.tokenPill}>
                      <Text style={styles.tokenPillText}>#{order.tokenNumber || 'SQ-00'}</Text>
                    </View>
                    <Text style={styles.kdsPriceText}>₹{order.totalAmount}</Text>
                  </View>

                  {/* Customer Name & Items */}
                  <View style={styles.customerRow}>
                    <Text style={styles.customerName}>{order.buyerName || 'Satyam'}</Text>
                    <Text style={styles.itemSummaryText}>
                      {' • '}
                      {(order.items || []).map(i => `${i.name} x${i.qty}`).join(', ') || 'Items'}
                    </Text>
                  </View>

                  {/* Payment Status Pill */}
                  {isCash ? (
                    <View style={styles.cashPill}>
                      <Text style={styles.cashPillText}>Collect ₹{dueAmount} cash</Text>
                    </View>
                  ) : (
                    <View style={styles.onlinePill}>
                      <Text style={styles.onlinePillText}>
                        {order.paymentMethod || 'PhonePe'} • 100% paid
                      </Text>
                    </View>
                  )}

                  {/* Pickup Slot / Timing */}
                  <Text style={styles.slotTimeText}>
                    {order.pickupSlot && order.pickupSlot !== 'ASAP'
                      ? order.pickupSlot
                      : '01:10 PM • Lunch break'}
                    {order.isFacultyExpress ? ' • ⭐ Faculty Express' : ''}
                    {order.groupCollectorName ? ` • 👥 ${order.groupCollectorName}` : ''}
                  </Text>

                  {/* Special Chef Instructions */}
                  {order.specialInstructions ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}>📝 {order.specialInstructions}</Text>
                    </View>
                  ) : null}

                  {/* Action Buttons Row */}
                  {!isCompleted && !isCancelled && !isAbandoned ? (
                    <View style={styles.kdsActionsRow}>
                      <TouchableOpacity
                        style={styles.btnVerifyPin}
                        onPress={() => {
                          if (isPreparing) {
                            announceTokenReady(order.tokenNumber, currentShop.name);
                            markOrderReady(order.id);
                          } else {
                            setOrderToVerify(order);
                            setPinInput('');
                            setPinError('');
                            setVerifyModalVisible(true);
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.btnVerifyPinText}>
                          {isPreparing ? 'Call & Ready' : 'Verify PIN'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnScanQr}
                        onPress={async () => {
                          setOrderToVerify(order);
                          setIsScanningActive(true);
                          setIsCameraReady(false);
                          if (!permission?.granted) {
                            const res = await requestPermission();
                            if (!res?.granted) {
                              setQrScanModalVisible(true);
                              return;
                            }
                          }
                          setQrScanModalVisible(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.btnScanQrText}>Scan QR</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnMoreActions}
                        onPress={() => setSelectedOrderActionSheet(order)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.btnMoreActionsText}>•••</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.completedStatusChip}>
                      <Text style={styles.completedStatus}>
                        {isCompleted
                          ? '✅ Completed & Picked Up'
                          : isCancelled
                            ? '❌ Cancelled & Refunded'
                            : '🚨 Abandoned (No-Show)'}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 2: MENU INVENTORY MANAGEMENT                   */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'menu' && (
        <View style={styles.panel}>
          {/* Header & Add Dish */}
          <View style={styles.menuHeader}>
            <View>
              <Text style={styles.panelTitle}>📋 Live Menu</Text>
              <Text style={styles.panelSub}>Manage dishes, prices & availability</Text>
            </View>
            <TouchableOpacity style={styles.addDishBtn} onPress={onOpenAddItemModal} activeOpacity={0.85}>
              <Text style={styles.addDishBtnText}>+ Add Dish</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes..."
              placeholderTextColor="#64748b"
              value={menuSearch}
              onChangeText={setMenuSearch}
            />
            {menuSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMenuSearch('')} style={styles.searchClearBtn}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, categoryFilter === cat && styles.categoryPillActive]}
                onPress={() => setCategoryFilter(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryPillText, categoryFilter === cat && styles.categoryPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Inventory Health Stats */}
          <View style={styles.inventoryStatsRow}>
            <View style={styles.inventoryStatChip}>
              <Text style={styles.inventoryStatNum}>{menuItems.length}</Text>
              <Text style={styles.inventoryStatLabel}>Total</Text>
            </View>
            <View style={[styles.inventoryStatChip, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Text style={[styles.inventoryStatNum, { color: '#10b981' }]}>{inStockCount}</Text>
              <Text style={styles.inventoryStatLabel}>🟢 In Stock</Text>
            </View>
            <View style={[styles.inventoryStatChip, { borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
              <Text style={[styles.inventoryStatNum, { color: '#f43f5e' }]}>{outOfStockCount}</Text>
              <Text style={styles.inventoryStatLabel}>⚪ Sold Out</Text>
            </View>
          </View>

          {/* Menu Item Cards */}
          {menuItems.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>🍳</Text>
              <Text style={styles.noOrdersText}>No dishes in menu yet.</Text>
              <TouchableOpacity style={styles.addFirstDishBtn} onPress={onOpenAddItemModal}>
                <Text style={styles.addFirstDishText}>+ Add Your First Dish</Text>
              </TouchableOpacity>
            </View>
          ) : filteredMenu.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>🔍</Text>
              <Text style={styles.noOrdersText}>No dishes match your search or filter.</Text>
              <TouchableOpacity
                style={styles.addFirstDishBtn}
                onPress={() => { setMenuSearch(''); setCategoryFilter('All'); }}
              >
                <Text style={styles.addFirstDishText}>Clear Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredMenu.map(item => (
              <View key={item.id} style={[styles.menuCard, !item.isAvailable && styles.menuCardSoldOut]}>
                {/* Card Top: Image + Info */}
                <View style={styles.menuCardTopRow}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.menuCardImage} />
                  ) : (
                    <View style={styles.menuCardImagePlaceholder}>
                      <Text style={{ fontSize: 22 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.menuCardInfo}>
                    <View style={styles.menuCardNameRow}>
                      <Text style={styles.menuCardName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.dietTag, !item.isVeg && styles.dietTagNonVeg]}>
                        <Text style={styles.dietTagText}>{item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                      </View>
                    </View>
                    <View style={styles.menuCardMetaRow}>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryChipText}>{item.category || 'Snacks'}</Text>
                      </View>
                      <Text style={styles.prepTimeText}>⏳ {item.prepTime || '5 mins'}</Text>
                    </View>
                  </View>
                </View>

                {/* Card Middle: Price + Stock */}
                <View style={styles.menuCardMiddleRow}>
                  <View style={styles.priceEditWrap}>
                    <Text style={styles.priceLabel}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      defaultValue={String(item.price)}
                      onEndEditing={e => updateItemPrice(currentShop.id, item.id, e.nativeEvent.text)}
                    />
                  </View>

                  <View style={styles.stockSwitchWrap}>
                    <Text
                      style={[
                        styles.stockLabel,
                        { color: item.isAvailable ? '#10b981' : '#f43f5e' }
                      ]}
                    >
                      {item.isAvailable ? '🟢 IN STOCK' : '⚪ SOLD OUT'}
                    </Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={() => toggleItemStock(currentShop.id, item.id)}
                      trackColor={{ false: '#f43f5e', true: '#10b981' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                {/* Card Bottom: Actions */}
                <View style={styles.menuCardActionRow}>
                  <TouchableOpacity
                    style={styles.editDishBtn}
                    onPress={() => onOpenEditItemModal(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editDishBtnText}>✏️  Edit Dish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteDishBtn}
                    onPress={() => handleDeleteDish(item.id, item.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteDishBtnText}>🗑️  Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 3: ANALYTICS & SETTINGS                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>📊 Canteen Performance</Text>
          <Text style={styles.panelSub}>Real-time stats for {currentShop.name}</Text>

          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsVal}>₹{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.analyticsLabel}>Total Revenue (Completed)</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsVal}>{shopOrders.length}</Text>
              <Text style={styles.analyticsLabel}>Total Orders Received</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#10b981' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Completed').length}
              </Text>
              <Text style={styles.analyticsLabel}>Completed Handoffs</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#f43f5e' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Abandoned').length}
              </Text>
              <Text style={styles.analyticsLabel}>Unclaimed / No-Shows</Text>
            </View>
          </View>

          {/* Canteen Info Card */}
          <Text style={[styles.panelTitle, { marginTop: 20 }]}>⚙️ Canteen Details</Text>
          <View style={styles.canteenInfoCard}>
            <Text style={styles.infoLine}>📍 Location: {currentShop.location}</Text>
            <Text style={styles.infoLine}>⏰ Hours: {currentShop.openingHours || '08:00 AM - 10:00 PM'}</Text>
            <Text style={styles.infoLine}>💳 Merchant UPI: {currentShop.upiId || 'canteen@upi'}</Text>
            <Text style={styles.infoLine}>📞 Phone: {currentShop.phone || '+91 98765 00000'}</Text>
          </View>

          {/* Delete Canteen Option */}
          <TouchableOpacity style={styles.deleteCanteenBtn} onPress={handleDeleteCurrentCanteen}>
            <Text style={styles.deleteCanteenText}>🗑️ Delete This Canteen Counter</Text>
          </TouchableOpacity>
        </View>
      )}
      </ScrollView>

      {/* Handover PIN Verification Modal */}
      <Modal visible={verifyModalVisible} transparent animationType="fade" onRequestClose={() => setVerifyModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.verifyModalContent}>
            <View style={styles.verifyModalHeader}>
              <View>
                <Text style={styles.verifyModalTitle}>🔐 Counter Handover</Text>
                <Text style={styles.verifyModalSub}>
                  Token: {orderToVerify?.tokenNumber} • {orderToVerify?.buyerName}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVerifyModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.verifyPinBox}>
              <Text style={styles.verifyInstruction}>
                Ask student for their 4-digit Digital Pass PIN:
              </Text>
              <TextInput
                style={styles.pinInputField}
                placeholder="4-digit PIN"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
                maxLength={4}
                value={pinInput}
                onChangeText={(val) => {
                  setPinInput(val);
                  setPinError('');
                }}
              />
              {pinError ? <Text style={styles.pinErrorText}>⚠️ {pinError}</Text> : null}
            </View>

            <View style={styles.verifyBtnRow}>
              <TouchableOpacity
                style={styles.verifyConfirmBtn}
                onPress={async () => {
                  if (!orderToVerify) return;
                  try {
                    await verifyAndCompleteOrder(orderToVerify.id, pinInput);
                    setVerifyModalVisible(false);
                    setOrderToVerify(null);
                    Alert.alert('Order Handed Over', `Token ${orderToVerify.tokenNumber} marked completed.`);
                  } catch (e) {
                    setPinError(e.message);
                  }
                }}
              >
                <Text style={styles.verifyConfirmText}>Verify PIN & Complete 🚀</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Quick Action Sheet Modal for Cancel / No-Show (...) */}
      <Modal
        visible={!!selectedOrderActionSheet}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedOrderActionSheet(null)}
      >
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setSelectedOrderActionSheet(null)}
        >
          <View style={styles.actionSheetCard}>
            <Text style={styles.actionSheetTitle}>
              Order #{selectedOrderActionSheet?.tokenNumber} Options
            </Text>
            <Text style={styles.actionSheetSub}>
              {selectedOrderActionSheet?.buyerName || 'Student'} • ₹{selectedOrderActionSheet?.totalAmount}
            </Text>

            <TouchableOpacity
              style={styles.actionSheetBtnCancel}
              onPress={() => {
                const oId = selectedOrderActionSheet?.id;
                setSelectedOrderActionSheet(null);
                if (oId) handleSellerCancel(oId);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionSheetBtnCancelText}>❌ Cancel Order (Refund UPI)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetBtnNoShow}
              onPress={() => {
                const oId = selectedOrderActionSheet?.id;
                const bName = selectedOrderActionSheet?.buyerName;
                setSelectedOrderActionSheet(null);
                if (oId) handleMarkAbandoned(oId, bName);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionSheetBtnNoShowText}>🚨 Mark No-Show Strike</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetBtnClose}
              onPress={() => setSelectedOrderActionSheet(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionSheetBtnCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-Screen Fast QR Scan & Handover Modal */}
      <Modal
        visible={qrScanModalVisible}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setQrScanModalVisible(false);
          setTorchOn(false);
          setIsCameraReady(false);
        }}
      >
        <View style={[styles.scannerFullScreenContainer, { width: screenWidth, height: screenHeight }]}>
          {permission?.granted ? (
            <View style={[styles.cameraContainer, { width: screenWidth, height: screenHeight }]}>
              <CameraView
                style={[styles.cameraView, { width: screenWidth, height: screenHeight }]}
                facing="back"
                enableTorch={torchOn}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr']
                }}
                onCameraReady={() => {
                  setIsCameraReady(true);
                }}
                onBarcodeScanned={isScanningActive ? handleBarcodeScanned : undefined}
              />

              {/* Full Screen Scanner Overlay */}
              <View style={[styles.scannerOverlay, { width: screenWidth, height: screenHeight }]}>
                {/* Top Campus Bar & Navigation Header */}
                <View style={styles.scannerHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.scannerCampusBadge}>
                      <View style={styles.scannerCampusDot} />
                      <Text style={styles.scannerCampusText}>SILVER OAK UNIVERSITY • VENDOR KDS</Text>
                    </View>
                    <Text style={styles.scannerHeaderTitle}>📷 Scan Student Pass</Text>
                    <Text style={styles.scannerHeaderSub}>Align student's digital pass QR inside viewfinder</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.scannerCloseCircle}
                    onPress={() => {
                      setQrScanModalVisible(false);
                      setTorchOn(false);
                      setIsCameraReady(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.scannerCloseCircleText}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Viewfinder Target Reticle Frame */}
                <View style={styles.reticleWrapper}>
                  <View style={styles.reticleFrame}>
                    <View style={styles.cornerTL} />
                    <View style={styles.cornerTR} />
                    <View style={styles.cornerBL} />
                    <View style={styles.cornerBR} />
                    <View style={styles.laserScanLine} />
                  </View>
                  <View style={styles.reticleHintBox}>
                    <Text style={styles.reticleHintText}>
                      {isScanningActive
                        ? '🎯 Holding student pass within frame auto-verifies'
                        : '⚡ Verifying token handover...'}
                    </Text>
                  </View>
                </View>

                {/* Bottom Quick Controls Deck */}
                <View style={styles.scannerBottomDeck}>
                  <View style={styles.scannerControlsRow}>
                    {/* Torch Toggle */}
                    <TouchableOpacity
                      style={[styles.scannerCtrlBtn, torchOn && styles.scannerCtrlBtnActive]}
                      onPress={() => setTorchOn(prev => !prev)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.scannerCtrlIcon, torchOn && styles.scannerCtrlIconActive]}>
                        {torchOn ? '🔦 Torch ON' : '🔦 Torch'}
                      </Text>
                    </TouchableOpacity>

                    {/* Manual 4-Digit PIN Button */}
                    <TouchableOpacity
                      style={styles.scannerManualPinBtn}
                      onPress={() => {
                        setQrScanModalVisible(false);
                        setTorchOn(false);
                        setIsCameraReady(false);
                        setPinInput('');
                        setPinError('');
                        if (activeOrders.length > 0) {
                          setOrderToVerify(activeOrders[0]);
                        }
                        setVerifyModalVisible(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={['#0747a6', '#0070d2', '#00a3c4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.scannerManualPinGradient}
                      >
                        <Text style={styles.scannerManualPinText}>🔢 Enter 4-Digit PIN</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  {/* Ready Orders Quick Pick Drawer */}
                  {activeOrders.filter(o => o.orderStatus === 'Ready for Pickup' || o.orderStatus === 'Ready').length > 0 && (
                    <View style={styles.readyTokensDrawer}>
                      <View style={styles.readyTokensDrawerHeader}>
                        <Text style={styles.readyTokensDrawerTitle}>READY FOR HANDOVER:</Text>
                        <Text style={styles.readyTokensDrawerCount}>
                          {activeOrders.filter(o => o.orderStatus === 'Ready for Pickup' || o.orderStatus === 'Ready').length} tokens
                        </Text>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                        {activeOrders
                          .filter(o => o.orderStatus === 'Ready for Pickup' || o.orderStatus === 'Ready')
                          .map(rOrd => (
                            <TouchableOpacity
                              key={rOrd.id}
                              style={styles.readyTokenChip}
                              onPress={() => {
                                setOrderToVerify(rOrd);
                                setQrScanModalVisible(false);
                                setTorchOn(false);
                                setIsCameraReady(false);
                                setPinInput('');
                                setPinError('');
                                setVerifyModalVisible(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <View style={styles.readyTokenChipBadge}>
                                <Text style={styles.readyTokenChipNum}>#{rOrd.tokenNumber}</Text>
                              </View>
                              <Text style={styles.readyTokenChipName} numberOfLines={1}>{rOrd.buyerName}</Text>
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>
            </View>
          ) : (
            <View style={[styles.scannerNoPermissionBox, { width: screenWidth, height: screenHeight }]}>
              <View style={styles.scannerCampusBadge}>
                <View style={styles.scannerCampusDot} />
                <Text style={styles.scannerCampusText}>SILVER OAK UNIVERSITY • VENDOR KDS</Text>
              </View>
              <Text style={styles.scannerNoPermEmoji}>📷</Text>
              <Text style={styles.scannerNoPermTitle}>Camera Access Required</Text>
              <Text style={styles.scannerNoPermSub}>
                To scan student pickup passes and complete queue-free handovers instantly, please allow SkipQ to access your camera.
              </Text>
              <TouchableOpacity style={styles.enableCameraBtn} onPress={requestPermission} activeOpacity={0.85}>
                <Text style={styles.enableCameraBtnText}>Enable Camera Access</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeNoPermBtn}
                onPress={() => {
                  setQrScanModalVisible(false);
                  setTorchOn(false);
                  setIsCameraReady(false);
                }}
              >
                <Text style={styles.closeNoPermBtnText}>Back to Kitchen KDS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#edf3f8',
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#edf3f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#64748b', fontSize: 12, textAlign: 'center', marginVertical: 8 },
  createFirstBtn: {
    backgroundColor: '#0c52a3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  createFirstBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  // — Seller Header: Ocean Breeze Hero Card —
  sellerHeader: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0070d2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sellerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  shopTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  shopLoc: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  rushBtnHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  rushBtnHeaderActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
    borderColor: '#f59e0b',
  },
  rushBtnIcon: {
    fontSize: 14,
  },
  headerScanBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerScanBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  statVal: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },

  // — Segmented Sub-Tab Bar —
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 4,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 0,
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  subTabBtnActive: {
    backgroundColor: '#0c52a3',
  },
  subTabText: {
    color: '#475569',
    fontSize: 13.5,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
  },

  // — Panel —
  panel: {
    backgroundColor: 'transparent',
    padding: 0,
    borderWidth: 0,
  },

  // — Filter Pills —
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 0,
  },
  filterPillActive: {
    backgroundColor: '#0c52a3',
    borderColor: '#0c52a3',
  },
  filterPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  // — No Orders —
  noOrdersBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  noOrdersEmoji: { fontSize: 36, marginBottom: 8 },
  noOrdersText: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  addFirstDishBtn: {
    backgroundColor: '#0c52a3',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  addFirstDishText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  // ═══════════════════════════
  // KDS Order Cards
  // ═══════════════════════════
  kdsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
  },
  kdsCardCashEdge: {
    borderLeftWidth: 5,
    borderLeftColor: '#f59e0b',
  },
  kdsCardOnlineEdge: {
    borderLeftWidth: 5,
    borderLeftColor: '#00a3c4',
  },
  kdsCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenPill: {
    backgroundColor: '#e6f2fb',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tokenPillText: {
    color: '#0c52a3',
    fontSize: 16,
    fontWeight: '900',
  },
  kdsPriceText: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  customerName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  itemSummaryText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  cashPill: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  cashPillText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  onlinePill: {
    backgroundColor: '#ccfbf1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  onlinePillText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  slotTimeText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  notesBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 3,
    borderLeftColor: '#00a3c4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  notesText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  kdsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnVerifyPin: {
    flex: 1,
    backgroundColor: '#0c52a3',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0070d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnVerifyPinText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  btnScanQr: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#00a3c4',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnScanQrText: {
    color: '#0070d2',
    fontSize: 14,
    fontWeight: '800',
  },
  btnMoreActions: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMoreActionsText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '900',
  },
  completedStatusChip: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  completedStatus: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  actionSheetSub: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 18,
  },
  actionSheetBtnCancel: {
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionSheetBtnCancelText: {
    color: '#dc2626',
    fontWeight: '800',
    fontSize: 14,
  },
  actionSheetBtnNoShow: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionSheetBtnNoShowText: {
    color: '#b45309',
    fontWeight: '800',
    fontSize: 14,
  },
  actionSheetBtnClose: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionSheetBtnCloseText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13,
  },

  // ═══════════════════════════
  // Menu Management
  // ═══════════════════════════
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  panelTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  panelSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
  },
  addDishBtn: {
    backgroundColor: '#0c52a3',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addDishBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
  },

  // Search
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    paddingVertical: 12,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },

  // Category Filter
  categoryScrollRow: {
    marginBottom: 12,
    maxHeight: 38,
  },
  categoryPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: '#0c52a3',
    borderColor: '#0c52a3',
  },
  categoryPillText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },

  // Inventory Health Stats
  inventoryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  inventoryStatChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inventoryStatNum: {
    color: '#0c52a3',
    fontSize: 18,
    fontWeight: '900',
  },
  inventoryStatLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // Menu Card
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  menuCardSoldOut: {
    opacity: 0.6,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  menuCardTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  menuCardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  menuCardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  menuCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  menuCardName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  dietTag: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  dietTagNonVeg: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecdd3',
  },
  dietTagText: {
    color: '#065f46',
    fontSize: 9,
    fontWeight: '700',
  },
  menuCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  categoryChip: {
    backgroundColor: '#e6f2fb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryChipText: {
    color: '#0c52a3',
    fontSize: 10,
    fontWeight: '700',
  },
  prepTimeText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },

  // Menu Card Middle — Price + Stock
  menuCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  priceEditWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceLabel: {
    color: '#0c52a3',
    fontSize: 16,
    fontWeight: '900',
  },
  priceInput: {
    backgroundColor: '#ffffff',
    color: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 55,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stockSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '900',
  },

  // Menu Card Bottom — Actions
  menuCardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editDishBtn: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  editDishBtnText: {
    color: '#4f46e5',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteDishBtn: {
    flex: 1,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.2)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deleteDishBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },

  // ═══════════════════════════
  // Analytics
  // ═══════════════════════════
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  analyticsCard: {
    flexBasis: '48%',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  analyticsVal: {
    color: '#0c52a3',
    fontSize: 22,
    fontWeight: '900',
  },
  analyticsLabel: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  canteenInfoCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
    gap: 8,
  },
  infoLine: {
    color: '#334155',
    fontSize: 12,
  },
  deleteCanteenBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#fff1f2',
  },
  deleteCanteenText: {
    color: '#e11d48',
    fontWeight: '700',
    fontSize: 12,
  },

  // ═══════════════════════════
  // Modals
  // ═══════════════════════════
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    color: '#64748b',
    fontSize: 16,
    padding: 4,
  },
  canteenChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  canteenChoiceActive: {
    borderColor: '#0c52a3',
    borderWidth: 1,
    backgroundColor: '#e6f2fb',
  },
  canteenChoiceName: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  canteenChoiceNameActive: {
    color: '#0c52a3',
  },
  canteenChoiceLoc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#0c52a3',
    fontWeight: '900',
    fontSize: 16,
  },
  modalCreateBtn: {
    backgroundColor: '#0c52a3',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCreateText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },

  // PIN Verify Modal
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCloseBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
  verifyModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  verifyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  verifyModalTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  verifyModalSub: {
    color: '#0c52a3',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  verifyPinBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  verifyInstruction: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinInputField: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0c52a3',
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: 180,
  },
  pinErrorText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  verifyBtnRow: {
    gap: 8,
  },
  verifyConfirmBtn: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  bypassBtn: {
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bypassBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  batchBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
    padding: 12,
    marginBottom: 12,
  },
  batchBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchIcon: {
    fontSize: 14,
  },
  batchTitle: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  batchCountBadge: {
    backgroundColor: '#fde68a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  batchCountText: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800',
  },
  batchToggle: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '700',
  },
  batchPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(217, 119, 6, 0.2)',
  },
  batchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  batchPillQty: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '900',
  },
  batchPillName: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '700',
  },
  kdsBadgeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  facultyOrderTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.35)',
  },
  facultyOrderTagText: {
    color: '#e9d5ff',
    fontSize: 10,
    fontWeight: '900',
  },
  orderSlotTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  orderSlotTagText: {
    color: '#bae6fd',
    fontSize: 10,
    fontWeight: '800',
  },
  orderCollectorTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  orderCollectorTagText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  facultyDeliveryBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },
  facultyDeliveryText: {
    color: '#e9d5ff',
    fontSize: 11,
    fontWeight: '700',
  },
  verifyButtonPair: {
    flexDirection: 'row',
    gap: 10,
  },
  kdsActionBtnScan: {
    flex: 1,
    backgroundColor: '#0c52a3',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 0,
  },
  kdsBtnTextScan: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  rootWrapper: {
    flex: 1,
    backgroundColor: '#edf3f8',
  },
  scannerFullScreenContainer: {
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  cameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  cameraView: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  scannerNoPermissionBox: {
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  scannerNoPermEmoji: {
    fontSize: 54,
    marginVertical: 16,
  },
  scannerNoPermTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  scannerNoPermSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  enableCameraBtn: {
    backgroundColor: '#0c52a3',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enableCameraBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  closeNoPermBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  closeNoPermBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  scannerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 16 : 56,
    paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0, 163, 196, 0.25)',
  },
  scannerCampusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  scannerCampusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00a3c4',
  },
  scannerCampusText: {
    color: '#00a3c4',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  scannerHeaderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  scannerHeaderSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  scannerCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerCloseCircleText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  reticleWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  reticleFrame: {
    width: 270,
    height: 270,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 163, 196, 0.35)',
    position: 'relative',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 36,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00a3c4',
    borderTopLeftRadius: 22,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#00a3c4',
    borderTopRightRadius: 22,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 36,
    height: 36,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#00a3c4',
    borderBottomLeftRadius: 22,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#00a3c4',
    borderBottomRightRadius: 22,
  },
  laserScanLine: {
    position: 'absolute',
    top: '50%',
    left: '8%',
    width: '84%',
    height: 3,
    backgroundColor: '#00a3c4',
    shadowColor: '#00a3c4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 10,
    elevation: 6,
  },
  reticleHintBox: {
    marginTop: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 163, 196, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reticleHintText: {
    color: '#f8fafc',
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  scannerBottomDeck: {
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'android' ? 34 : 44,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1.5,
    borderColor: 'rgba(0, 163, 196, 0.25)',
  },
  scannerControlsRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  scannerCtrlBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerCtrlBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  scannerCtrlIcon: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  scannerCtrlIconActive: {
    color: '#fbbf24',
  },
  scannerManualPinBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scannerManualPinGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  scannerManualPinText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  readyTokensDrawer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  readyTokensDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  readyTokensDrawerTitle: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  readyTokensDrawerCount: {
    color: '#00a3c4',
    fontSize: 10.5,
    fontWeight: '900',
  },
  readyTokenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
  },
  readyTokenChipBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 0.8,
    borderColor: '#bae6fd',
  },
  readyTokenChipNum: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '900',
  },
  readyTokenChipName: {
    color: '#f8fafc',
    fontSize: 11,
    maxWidth: 90,
    fontWeight: '700',
  },
  fastMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  fastMatchToken: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
  },
  fastMatchBuyer: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  fastMatchPin: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  fastMatchBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fastMatchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  readyListHeader: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  quickReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  quickReadyToken: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 10,
  },
  quickReadyBuyer: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
  },
  quickReadyAction: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
});
