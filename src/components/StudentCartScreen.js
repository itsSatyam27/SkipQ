import { orderDate as getOrderDate } from '../utils/orderDisplay.cjs';
import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
  Switch,
  Linking
} from 'react-native';
import { AppContext } from '../context/AppContext';
import LocationControl from './LocationControl';
import { isUsableLocation } from '../services/locationPolicy.cjs';
import { playOrderPlacedSound } from '../utils/audio';
import { getDistanceInMeters, formatDistance, isWithinOrderingPerimeter, MAX_ORDER_DISTANCE_METERS } from '../utils/distance';

const BREAK_SLOTS = [
  { id: 'ASAP', label: ' ASAP', sub: 'Cook Now' },
  { id: '11:15 AM - Morning Recess', label: ' 11:15 AM', sub: 'Recess Break' },
  { id: '01:10 PM - Lunch Break', label: ' 01:10 PM', sub: 'Lunch Break' },
  { id: '03:45 PM - Evening Break', label: ' 03:45 PM', sub: 'Evening Tea' },
];

export default function StudentCartScreen({ onNavigateToExplore, onOpenPassModal, onOrderPlaced }) {
  const styles = useSellerStyles(baseStyles);
  const { light } = useSellerTheme();
  const {
    cart,
    updateCartQty,
    clearCart,
    setCartSpecialInstructions,
    placeOrder,
    orders,
    activeOrderId,
    walletBalance,
    userProfile,
    canteens,
    userLocation,
    locationTesting,
    requestUserLocation,
    locationStatus,
    reorderItems,
    rateOrder,
    rushModeActive
  } = useContext(AppContext);

  const scrollViewRef = useRef(null);

  // Cart & Checkout state
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [instructions, setInstructions] = useState(cart.specialInstructions || '');
  const [pickupSlot, setPickupSlot] = useState('ASAP');
  const [isGroupOrder, setIsGroupOrder] = useState(false);
  const [groupCollectorName, setGroupCollectorName] = useState('');
  const [facultyRoomNote, setFacultyRoomNote] = useState(userProfile?.facultyRoomNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reorderSuccessNotice, setReorderSuccessNotice] = useState(null);

  // Active Pass Countdown
  const activeOrderObj = (orders || []).find(o => o.id === activeOrderId);
  const hasActivePass =
    activeOrderObj &&
    activeOrderObj.orderStatus !== 'Completed' &&
    activeOrderObj.orderStatus !== 'Cancelled' &&
    activeOrderObj.orderStatus !== 'Abandoned';

  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!activeOrderObj || !activeOrderObj.timestamp || !hasActivePass) {
      setSecondsLeft(0);
      return;
    }
    const isReady = activeOrderObj.orderStatus === 'Ready' || activeOrderObj.orderStatus === 'Ready for Pickup';
    if (isReady) {
      setSecondsLeft(0);
      return;
    }

    const prepMins = activeOrderObj.estimatedPrepMins || 5;
    const targetMs = new Date(activeOrderObj.timestamp).getTime() + prepMins * 60 * 1000;

    const tick = () => {
      const remainingSec = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
      setSecondsLeft(remainingSec);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeOrderObj, hasActivePass]);

  // Rating Modal state for past orders
  const [ratingTargetOrder, setRatingTargetOrder] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Cart calculation
  const cartItems = cart?.items || [];
  const cartTotalItems = cartItems.reduce((sum, it) => sum + it.qty, 0);
  const totalAmount = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  const deposit10Percent = 0;
  const isCash = paymentMethod === 'Cash';
  const upfrontPayable = isCash ? deposit10Percent : totalAmount;
  const dueAtCounter = isCash ? totalAmount : 0;

  // Past orders (all orders except current active preparing one if any)
  const pastOrders = (orders || []).filter(o => o.id !== activeOrderId || !hasActivePass);

  // Campus Geofence Calculation (<500m perimeter)
  const matchedShop = (canteens || []).find(c => c.id === cart?.shopId) || {};
  const shopLat = matchedShop.lat ?? 23.0917;
  const shopLng = matchedShop.lng ?? 72.5349;
  const hasUserLocation = isUsableLocation(userLocation);
  const stallDistanceMeters = hasUserLocation
    ? getDistanceInMeters(userLocation.lat, userLocation.lng, shopLat, shopLng)
    : null;
  const isWithinStallPerimeter = locationTesting ||
    stallDistanceMeters != null &&
    isWithinOrderingPerimeter(stallDistanceMeters, userLocation?.accuracy || 0);

  const handleUpdateQty = (itemId, delta) => {
    updateCartQty(itemId, delta);
  };

  const handleInstructionsChange = (text) => {
    setInstructions(text);
    if (setCartSpecialInstructions) {
      setCartSpecialInstructions(text);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add dishes to your cart first.');
      return;
    }

    if (!locationTesting) {
      let location = userLocation;
      if (!isUsableLocation(location)) {
        try { location = await requestUserLocation(); } catch { return; }
      }
      if (!isUsableLocation(location)) return;
      const currentDistance = getDistanceInMeters(location.lat, location.lng, shopLat, shopLng);
      if (!isWithinOrderingPerimeter(currentDistance, location.accuracy)) {
        Alert.alert(
          'Outside pickup range',
          `Hardware GPS detects you are ${formatDistance(currentDistance)} away from ${cart.shopName || 'Silver Oak University'} (>500m campus limit).\n\nSkipQ orders can only be placed while physically within the campus perimeter.`,
          [{ text: 'Got it', style: 'cancel' }]
        );
        return;
      }
    }

    if (paymentMethod === 'Wallet' && walletBalance < totalAmount) {
      Alert.alert(
        'Insufficient Wallet Balance',
        `Your SkipQ Wallet has ₹${walletBalance.toFixed(0)}, but your order total is ₹${totalAmount}.\n\nPlease top up your wallet or choose UPI / Cash at Stall.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const isFaculty = userProfile?.userType === 'faculty';
      const matchedShop = (canteens || []).find(c => c.id === cart.shopId) || {};
      const orderData = {
        shopId: cart.shopId,
        shopName: cart.shopName,
        sellerId: matchedShop.ownerId || '',
        buyerName: userProfile?.name || (isFaculty ? 'University Faculty' : 'Campus Student'),
        buyerRollNo: userProfile?.rollNo || '',
        buyerPhone: userProfile?.phone || '',
        items: cartItems,
        specialInstructions: instructions.trim(),
        totalAmount,
        upfrontPaid: upfrontPayable,
        dueAtCounter,
        heldDepositAmount: isCash ? deposit10Percent : 0,
        paymentMethod,
        paymentStatus: isCash ? 'TOKEN_PAID_CASH_DUE' : 'PENDING_MERCHANT_CONFIRMATION',
        orderPlacedAt: new Date().toISOString(),
        cancellationGraceSecs: 120, // 2-minute cancellation & refund window
        pickupSlot,
        isFacultyExpress: isFaculty,
        facultyRoomNote: isFaculty ? facultyRoomNote.trim() : '',
        groupCollectorName: isGroupOrder ? groupCollectorName.trim() : ''
      };

      const confirmed = await placeOrder(orderData);
      if (confirmed.paymentMethod === 'UPI' && Platform.OS !== 'web') {
        const uri = `upi://pay?pa=${encodeURIComponent(confirmed.merchantUpi)}&pn=${encodeURIComponent(confirmed.shopName)}&am=${confirmed.totalAmount}&cu=INR&tn=${encodeURIComponent(confirmed.tokenNumber)}`;
        Linking.openURL(uri).catch(() => Alert.alert('Open your UPI app', `Pay ₹${confirmed.totalAmount} to ${confirmed.merchantUpi}. Ask the seller to confirm receipt.`));
      }
      try {
        await playOrderPlacedSound();
      } catch (e) {}

      if (onOrderPlaced) {
        onOrderPlaced();
      }

      Alert.alert('Order confirmed', confirmed.paymentMethod === 'Cash'
        ? `Pay ₹${confirmed.totalAmount} in cash at ${confirmed.shopName} when you collect your order.`
        : `Pay ₹${confirmed.totalAmount} to ${confirmed.merchantUpi}. Payment remains pending until the canteen confirms receipt. Contact the canteen directly for any refund.`,
        [{ text: 'View Pickup Pass' }]);
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: 0, animated: true });
      }
    } catch (err) {
      Alert.alert('Order Placement Error', err.message || 'Could not complete order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReorder = (orderObj) => {
    if (!orderObj || !orderObj.items || orderObj.items.length === 0) return;
    reorderItems(orderObj.id);
    setReorderSuccessNotice(`Added ${orderObj.items.length} items from ${orderObj.shopName || orderObj.canteenName || 'canteen'} to Cart!`);
    setTimeout(() => {
      setReorderSuccessNotice(null);
    }, 3500);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleOpenRating = (orderObj) => {
    setRatingTargetOrder(orderObj);
    setRatingStars(orderObj.rating || 5);
    setReviewComment(orderObj.review || '');
  };

  const handleSubmitRating = () => { rateOrder(); setRatingTargetOrder(null); };

  const paymentApps = [{ id: 'Cash', label: ' Cash at pickup' }, { id: 'UPI', label: ' UPI (seller confirms)' }];

  const formatTimer = (sec) => {
    if (sec === null || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Reorder Floating Toast */}
      {reorderSuccessNotice && (
        <View style={styles.toastNotice}>
          <Text style={styles.toastNoticeText}> {reorderSuccessNotice}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Title */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{cartTotalItems > 0 ? 'Review order' : 'Your orders'}</Text>
            <Text style={styles.headerSub}>{cartTotalItems > 0 ? `CART ? ${cartTotalItems} ${cartTotalItems === 1 ? 'ITEM' : 'ITEMS'}` : 'CART & ORDERS'}</Text>
          </View>
          {cartTotalItems > 0 && (
            <TouchableOpacity style={styles.clearCartBtn} onPress={clearCart}>
              <Text style={styles.clearCartText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ============================================================ */}
        {/* SECTION 1: ITEMS TO BUY (Active Cart) */}
        {/* ============================================================ */}
        <View style={[styles.sectionCard, cartTotalItems === 0 ? styles.emptySection : styles.checkoutSection]}>
          {false && <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}></Text>
              <Text style={styles.sectionTitle}>Items to Buy</Text>
            </View>
            {cartTotalItems > 0 && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'}</Text>
              </View>
            )}
          </View>}

          {cartTotalItems > 0 ? (
            <View style={styles.cartContentBox}>
              {/* Stall Name Tag */}
              <View style={styles.stallBanner}>
                <Text style={styles.stallBannerText}> {cart.shopName || 'Campus Food Stall'}</Text>
                <Text style={styles.stallCampusTag}>Silver Oak University</Text>
              </View>

              {/* Items List */}
              <View style={styles.itemsListContainer}>
                {cartItems.map((item, idx) => (
                  <View key={item.id || idx} style={styles.cartItemRow}>
                    <View style={styles.cartItemLeft}>
                      <View style={styles.vegIndicator}>
                        <View style={[styles.vegDot, { backgroundColor: item.isVeg !== false ? '#10b981' : '#ef4444' }]} />
                      </View>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.cartItemName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.cartItemPrice}>₹{item.price} each</Text>
                      </View>
                    </View>

                    {/* Quantity Stepper */}
                    <View style={styles.stepperWrap}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleUpdateQty(item.id, -1)}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.stepperQtyText}>{item.qty}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleUpdateQty(item.id, 1)}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Item Subtotal */}
                    <Text style={styles.cartItemSubtotal}>₹{item.price * item.qty}</Text>
                  </View>
                ))}
              </View>

              {/* Rush Mode Alert */}
              {rushModeActive && (
                <View style={styles.cartRushNotice}>
                  <Text style={styles.cartRushTitle}> KITCHEN HIGH RUSH ACTIVE</Text>
                  <Text style={styles.cartRushSub}>
                    High order traffic at campus counters. +10 mins estimated preparation buffer applied.
                  </Text>
                </View>
              )}

              {/* Faculty Express Card */}
              {userProfile?.userType === 'faculty' && (
                <View style={styles.cartFacultyCard}>
                  <View style={styles.cartFacultyHeader}>
                    <Text style={styles.cartFacultyTitle}>⭐ FACULTY EXPRESS PRIORITY</Text>
                  </View>
                  <Text style={styles.cartFacultyDesc}>
                    Your order is tagged for priority preparation at the staff counter.
                  </Text>
                  <TextInput
                    style={styles.cartFacultyInput}
                    placeholder="Staff Room / Dept Delivery (e.g. Block A, Room 204)"
                    placeholderTextColor="#c084fc"
                    value={facultyRoomNote}
                    onChangeText={setFacultyRoomNote}
                  />
                </View>
              )}

              {/* Pre-Order Break Slot Timing */}
              <View style={styles.slotContainer}>
                <Text style={styles.inputLabel}>⏰ PICKUP TIMING (BREAK SLOTS)</Text>
                <View style={styles.slotGrid}>
                  {BREAK_SLOTS.map(slot => (
                    <TouchableOpacity
                      key={slot.id}
                      style={[styles.slotCard, pickupSlot === slot.id && styles.slotCardActive]}
                      onPress={() => setPickupSlot(slot.id)}
                    >
                      <Text style={[styles.slotCardTitle, pickupSlot === slot.id && styles.slotCardTitleActive]}>
                        {slot.label}
                      </Text>
                      <Text style={styles.slotCardSub}>{slot.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Roommate / Group Order Option */}
              <View style={styles.roommateCard}>
                <View style={styles.roommateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roommateTitle}> Roommate / Group Pickup</Text>
                    <Text style={styles.roommateSub}>Let a friend or roommate pick this up</Text>
                  </View>
                  <Switch
                    value={isGroupOrder}
                    onValueChange={setIsGroupOrder}
                    trackColor={{ false: '#334155', true: '#0ea5e9' }}
                    thumbColor={isGroupOrder ? '#ffffff' : '#94a3b8'}
                  />
                </View>
                {isGroupOrder && (
                  <TextInput
                    style={styles.collectorInput}
                    placeholder="Friend's Name & Hostel Room (e.g. Yash - Room 304)"
                    placeholderTextColor="#64748b"
                    value={groupCollectorName}
                    onChangeText={setGroupCollectorName}
                  />
                )}
              </View>

              {/* Cooking Instructions Input */}
              <View style={styles.instructionsContainer}>
                <Text style={styles.inputLabel}>SPECIAL COOKING INSTRUCTIONS</Text>
                <TextInput
                  style={styles.instructionInput}
                  placeholder="e.g., Less spicy, no onion, extra napkins..."
                  placeholderTextColor="#64748b"
                  value={instructions}
                  onChangeText={handleInstructionsChange}
                  maxLength={120}
                />
              </View>

              {/* Payment Method Selector */}
              <View style={styles.paymentSection}>
                <Text style={styles.inputLabel}>CHOOSE PAYMENT METHOD</Text>
                <View style={styles.paymentGrid}>
                  {paymentApps.map((p) => {
                    const isSelected = paymentMethod === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.paymentPill, isSelected && styles.paymentPillSelected]}
                        onPress={() => setPaymentMethod(p.id)}
                      >
                        <Text style={[styles.paymentPillText, isSelected && styles.paymentPillTextSelected]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isCash ? (
                  <View style={styles.cashNoticeBox}>
                    <Text style={styles.cashNoticeTitle}>
                       Cash at pickup
                    </Text>
                    <Text style={styles.cashNoticeSub}>
                      Pay the full ₹{dueAtCounter} at the canteen counter. No advance deposit or wallet payment.
                    </Text>
                  </View>
                ) : paymentMethod === 'Wallet' ? (
                  <View style={styles.onlineNoticeBox}>
                    <Text style={styles.onlineNoticeTitle}>
                       SkipQ Security Wallet Payment
                    </Text>
                    <Text style={styles.onlineNoticeSub}>
                      Available Balance: ₹{walletBalance.toFixed(0)}. Instant zero-friction pass generation with no UPI app switching.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.onlineNoticeBox}>
                    <Text style={styles.onlineNoticeTitle}>
                       UPI payment — seller confirmation required
                    </Text>
                    <Text style={styles.onlineNoticeSub}>
                      Pay ₹{totalAmount} directly to the canteen. A payment app opening does not confirm payment. Refunds are handled by the canteen.
                    </Text>
                  </View>
                )}
              </View>

              {/* Bill Breakdown */}
              <View style={styles.billBox}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Item Total</Text>
                  <Text style={styles.billValue}>₹{totalAmount}</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Campus Queue Skip Priority</Text>
                  <Text style={[styles.billValue, { color: '#10b981' }]}>FREE</Text>
                </View>
                {isCash ? (
                  <>
                    <View style={[styles.billRow, { borderTopWidth: 1, borderTopColor: '#e2d9cc', paddingTop: 8, marginTop: 4 }]}>
                      <Text style={[styles.billLabel, { color: '#ffb313', fontWeight: '800' }]}>Advance payment</Text>
                      <Text style={[styles.billValue, { color: '#ffb313', fontWeight: '800' }]}>₹{deposit10Percent}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: '#b45309', fontWeight: '800' }]}> Pay at Counter (Cash)</Text>
                      <Text style={[styles.billValue, { color: '#b45309', fontWeight: '800' }]}>₹{dueAtCounter}</Text>
                    </View>
                  </>
                ) : paymentMethod === 'Wallet' ? (
                  <View style={[styles.billRow, styles.billRowTotal]}>
                    <Text style={styles.billTotalLabel}>Deduct from Wallet</Text>
                    <Text style={styles.billTotalValue}>₹{totalAmount}</Text>
                  </View>
                ) : (
                  <View style={[styles.billRow, styles.billRowTotal]}>
                    <Text style={styles.billTotalLabel}>Total Payable Now (UPI)</Text>
                    <Text style={styles.billTotalValue}>₹{totalAmount}</Text>
                  </View>
                )}
              </View>

              <LocationControl />

              {/* Place Order CTA */}
              <TouchableOpacity
                style={[
                  styles.placeOrderBtn,
                  (!locationTesting && (!hasUserLocation || !isWithinStallPerimeter)) && styles.placeOrderBtnBlocked
                ]}
                onPress={handlePlaceOrder}
                disabled={isSubmitting || (!locationTesting && locationStatus === 'locating')}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : !locationTesting && !hasUserLocation ? (
                  <>
                    <Text style={styles.placeOrderBtnText}>Enable GPS to order</Text>
                    <Text style={styles.placeOrderBtnSub}>Tap to check location</Text>
                  </>
                ) : !isWithinStallPerimeter ? (
                  <>
                    <Text style={styles.placeOrderBtnText}> Blocked: {formatDistance(stallDistanceMeters)} Away</Text>
                    <Text style={styles.placeOrderBtnSub}>Must be within 500m of campus to order</Text>
                  </>
                ) : isCash ? (
                  <>
                    <Text style={styles.placeOrderBtnText}>Place Order · Cash at Pickup</Text>
                    <Text style={styles.placeOrderBtnSub}>Pay ₹{dueAtCounter} Cash at Stall • Instant Token</Text>
                  </>
                ) : paymentMethod === 'Wallet' ? (
                  <>
                    <Text style={styles.placeOrderBtnText}> Pay ₹{totalAmount} with SkipQ Wallet</Text>
                    <Text style={styles.placeOrderBtnSub}>Instant Digital Pass • Wallet Bal: ₹{walletBalance.toFixed(0)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.placeOrderBtnText}>Place Order · Pay ₹{totalAmount} via UPI</Text>
                    <Text style={styles.placeOrderBtnSub}>Payment pending until seller confirmation</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.compactEmptyCart}>
              <View style={styles.emptyCartVector}><InterfaceIcon name="cart" size={23} color="#ffb313" /></View>
              <View style={{ flex: 1 }}><Text style={styles.compactEmptyTitle}>Your cart is empty</Text><Text style={styles.compactEmptyCopy}>Add dishes and skip the queue.</Text></View>
              <TouchableOpacity accessibilityRole="button" onPress={onNavigateToExplore} style={styles.compactBrowse}><Text style={styles.compactBrowseText}>Browse</Text></TouchableOpacity>
            </View>
          )}
        </View>

        {/* ============================================================ */}
        {/* SECTION 2: ACTIVE PICKUP PASS (if active order in kitchen)   */}
        {/* ============================================================ */}
        {hasActivePass && (
          <View style={styles.activePassCard}>
            <View style={styles.activePassTop}>
              <View style={styles.activeStatusPill}>
                <View style={styles.pulsingDot} />
                <Text style={styles.activeStatusText}>
                  {activeOrderObj.orderStatus === 'Ready' || activeOrderObj.orderStatus === 'Ready for Pickup'
                    ? 'READY FOR PICKUP'
                    : 'PREPARING IN KITCHEN'}
                </Text>
              </View>
              {secondsLeft > 0 && (
                <View style={styles.timerPill}>
                  <Text style={styles.timerText}> {formatTimer(secondsLeft)}</Text>
                </View>
              )}
            </View>

            <View style={styles.activePassBody}>
              <View>
                <Text style={styles.tokenPrefix}>CAMPUS PICKUP TOKEN</Text>
                <Text style={styles.tokenNumber}>#{activeOrderObj.tokenNumber || activeOrderObj.id}</Text>
                <Text style={styles.activePassShop}> {activeOrderObj.canteenName || activeOrderObj.shopName}</Text>
              </View>
              <View style={styles.pinContainer}>
                <Text style={styles.pinLabel}>COUNTER PIN</Text>
                <Text style={styles.pinCode}>{activeOrderObj.pickupPin || '4821'}</Text>
              </View>
            </View>

            <View style={styles.activePassItems}>
              <Text style={styles.activeItemsSummary} numberOfLines={1}>
                {(activeOrderObj.items || []).map(i => `${i.qty}x ${i.name}`).join(' • ')}
              </Text>
            </View>

            <TouchableOpacity style={styles.viewPassBtn} onPress={onOpenPassModal} activeOpacity={0.85}>
              <Text style={styles.viewPassBtnText}> View Full Digital Pickup Pass & Barcode </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* SECTION 3: PAST ORDERS HISTORY                               */}
        {/* ============================================================ */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}></Text>
              <Text style={styles.sectionTitle}>Past orders</Text>
            </View>
            <View style={styles.badgePillSecondary}>
              <Text style={styles.badgeTextSecondary}>{pastOrders.length} past</Text>
            </View>
          </View>

          {pastOrders.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryIcon}></Text>
              <Text style={styles.emptyHistoryTitle}>No past orders yet</Text>
              <Text style={styles.emptyHistorySub}>
                Your completed orders, receipts, and fast 1-tap re-orders will be listed right here.
              </Text>
            </View>
          ) : (
            <View style={styles.pastOrdersList}>
              {pastOrders.map((ord) => {
                const isCompleted = ord.orderStatus === 'Completed';
                const isCancelled = ord.orderStatus === 'Cancelled';
                const orderDate = getOrderDate(ord);

                return (
                  <View key={ord.id} style={styles.pastOrderCard}>
                    {/* Top Row: Shop & Status */}
                    <View style={styles.pastOrderTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pastOrderShop}>{ord.canteenName || ord.shopName || 'Campus Food Stall'}</Text>
                        <Text style={styles.pastOrderDate}>
                          {orderDate ? orderDate.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Date unavailable'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.orderStatusPill,
                          isCompleted
                            ? styles.statusCompleted
                            : isCancelled
                            ? styles.statusCancelled
                            : styles.statusReady
                        ]}
                      >
                        <Text
                          style={[
                            styles.orderStatusText,
                            isCompleted
                              ? styles.statusTextCompleted
                              : isCancelled
                              ? styles.statusTextCancelled
                              : styles.statusTextReady
                          ]}
                        >
                          {ord.orderStatus || 'Completed'}
                        </Text>
                      </View>
                    </View>

                    {/* Items Summary */}
                    <View style={styles.pastOrderItemsBox}>
                      {(ord.items || []).map((it, idx) => (
                        <View key={idx} style={styles.pastOrderItemRow}>
                          <Text style={styles.pastOrderItemQty}>{it.qty}x</Text>
                          <Text style={styles.pastOrderItemName} numberOfLines={1}>{it.name}</Text>
                          <Text style={styles.pastOrderItemPrice}>₹{it.price * it.qty}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Total & Action Buttons */}
                    <View style={styles.pastOrderBottom}>
                      <View>
                        <Text style={styles.pastOrderTotalLabel}>{isCompleted ? 'Total paid' : 'Total'}</Text>
                        <Text style={styles.pastOrderTotalVal}>₹{ord.totalAmount}</Text>
                      </View>

                      <View style={styles.pastOrderActions}>
                        {/* Only completed pickups may be rated. */}
                        {isCompleted && <TouchableOpacity
                          style={styles.rateBtn}
                          onPress={() => handleOpenRating(ord)}
                        >
                          <Text style={styles.rateBtnText}>
                            {ord.rating ? `⭐ ${ord.rating}` : '⭐ Rate'}
                          </Text>
                        </TouchableOpacity>}

                        {/* 1-Tap Re-order Button */}
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleReorder(ord)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.reorderBtnText}> Re-order</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Bottom padding for dock */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 5-Star Rating Modal */}
      <Modal visible={!!ratingTargetOrder} animationType="fade" transparent onRequestClose={() => setRatingTargetOrder(null)}>
        <View style={styles.ratingModalOverlay}>
          <View style={styles.ratingModalContent}>
            <Text style={styles.ratingModalTitle}>Rate Your Campus Meal</Text>
            <Text style={styles.ratingModalSub}>{ratingTargetOrder?.canteenName || ratingTargetOrder?.shopName}</Text>

            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRatingStars(star)} style={styles.starTouch}>
                  <Text style={[styles.starIcon, ratingStars >= star ? styles.starFilled : styles.starEmpty]}>

                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.ratingInput}
              placeholder="How was the food and pickup speed?"
              placeholderTextColor="#64748b"
              value={reviewComment}
              onChangeText={setReviewComment}
              maxLength={150}
              multiline
            />

            <View style={styles.ratingModalButtons}>
              <TouchableOpacity style={styles.cancelRatingBtn} onPress={() => setRatingTargetOrder(null)}>
                <Text style={styles.cancelRatingText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitRatingBtn} onPress={handleSubmitRating}>
                <Text style={styles.submitRatingText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  emptySection: { padding: 14, borderStyle: 'dashed', backgroundColor: 'transparent' },
  compactEmptyCart: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyCartVector: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },
  compactEmptyTitle: { color: '#f5f4f0', fontSize: 14, fontWeight: '700' },
  compactEmptyCopy: { color: '#a5a9b2', fontSize: 12, lineHeight: 18, marginTop: 4 },
  compactBrowse: { backgroundColor: '#ffb313', borderRadius: 13, minHeight: 42, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  compactBrowseText: { color: '#090b0d', fontSize: 12, fontWeight: '700' },
  historySection: { marginTop: 18 },
  container: {
    flex: 1,
    backgroundColor: '#090b0d',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 150,
  },
  toastNotice: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: '#ffb313',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 999,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastNoticeText: {
    color: '#090b0d',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#f5f4f0',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#a5a9b2',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  clearCartBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#fee2e2',
  },
  clearCartText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#121417',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#26292e',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIcon: {
    fontSize: 18,
  },
  sectionTitle: {
    color: '#f5f4f0',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  badgePill: {
    backgroundColor: '#ccfbf1',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  badgeText: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '800',
  },
  badgePillSecondary: {
    backgroundColor: '#202329',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeTextSecondary: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '700',
  },
  stallBanner: {
    backgroundColor: '#17191d',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  stallBannerText: {
    color: '#ffb313',
    fontSize: 13,
    fontWeight: '800',
  },
  stallCampusTag: {
    color: '#a5a9b2',
    fontSize: 11,
    fontWeight: '600',
  },
  itemsListContainer: {
    marginBottom: 12,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cartItemLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  vegIndicator: {
    width: 14,
    height: 14,
    borderWidth: 1.5,
    borderColor: '#26292e',
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  vegDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cartItemName: {
    color: '#f5f4f0',
    fontSize: 14,
    fontWeight: '800',
  },
  cartItemPrice: {
    color: '#a5a9b2',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202329',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 12,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperBtnText: {
    color: '#ffb313',
    fontSize: 15,
    fontWeight: '900',
  },
  stepperQtyText: {
    color: '#ffb313',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 18,
    textAlign: 'center',
  },
  cartItemSubtotal: {
    color: '#f5f4f0',
    fontSize: 14,
    fontWeight: '900',
    minWidth: 44,
    textAlign: 'right',
  },
  instructionsContainer: {
    marginTop: 8,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#b6bac2',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  instructionInput: {
    backgroundColor: '#17191d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26292e',
    color: '#f5f4f0',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '600',
  },
  paymentSection: {
    marginBottom: 14,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  paymentPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#17191d',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  paymentPillSelected: {
    backgroundColor: '#202329',
    borderColor: '#ffb313',
    borderWidth: 1.5,
  },
  paymentPillText: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentPillTextSelected: {
    color: '#ffb313',
    fontWeight: '900',
  },
  cashNoticeBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  cashNoticeAlert: {
    borderColor: '#f59e0b',
    backgroundColor: '#292418',
  },
  cashNoticeTitle: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '900',
  },
  cashNoticeSub: {
    color: '#92400e',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    fontWeight: '600',
  },
  onlineNoticeBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ccfbf1',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  onlineNoticeTitle: {
    color: '#0f766e',
    fontSize: 12,
    fontWeight: '900',
  },
  onlineNoticeSub: {
    color: '#134e4a',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
    fontWeight: '600',
  },
  billBox: {
    backgroundColor: '#17191d',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#26292e',
    gap: 6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    color: '#a5a9b2',
    fontSize: 13,
    fontWeight: '600',
  },
  billValue: {
    color: '#f5f4f0',
    fontSize: 13,
    fontWeight: '800',
  },
  billRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#26292e',
    paddingTop: 10,
    marginTop: 6,
  },
  billTotalLabel: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '900',
  },
  billTotalValue: {
    color: '#ffb313',
    fontSize: 18,
    fontWeight: '900',
  },
  placeOrderBtn: {
    backgroundColor: '#ffb313',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  placeOrderBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#cbd5e1',
  },
  placeOrderBtnText: {
    color: '#090b0d',
    fontSize: 16,
    fontWeight: '900',
  },
  placeOrderBtnSub: {
    color: '#ccfbf1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  placeOrderBtnBlocked: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
  },
  geofenceNoticeBoxPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  geofenceNoticeBoxBlocked: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  geofenceNoticeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  geofenceNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
  },
  geofenceNoticeSub: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 2,
  },
  geofenceNoticeTitleBlocked: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991b1b',
  },
  geofenceNoticeSubBlocked: {
    fontSize: 11,
    color: '#b91c1c',
    marginTop: 2,
  },
  emptyCartBox: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyCartIcon: {
    fontSize: 44,
    marginBottom: 10,
  },
  emptyCartTitle: {
    color: '#f5f4f0',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyCartSub: {
    color: '#a5a9b2',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  exploreDishesBtn: {
    backgroundColor: '#ffb313',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  exploreDishesBtnText: {
    color: '#090b0d',
    fontSize: 13,
    fontWeight: '900',
  },
  activePassCard: {
    backgroundColor: '#121417',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#00a3c4',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  activePassTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ccfbf1',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0f766e',
  },
  activeStatusText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
  },
  timerPill: {
    backgroundColor: '#202329',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  timerText: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '900',
  },
  activePassBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tokenPrefix: {
    color: '#a5a9b2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenNumber: {
    color: '#ffb313',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activePassShop: {
    color: '#a5a9b2',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  pinContainer: {
    backgroundColor: '#202329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  pinLabel: {
    color: '#ffb313',
    fontSize: 9,
    fontWeight: '800',
  },
  pinCode: {
    color: '#ffb313',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  activePassItems: {
    backgroundColor: '#17191d',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  activeItemsSummary: {
    color: '#b6bac2',
    fontSize: 12,
    fontWeight: '600',
  },
  viewPassBtn: {
    backgroundColor: '#ffb313',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  viewPassBtnText: {
    color: '#090b0d',
    fontSize: 13,
    fontWeight: '900',
  },
  emptyHistoryBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  emptyHistoryIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyHistoryTitle: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyHistorySub: {
    color: '#a5a9b2',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  pastOrdersList: {
    gap: 12,
  },
  pastOrderCard: {
    backgroundColor: '#121417',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26292e',
    padding: 14,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  pastOrderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pastOrderShop: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '800',
  },
  pastOrderDate: {
    color: '#a5a9b2',
    fontSize: 11,
    marginTop: 2,
  },
  orderStatusPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#ccfbf1',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusReady: {
    backgroundColor: '#202329',
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextCompleted: {
    color: '#0f766e',
  },
  statusTextCancelled: {
    color: '#dc2626',
  },
  statusTextReady: {
    color: '#ffb313',
  },
  pastOrderItemsBox: {
    backgroundColor: '#17191d',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  pastOrderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastOrderItemQty: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '800',
    width: 24,
  },
  pastOrderItemName: {
    flex: 1,
    color: '#e5e6e8',
    fontSize: 12,
    fontWeight: '600',
  },
  pastOrderItemPrice: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '700',
  },
  pastOrderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  pastOrderTotalLabel: {
    color: '#a5a9b2',
    fontSize: 10,
    fontWeight: '700',
  },
  pastOrderTotalVal: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '900',
  },
  pastOrderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  rateBtnText: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  reorderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#ffb313',
  },
  reorderBtnText: {
    color: '#090b0d',
    fontSize: 12,
    fontWeight: '900',
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingModalContent: {
    backgroundColor: '#121417',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#26292e',
    padding: 22,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  ratingModalTitle: {
    color: '#f5f4f0',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  ratingModalSub: {
    color: '#a5a9b2',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 16,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  starTouch: {
    padding: 4,
  },
  starIcon: {
    fontSize: 34,
  },
  starFilled: {
    color: '#f59e0b',
  },
  starEmpty: {
    color: '#e2e8f0',
  },
  ratingInput: {
    backgroundColor: '#17191d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26292e',
    color: '#f5f4f0',
    fontSize: 13,
    padding: 12,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontWeight: '600',
  },
  ratingModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelRatingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#17191d',
    alignItems: 'center',
  },
  cancelRatingText: {
    color: '#a5a9b2',
    fontSize: 14,
    fontWeight: '800',
  },
  submitRatingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#ffb313',
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#090b0d',
    fontSize: 14,
    fontWeight: '900',
  },
  cartRushNotice: {
    backgroundColor: '#292418',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  cartRushTitle: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cartRushSub: {
    color: '#92400e',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  cartFacultyCard: {
    backgroundColor: '#202329',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  cartFacultyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  cartFacultyTitle: {
    color: '#ffb313',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cartFacultyDesc: {
    color: '#e5e6e8',
    fontSize: 11,
    marginBottom: 8,
  },
  cartFacultyInput: {
    backgroundColor: '#121417',
    color: '#f5f4f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  slotContainer: {
    marginBottom: 14,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCard: {
    flexBasis: '48%',
    backgroundColor: '#17191d',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  slotCardActive: {
    borderColor: '#ffb313',
    backgroundColor: '#202329',
    borderWidth: 1.5,
  },
  slotCardTitle: {
    color: '#b6bac2',
    fontSize: 12,
    fontWeight: '800',
  },
  slotCardTitleActive: {
    color: '#ffb313',
  },
  slotCardSub: {
    color: '#a5a9b2',
    fontSize: 10,
    marginTop: 2,
  },
  roommateCard: {
    backgroundColor: '#17191d',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#26292e',
  },
  roommateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roommateTitle: {
    color: '#f5f4f0',
    fontSize: 12,
    fontWeight: '800',
  },
  roommateSub: {
    color: '#a5a9b2',
    fontSize: 10,
    marginTop: 1,
  },
  collectorInput: {
    backgroundColor: '#121417',
    color: '#f5f4f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#26292e',
    marginTop: 8,
  },
  checkoutSection: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, marginTop: 0 },
  stallBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 14, padding: 13, gap: 12, marginBottom: 12 },
  stallBannerText: { color: '#ffb313', fontSize: 12, fontWeight: '700', flex: 1 },
  stallCampusTag: { color: '#a5a9b2', fontSize: 10, flexShrink: 1 },
  cartItemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, marginBottom: 9, borderWidth: 1, borderColor: '#26292e', borderRadius: 14, backgroundColor: '#121417' },
  cartItemName: { color: '#f5f4f0', fontSize: 13, fontWeight: '700' },
  cartItemPrice: { color: '#a5a9b2', fontSize: 11, marginTop: 4 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  slotCard: { width: '48%', padding: 13, borderWidth: 1, borderColor: '#26292e', backgroundColor: '#121417', borderRadius: 13 },
  slotCardActive: { backgroundColor: '#211a07', borderColor: '#ffb313' },
  slotCardTitle: { color: '#f5f4f0', fontSize: 12, fontWeight: '700' },
  slotCardTitleActive: { color: '#ffb313' },
  slotCardSub: { color: '#a5a9b2', fontSize: 10, marginTop: 5 },
  inputLabel: { color: '#b6bac2', fontSize: 10, letterSpacing: 1, fontWeight: '600', marginBottom: 10 },
  roommateCard: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#26292e', backgroundColor: '#121417', marginVertical: 18 },
  instructionInput: { minHeight: 46, color: '#f5f4f0', fontSize: 12, backgroundColor: '#121417', borderRadius: 13, borderWidth: 1, borderColor: '#26292e', padding: 13 },
  paymentPill: { flex: 1, minHeight: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center', padding: 10, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e' },
  paymentPillSelected: { backgroundColor: '#211a07', borderColor: '#ffb313' },
  paymentPillText: { color: '#b6bac2', fontSize: 11, fontWeight: '600' },
  paymentPillTextSelected: { color: '#ffb313' },
  billBox: { padding: 14, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 14, marginTop: 18, marginBottom: 14 },
  placeOrderBtn: { backgroundColor: '#ffb313', padding: 15, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginTop: 14, minHeight: 54 },
  placeOrderBtnText: { color: '#090b0d', fontSize: 14, fontWeight: '700' },
  placeOrderBtnSub: { color: '#42320c', fontSize: 10, marginTop: 5 },

  emptySection: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderStyle: 'dashed', borderRadius: 20, padding: 15, marginBottom: 18, shadowOpacity: 0, shadowRadius: 0, elevation: 0, overflow: 'hidden' },
  compactEmptyCart: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'transparent' },
  compactEmptyTitle: { color: '#f5f4f0', fontSize: 14, fontWeight: '700' },
  compactEmptyCopy: { color: '#a5a9b2', fontSize: 12, lineHeight: 18, marginTop: 5 },
  emptyCartVector: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },

});
