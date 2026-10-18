import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
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
import InterfaceIcon from './InterfaceIcon';
import { announceTokenReady } from '../utils/audio';
import { selectOwnedCanteen } from '../services/sellerCanteen.cjs';

const NO_SHOW_GRACE_PERIOD_MS = 15 * 60 * 1000;
// Firestore enforces the 15-minute limit using server time, so allow for client clock skew.
const NO_SHOW_CLIENT_CLOCK_BUFFER_MS = 60 * 1000;
const timestampMillis = value => {
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function SellerPosView({
  onOpenAddItemModal,
  onOpenEditItemModal,
  onOpenCreateCanteenModal,
  selectedTab,
  onTabChange,
  onOpenSettings
}) {
  const styles = useSellerStyles(baseStyles);
  const { light } = useSellerTheme();
  const {
    canteens,
    sellerShopId,
    sellerSetupStatus,
    sellerSetupError,
    retrySellerSetup,
    setSellerShopId,
    userProfile,
    toggleItemStock,
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
  const [localTab, setLocalTab] = useState('orders');
  const activeTab = selectedTab || localTab;
  const setActiveTab = tab => { if (onTabChange) onTabChange(tab); else setLocalTab(tab); }; // 'orders', 'menu', 'analytics'
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
  const [clockNow, setClockNow] = useState(Date.now());

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const screenHeight = Math.max(windowHeight, Dimensions.get('screen').height);
  const screenWidth = Math.max(windowWidth, Dimensions.get('screen').width);
  const selectedReadyAt = timestampMillis(selectedOrderActionSheet?.readyAt);
  const selectedNoShowReady = selectedOrderActionSheet?.orderStatus === 'Ready for Pickup'
    && selectedReadyAt > 0
    && clockNow - selectedReadyAt >= NO_SHOW_GRACE_PERIOD_MS + NO_SHOW_CLIENT_CLOCK_BUFFER_MS;
  const noShowWaitMinutes = selectedReadyAt
    ? Math.ceil(Math.max(0, NO_SHOW_GRACE_PERIOD_MS + NO_SHOW_CLIENT_CLOCK_BUFFER_MS - (clockNow - selectedReadyAt)) / 60000)
    : null;

  useEffect(() => {
    const timer = setInterval(() => setClockNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

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
        if (!scannedPin) throw new Error('Scan a pickup pass containing the customer PIN, or enter the PIN manually.');
        const pinToUse = scannedPin;
        await verifyAndCompleteOrder(matchedOrder.id, pinToUse);
        Alert.alert(
          ' Handover Verified!',
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

  const campusCanteens = canteens.filter(c => c.universityId === university && c.ownerId === userProfile?.uid);
  const currentShop = useMemo(() => {
    return selectOwnedCanteen(canteens, userProfile?.uid, university, sellerShopId, userProfile?.sellerShopId)
      || { id: null, name: 'Create your canteen', location: 'Campus', status: 'Closed', menu: [] };
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
      'Cancel this order? If the customer has already paid cash, arrange its return directly.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            try { const msg = await cancelOrder(orderId, 'seller'); Alert.alert('Order Cancelled', msg); }
            catch (error) { Alert.alert('Could not cancel', error.message); }
          }
        }
      ]
    );
  };

  const handleMarkAbandoned = (orderId, buyerName) => {
    Alert.alert(
      'Mark Order Unclaimed / No-Show',
      `Did ${buyerName} fail to collect this order? Wait until it has been Ready for at least 15 minutes before confirming a no-show.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Unclaimed',
          style: 'destructive',
          onPress: async () => {
            try { await markOrderAbandoned(orderId); Alert.alert('Order marked unclaimed', 'The no-show is recorded for operator review.'); }
            catch (error) {
              const message = error?.code === 'permission-denied'
                ? 'The server could not verify that this order has been ready long enough. Refresh the order and try again in a minute.'
                : error.message;
              Alert.alert('Could not mark unclaimed', message);
            }
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
        onPress: () => deleteMenuItem(currentShop.id, itemId).catch(error => Alert.alert('Could not delete dish', error.message))
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
          try { await deleteCanteen(currentShop.id); Alert.alert('Canteen Deleted', 'The canteen has been removed.'); }
          catch (error) { Alert.alert('Could not delete canteen', error.message); }
        }
      }
    ]);
  };

  if (!currentShop.id) return <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 130 }}>
    <View style={{ backgroundColor: '#121417', padding: 24, borderRadius: 22, borderWidth: 1, borderColor: '#26292e' }}>
      <Text style={{ color: '#ffb313', fontSize: 11, fontWeight: '700', marginBottom: 12 }}>SELLER WORKSPACE</Text>
      <Text style={{ color: '#f5f4f0', fontSize: 24, fontWeight: '800' }}>{sellerSetupStatus === 'loading' ? 'Preparing your canteen' : 'Finish canteen setup'}</Text>
      <Text style={{ color: '#9b9fa9', fontSize: 14, lineHeight: 22, marginVertical: 16 }}>{sellerSetupStatus === 'loading' ? 'Using the details you submitted during registration. Your menu will be ready shortly.' : sellerSetupError || 'Your seller access is approved. Your saved registration details will be used to set up your canteen.'}</Text>
      {sellerSetupStatus === 'error' && <TouchableOpacity accessibilityRole="button" onPress={retrySellerSetup} style={{ padding: 14, marginBottom: 10, alignItems: 'center' }}><Text style={{ color: '#ffb313', fontWeight: '700' }}>Retry saved registration</Text></TouchableOpacity>}
      {sellerSetupStatus !== 'loading' && <TouchableOpacity accessibilityRole="button" onPress={onOpenCreateCanteenModal} style={{ backgroundColor: '#ffb313', padding: 15, borderRadius: 12, alignItems: 'center' }}>
        <Text style={{ color: '#f5f4f0', fontWeight: '700' }}>Set up canteen</Text>
      </TouchableOpacity>}
    </View>
  </ScrollView>;

  return (
    <View style={styles.rootWrapper}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Seller Header: Ocean Breeze Blue-to-Teal Hero Card */}
        {activeTab === 'orders' && <LinearGradient
          colors={light ? ['#ffffff', '#ffffff', '#ffffff'] : ['#121417', '#121417', '#121417']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sellerHeader}
        >
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerSubtitle}>SELLER WORKSPACE</Text>
              <Text style={styles.shopTitle} numberOfLines={2}>
                {currentShop.name}
              </Text>
              <Text style={styles.shopLoc}>{currentShop.location || 'Near Library'}</Text>
            </View>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                accessibilityRole="button" accessibilityLabel="Toggle rush mode" accessibilityState={{ selected: rushModeActive }} style={[styles.rushBtnHeader, rushModeActive && styles.rushBtnHeaderActive]}
                onPress={toggleRushMode}
                activeOpacity={0.85}
              >
                <InterfaceIcon name="bolt" size={18} color={rushModeActive ? "#fde68a" : "#ffffff"} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityRole="button" accessibilityLabel="Scan pickup pass" style={styles.headerScanBtn}
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
                <InterfaceIcon name="scan" size={17} color="#090b0d" /><Text style={styles.headerScanBtnText}>Scan</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Stats: 2 Live kitchen, ₹0 Revenue, 2 Dishes */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{activeOrders.length}</Text>
              <Text style={styles.statLbl}>Active orders</Text>
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
        </LinearGradient>}

        {/* POS Sub-Navigation — Segmented Control */}
        {!selectedTab && (
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
        )}

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
                  <InterfaceIcon name="orders" size={18} color="#ffb313" />
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
                 Live ({activeOrders.length})
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
                 History ({completedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {(orderFilter === 'active' ? sortedActiveOrders : completedOrders).length === 0 ? (
            <View style={styles.noOrdersBox}>
              <View style={styles.emptyIcon}><InterfaceIcon name="orders" size={28} color="#ffb313" /></View>
              <Text style={styles.noOrdersText}>
                {orderFilter === 'active' ? 'Your kitchen is all caught up' : 'No past orders yet'}
              </Text>
              <Text style={styles.emptyHint}>New orders appear here as customers place them.</Text>
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
                : Math.max(0, order.totalAmount - (order.upfrontPaid || order.advanceAmount || 0));
              const cashAdvancePending = isCash && order.advanceAmount > 0 && order.advancePaymentStatus !== 'CONFIRMED_BY_MERCHANT';
              const upiPaymentPending = !isCash && order.paymentMethod === 'UPI' && order.paymentStatus !== 'CONFIRMED_BY_MERCHANT';
              const needsPaymentVerification = cashAdvancePending || upiPaymentPending;

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
                  {order.testOrder && <Text style={{ color: '#a36b12', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>Test order · campus location check skipped</Text>}
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
                      <Text style={styles.cashPillText}>{cashAdvancePending ? `Verify ₹${order.advanceAmount} UPI advance` : `${order.advanceAmount ? `₹${order.advanceAmount} advance verified · ` : ''}Collect ₹${dueAmount} cash`}</Text>
                    </View>
                  ) : (
                    <View style={styles.onlinePill}>
                      <Text style={styles.onlinePillText}>
                        {order.paymentStatus === 'CONFIRMED_BY_MERCHANT' ? 'Payment verified by seller' : 'Seller verification pending'}
                      </Text>
                    </View>
                  )}

                  {/* Pickup Slot / Timing */}
                  <Text style={styles.slotTimeText}>
                    {order.pickupSlot && order.pickupSlot !== 'ASAP'
                      ? order.pickupSlot
                      : '01:10 PM • Lunch break'}
                    {order.isFacultyExpress ? ' • ⭐ Faculty Express' : ''}
                    {order.groupCollectorName ? ` •  ${order.groupCollectorName}` : ''}
                  </Text>
                  {order.staffRoomDelivery && <View style={styles.notesBox}><Text style={styles.notesText}>Staff room delivery (+₹{order.deliveryFee || 5}): {order.facultyRoomNote}</Text></View>}

                  {/* Special Chef Instructions */}
                  {order.specialInstructions ? (
                    <View style={styles.notesBox}>
                      <Text style={styles.notesText}> {order.specialInstructions}</Text>
                    </View>
                  ) : null}

                  {/* Action Buttons Row */}
                  {!isCompleted && !isCancelled && !isAbandoned ? (
                    <View style={styles.kdsActionsRow}>
                      {needsPaymentVerification && (
                        <TouchableOpacity style={styles.btnScanQr} onPress={() => Alert.alert(
                          'Verify UPI payment',
                          `Check your merchant account for ₹${isCash ? order.advanceAmount : order.totalAmount} before confirming. Do not rely on the payment app opening or a screenshot.`,
                          [{ text: 'Back', style: 'cancel' }, { text: 'I verified receipt', onPress: () => confirmUpiPayment(order.id).catch(error => Alert.alert('Could not confirm payment', error.message)) }]
                        )}>
                          <Text style={styles.btnScanQrText}>{isCash ? `Verify ₹${order.advanceAmount} advance` : 'Verify UPI payment'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        disabled={isPreparing && cashAdvancePending}
                        style={[styles.btnVerifyPin, isPreparing && cashAdvancePending && { opacity: 0.5 }]}
                        onPress={() => {
                          if (isPreparing) {
                            markOrderReady(order.id).catch(error => Alert.alert('Could not mark ready', error.message));
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
                          {isPreparing ? cashAdvancePending ? 'Verify advance first' : (order.staffRoomDelivery ? 'Ready to deliver' : 'Call & Ready') : 'Verify PIN'}
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
                          ? ' Completed & Picked Up'
                          : isCancelled
                            ? 'Cancelled — check refund status'
                            : ' Abandoned (No-Show)'}
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
              <Text style={styles.sellerSubtitle}>MENU</Text><Text style={styles.panelTitle}>Your dishes</Text>

            </View>
            <TouchableOpacity style={styles.addDishBtn} onPress={() => onOpenAddItemModal(currentShop.id)} activeOpacity={0.85}>
              <Text style={styles.addDishBtnText}>+ Add Dish</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <View style={{ marginRight: 8 }}><InterfaceIcon name="search" size={18} /></View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes..."
              placeholderTextColor="#64748b"
              value={menuSearch}
              onChangeText={setMenuSearch}
            />
            {menuSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMenuSearch('')} style={styles.searchClearBtn}>
                <InterfaceIcon name="close" size={16} />
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
              <Text style={styles.inventoryStatLabel}> In Stock</Text>
            </View>
            <View style={[styles.inventoryStatChip, { borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
              <Text style={[styles.inventoryStatNum, { color: '#f43f5e' }]}>{outOfStockCount}</Text>
              <Text style={styles.inventoryStatLabel}> Sold Out</Text>
            </View>
          </View>

          {/* Menu Item Cards */}
          {menuItems.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <View style={styles.emptyIcon}><InterfaceIcon name="menu" size={28} color="#ffb313" /></View>
              <Text style={styles.noOrdersText}>Build your first menu</Text><Text style={styles.emptyHint}>Add a dish with its price and preparation time.</Text>
              <TouchableOpacity style={styles.addFirstDishBtn} onPress={() => onOpenAddItemModal(currentShop.id)}>
                <Text style={styles.addFirstDishText}>+ Add Your First Dish</Text>
              </TouchableOpacity>
            </View>
          ) : filteredMenu.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <View style={styles.emptyIcon}><InterfaceIcon name="search" size={28} color="#ffb313" /></View>
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
                      <InterfaceIcon name="menu" size={24} />
                    </View>
                  )}
                  <View style={styles.menuCardInfo}>
                    <View style={styles.menuCardNameRow}>
                      <Text style={styles.menuCardName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.dietTag, !item.isVeg && styles.dietTagNonVeg]}>
                        <Text style={styles.dietTagText}>{item.isVeg ? ' Veg' : ' Non-Veg'}</Text>
                      </View>
                    </View>
                    <View style={styles.menuCardMetaRow}>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryChipText}>{item.category || 'Snacks'}</Text>
                      </View>
                      <Text style={styles.prepTimeText}> {item.prepTime || '5 mins'}</Text>
                    </View>
                  </View>
                </View>

                {/* Card Middle: Price + Stock */}
                <View style={styles.menuCardMiddleRow}>
                  <View style={styles.priceEditWrap}>
                    <Text style={styles.priceLabel}>₹</Text>
                    <Text style={styles.priceDisplay}>{item.price}</Text>
                  </View>

                  <View style={styles.stockSwitchWrap}>
                    <Text
                      style={[
                        styles.stockLabel,
                        { color: item.isAvailable ? '#10b981' : '#f43f5e' }
                      ]}
                    >
                      {item.isAvailable ? ' IN STOCK' : ' SOLD OUT'}
                    </Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={() => toggleItemStock(currentShop.id, item.id).catch(error => Alert.alert('Could not update stock', error.message))}
                      trackColor={{ false: '#f43f5e', true: '#10b981' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                {/* Card Bottom: Actions */}
                <View style={styles.menuCardActionRow}>
                  <TouchableOpacity
                    style={styles.editDishBtn}
                    onPress={() => onOpenEditItemModal(item, currentShop.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editDishBtnText}>  Edit Dish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteDishBtn}
                    onPress={() => handleDeleteDish(item.id, item.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteDishBtnText}>  Delete</Text>
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
          <Text style={styles.sellerSubtitle}>STATS</Text><Text style={styles.panelTitle}>Performance</Text>


          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCard, { backgroundColor: '#ffb313', borderColor: '#ffb313' }] }>
              <Text style={[styles.analyticsVal, { color: '#090b0d' }] }>₹{totalRevenue.toFixed(0)}</Text>
              <Text style={[styles.analyticsLabel, { color: '#362600' }]}>Completed revenue</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsVal}>{shopOrders.length}</Text>
              <Text style={styles.analyticsLabel}>Orders received</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#10b981' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Completed').length}
              </Text>
              <Text style={styles.analyticsLabel}>Completed pickups</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#f43f5e' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Abandoned').length}
              </Text>
              <Text style={styles.analyticsLabel}>Unclaimed orders</Text>
            </View>
          </View>

          {/* Canteen Info Card */}
          <Text style={[styles.panelTitle, { marginTop: 20 }]}>Canteen details</Text>
          <View style={styles.canteenInfoCard}>
            {[
              { label: 'Location', value: currentShop.location || 'Not set' },
              { label: 'Hours', value: currentShop.openingHours, action: 'Set hours', section: 'Canteen' },
              { label: 'Payments', value: 'Cash only · UPI coming soon' },
              { label: 'Phone', value: currentShop.phone || userProfile.phone || 'Not provided' },
            ].map((row, index) => <View key={row.label} style={[styles.detailRow, index > 0 && styles.detailDivider]}>
              <Text style={styles.detailLabel}>{row.label}</Text>
              <View style={styles.detailValueWrap}>{!!row.value && <Text style={styles.detailValue}>{row.value}</Text>}
                {!!row.action && (!row.value || row.label === 'Payments') && <TouchableOpacity accessibilityRole="button" onPress={() => onOpenSettings?.(row.section)} style={styles.detailAction}><Text style={styles.detailActionText}>{row.action}</Text></TouchableOpacity>}
              </View>
            </View>)}
          </View>

          {/* Delete Canteen Option */}
          <TouchableOpacity style={styles.deleteCanteenBtn} onPress={handleDeleteCurrentCanteen}>
            <Text style={styles.deleteCanteenText}> Delete This Canteen Counter</Text>
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
                <Text style={styles.verifyModalTitle}> Counter Handover</Text>
                <Text style={styles.verifyModalSub}>
                  Token: {orderToVerify?.tokenNumber} • {orderToVerify?.buyerName}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVerifyModalVisible(false)}>
                <InterfaceIcon name="close" size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.verifyPinBox}>
              <Text style={styles.verifyInstruction}>
                {orderToVerify?.paymentMethod === 'Cash' ? `Collect ₹${orderToVerify.dueAtCounter ?? orderToVerify.totalAmount} cash, then ask for the customer pickup PIN:` : 'Verify the full UPI payment in your merchant account, then ask for the customer pickup PIN:'}
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
              {pinError ? <Text style={styles.pinErrorText}> {pinError}</Text> : null}
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
                <Text style={styles.verifyConfirmText}>Verify PIN & Complete </Text>
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
              <Text style={styles.actionSheetBtnCancelText}>Cancel Order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: !selectedNoShowReady }}
              disabled={!selectedNoShowReady}
              style={[styles.actionSheetBtnNoShow, !selectedNoShowReady && styles.actionSheetBtnDisabled]}
              onPress={() => {
                const oId = selectedOrderActionSheet?.id;
                const bName = selectedOrderActionSheet?.buyerName;
                setSelectedOrderActionSheet(null);
                if (oId) handleMarkAbandoned(oId, bName);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionSheetBtnNoShowText, !selectedNoShowReady && styles.actionSheetBtnTextDisabled]}>
                {selectedNoShowReady ? 'Mark No-Show' : selectedOrderActionSheet?.orderStatus === 'Ready for Pickup'
                  ? `No-show available in ${noShowWaitMinutes ?? 15} min`
                  : 'Mark ready before no-show'}
              </Text>
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
                    <Text style={styles.scannerHeaderTitle}> Scan Student Pass</Text>
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
                    <InterfaceIcon name="close" size={22} color="#ffffff" />
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
                        ? ' Holding student pass within frame auto-verifies'
                        : ' Verifying token handover...'}
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
                        {torchOn ? ' Torch ON' : ' Torch'}
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
                        colors={light ? ['#ffffff', '#ffffff', '#ffffff'] : ['#121417', '#121417', '#121417']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.scannerManualPinGradient}
                      >
                        <Text style={styles.scannerManualPinText}> Enter 4-Digit PIN</Text>
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
              <InterfaceIcon name="scan" size={36} color="#ffb313" />
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

const baseStyles = StyleSheet.create({
  priceDisplay: { color: '#f5f4f0', fontSize: 22, fontWeight: '700' },
  detailRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  detailDivider: { borderTopWidth: 1, borderTopColor: '#26292e' },
  detailLabel: { color: '#a5a9b2', fontSize: 12 },
  detailValueWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 9 },
  detailValue: { color: '#f5f4f0', fontSize: 12, textAlign: 'right', flexShrink: 1 },
  detailAction: { borderWidth: 1, borderColor: '#ffb313', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18 },
  detailActionText: { color: '#ffb313', fontSize: 11, fontWeight: '600' },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#191c20', alignItems: 'center', justifyContent: 'center' },
  emptyHint: { color: '#9b9fa9', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 8 },

  container: {
    flex: 1,
    backgroundColor: '#090b0d',
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#090b0d',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#f5f4f0', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#9b9fa9', fontSize: 12, textAlign: 'center', marginVertical: 8 },
  createFirstBtn: {
    backgroundColor: '#ffb313',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  createFirstBtnText: { color: '#090b0d', fontWeight: '800', fontSize: 14 },

  // — Seller Header: Ocean Breeze Hero Card —
  sellerHeader: { borderRadius: 20, padding: 18, marginBottom: 22, borderWidth: 1, borderColor: '#26292e' },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  sellerSubtitle: { color: '#ffb313', fontSize: 9, letterSpacing: 1.4, fontWeight: '700' },
  shopTitle: { color: '#f5f4f0', fontSize: 23, fontWeight: '800', letterSpacing: -0.6, marginTop: 6, marginBottom: 5 },
  shopLoc: { color: '#9b9fa9', fontSize: 12, lineHeight: 18 },
  headerRightActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  rushBtnHeader: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffb313' },
  rushBtnHeaderActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
    borderColor: '#f59e0b',
  },
  rushBtnIcon: {
    fontSize: 14,
  },
  headerScanBtn: { minHeight: 36, paddingHorizontal: 10, borderRadius: 11, backgroundColor: '#ffb313', flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ffb313' },
  headerScanBtnText: { color: '#090b0d', fontSize: 11, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#26292e' },
  statBox: { flex: 1, alignItems: 'flex-start', paddingHorizontal: 4 },
  statVal: { color: '#f5f4f0', fontSize: 22, fontWeight: '700', letterSpacing: -0.6 },
  statLbl: { color: '#9b9fa9', fontSize: 10, marginTop: 4 },

  // — Segmented Sub-Tab Bar —
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#121417',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#26292e',
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
    backgroundColor: '#ffb313',
  },
  subTabText: {
    color: '#a5a9b2',
    fontSize: 13.5,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#f5f4f0',
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
  filterPillsRow: { flexDirection: 'row', padding: 4, backgroundColor: '#121417', borderRadius: 16, marginBottom: 18, gap: 4 },
  filterPill: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  filterPillActive: { backgroundColor: '#ffb313' },
  filterPillText: { color: '#9b9fa9', fontSize: 12, fontWeight: '600' },
  filterPillTextActive: { color: '#090b0d', fontWeight: '700' },

  // — No Orders —
  noOrdersBox: { backgroundColor: '#090b0d', borderStyle: 'dashed', borderRadius: 20, borderWidth: 1, borderColor: '#26292e', alignItems: 'center', paddingVertical: 34, paddingHorizontal: 20 },
  noOrdersEmoji: { fontSize: 36, marginBottom: 8 },
  noOrdersText: { color: '#f5f4f0', fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 16 },
  addFirstDishBtn: {
    backgroundColor: '#ffb313',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  addFirstDishText: { color: '#090b0d', fontWeight: '800', fontSize: 12 },

  // ═══════════════════════════
  // KDS Order Cards
  // ═══════════════════════════
  kdsCard: {
    backgroundColor: '#121417',
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
    backgroundColor: '#292418',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  tokenPillText: {
    color: '#ffb313',
    fontSize: 16,
    fontWeight: '900',
  },
  kdsPriceText: {
    color: '#f5f4f0',
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
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '800',
  },
  itemSummaryText: {
    color: '#a5a9b2',
    fontSize: 14,
    fontWeight: '500',
  },
  cashPill: {
    backgroundColor: '#292418',
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
    color: '#9b9fa9',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 14,
  },
  notesBox: {
    backgroundColor: '#191c20',
    borderLeftWidth: 3,
    borderLeftColor: '#00a3c4',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  notesText: {
    color: '#e5e6e8',
    fontSize: 12,
    fontWeight: '600',
  },
  kdsActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  btnVerifyPin: {
    flex: 1,
    flexBasis: '45%',
    minWidth: '45%',
    minHeight: 52,
    backgroundColor: '#ffb313',
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
    color: '#f5f4f0',
    fontSize: 14,
    fontWeight: '800',
  },
  btnScanQr: {
    flex: 1,
    flexBasis: '45%',
    minWidth: '45%',
    minHeight: 52,
    backgroundColor: '#121417',
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
    flex: 1,
    flexBasis: '45%',
    minWidth: '45%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#202329',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMoreActionsText: {
    color: '#a5a9b2',
    fontSize: 16,
    fontWeight: '900',
  },
  completedStatusChip: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  completedStatus: {
    color: '#9b9fa9',
    fontSize: 13,
    fontWeight: '700',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#121417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#f5f4f0',
  },
  actionSheetSub: {
    fontSize: 13,
    color: '#9b9fa9',
    marginBottom: 18,
  },
  actionSheetBtnCancel: {
    backgroundColor: '#21171a',
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
    backgroundColor: '#292418',
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
  actionSheetBtnDisabled: { opacity: 0.55 },
  actionSheetBtnTextDisabled: { color: '#8191a5' },
  actionSheetBtnClose: {
    backgroundColor: '#202329',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionSheetBtnCloseText: {
    color: '#a5a9b2',
    fontWeight: '800',
    fontSize: 13,
  },

  // ═══════════════════════════
  // Menu Management
  // ═══════════════════════════
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 18 },
  panelTitle: { color: '#f5f4f0', marginTop: 7, marginBottom: 12, fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  panelSub: { color: '#7a8b9f', fontSize: 12, lineHeight: 18, marginTop: 5 },
  addDishBtn: { backgroundColor: '#ffb313', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12 },
  addDishBtnText: {
    color: '#090b0d',
    fontSize: 12,
    fontWeight: '900',
  },

  // Search
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121417',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#26292e',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f5f4f0',
    fontSize: 13,
    paddingVertical: 12,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: '#9b9fa9',
    fontSize: 14,
    fontWeight: '800',
  },

  // Category Filter
  categoryScrollRow: {
    marginBottom: 12,
    maxHeight: 38,
  },
  categoryPill: {
    backgroundColor: '#121417',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  categoryPillActive: {
    backgroundColor: '#ffb313',
    borderColor: '#0c52a3',
  },
  categoryPillText: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#f5f4f0',
    fontWeight: '900',
  },

  // Inventory Health Stats
  inventoryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  inventoryStatChip: { flex: 1, backgroundColor: '#121417', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#26292e' },
  inventoryStatNum: {
    color: '#ffb313',
    fontSize: 18,
    fontWeight: '900',
  },
  inventoryStatLabel: {
    color: '#9b9fa9',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },

  // Menu Card
  menuCard: {
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#26292e',
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
    backgroundColor: '#202329',
  },
  menuCardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#202329',
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
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  dietTag: {
    backgroundColor: '#15231c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#47db85',
  },
  dietTagNonVeg: {
    backgroundColor: '#21171a',
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
    backgroundColor: '#292418',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryChipText: {
    color: '#ffb313',
    fontSize: 10,
    fontWeight: '700',
  },
  prepTimeText: {
    color: '#9b9fa9',
    fontSize: 10,
    fontWeight: '600',
  },

  // Menu Card Middle — Price + Stock
  menuCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191c20',
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
    color: '#ffb313',
    fontSize: 16,
    fontWeight: '900',
  },
  priceInput: {
    backgroundColor: '#121417',
    color: '#f5f4f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 55,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
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
    backgroundColor: '#202329',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  editDishBtnText: {
    color: '#f5f4f0',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteDishBtn: {
    flex: 1,
    backgroundColor: '#21171a',
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
  analyticsCard: { width: '48%', backgroundColor: '#121417', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#26292e' },
  analyticsVal: { color: '#f5f4f0', fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  analyticsLabel: { color: '#9b9fa9', fontSize: 11, lineHeight: 17, marginTop: 7 },
  canteenInfoCard: {
    backgroundColor: '#121417',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#26292e',
    marginTop: 8,
    gap: 8,
  },
  infoLine: {
    color: '#e5e6e8',
    fontSize: 12,
  },
  deleteCanteenBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: '#21171a',
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
    backgroundColor: '#121417',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#f5f4f0',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    color: '#9b9fa9',
    fontSize: 16,
    padding: 4,
  },
  canteenChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191c20',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  canteenChoiceActive: {
    borderColor: '#0c52a3',
    borderWidth: 1,
    backgroundColor: '#292418',
  },
  canteenChoiceName: {
    color: '#e5e6e8',
    fontSize: 14,
    fontWeight: '700',
  },
  canteenChoiceNameActive: {
    color: '#ffb313',
  },
  canteenChoiceLoc: {
    color: '#9b9fa9',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#ffb313',
    fontWeight: '900',
    fontSize: 16,
  },
  modalCreateBtn: {
    backgroundColor: '#ffb313',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCreateText: {
    color: '#f5f4f0',
    fontWeight: '900',
    fontSize: 13,
  },

  // PIN Verify Modal
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#202329',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  modalCloseBtnText: {
    color: '#9b9fa9',
    fontSize: 14,
    fontWeight: '800',
  },
  verifyModalContent: {
    backgroundColor: '#121417',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#26292e',
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
    color: '#f5f4f0',
    fontSize: 17,
    fontWeight: '800',
  },
  verifyModalSub: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  verifyPinBox: {
    backgroundColor: '#191c20',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  verifyInstruction: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinInputField: {
    backgroundColor: '#121417',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0c52a3',
    color: '#f5f4f0',
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
    color: '#f5f4f0',
    fontSize: 14,
    fontWeight: '800',
  },
  bypassBtn: {
    backgroundColor: '#202329',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  bypassBtnText: {
    color: '#9b9fa9',
    fontSize: 12,
    fontWeight: '700',
  },
  batchBanner: {
    backgroundColor: '#292418',
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
    backgroundColor: '#121417',
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
    color: '#f5f4f0',
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
    color: '#47db85',
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
    backgroundColor: '#ffb313',
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
    color: '#f5f4f0',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  rootWrapper: {
    flex: 1,
    backgroundColor: '#090b0d',
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
    color: '#f5f4f0',
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
    backgroundColor: '#ffb313',
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
    color: '#f5f4f0',
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
    color: '#f5f4f0',
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
    color: '#f5f4f0',
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
    color: '#f5f4f0',
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
    backgroundColor: '#202329',
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
    color: '#f5f4f0',
    fontSize: 12,
    fontWeight: '800',
  },
  readyListHeader: {
    color: '#9b9fa9',
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
