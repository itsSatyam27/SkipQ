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
import { playOrderPlacedSound } from '../utils/audio';

const BREAK_SLOTS = [
  { id: 'ASAP', label: '⚡ ASAP', sub: 'Cook Now' },
  { id: '11:15 AM - Morning Recess', label: '🔔 11:15 AM', sub: 'Recess Break' },
  { id: '01:10 PM - Lunch Break', label: '🍱 01:10 PM', sub: 'Lunch Break' },
  { id: '03:45 PM - Evening Break', label: '☕ 03:45 PM', sub: 'Evening Tea' },
];

export default function StudentCartScreen({ onNavigateToExplore, onOpenPassModal, onOrderPlaced }) {
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
    reorderItems,
    rateOrder,
    rushModeActive
  } = useContext(AppContext);

  const scrollViewRef = useRef(null);

  // Cart & Checkout state
  const [paymentMethod, setPaymentMethod] = useState('PhonePe');
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
  const deposit10Percent = Math.max(5, Math.ceil(totalAmount * 0.1));
  const isCash = paymentMethod === 'Cash';
  const upfrontPayable = isCash ? deposit10Percent : totalAmount;
  const dueAtCounter = isCash ? Math.max(0, totalAmount - deposit10Percent) : 0;

  // Past orders (all orders except current active preparing one if any)
  const pastOrders = (orders || []).filter(o => o.id !== activeOrderId || !hasActivePass);

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

    setIsSubmitting(true);
    try {
      const isFaculty = userProfile?.userType === 'faculty';
      const orderData = {
        shopId: cart.shopId,
        shopName: cart.shopName,
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

      // Direct UPI deep-linking trigger if on mobile
      const matchedShop = (canteens || []).find(c => c.id === cart.shopId) || {};
      const shopUpiId = matchedShop.upiId || 'skipq.canteen@upi';
      const upiUri = `upi://pay?pa=${shopUpiId}&pn=${encodeURIComponent(cart.shopName)}&am=${upfrontPayable}&cu=INR&tn=${encodeURIComponent(isCash ? 'SkipQ 10% Preorder Token' : 'SkipQ Order')}`;

      if (Platform.OS !== 'web') {
        Linking.openURL(upiUri).catch(() => {});
      }

      await placeOrder(orderData);
      try {
        await playOrderPlacedSound();
      } catch (e) {}

      if (onOrderPlaced) {
        onOrderPlaced();
      }

      Alert.alert(
        isCash ? '🎉 Pre-order Token Confirmed!' : '🎉 100% Online Order Placed!',
        isCash
          ? `10% commitment token (₹${deposit10Percent}) submitted. Please pay remaining ₹${dueAtCounter} in cash at ${cart.shopName} counter.\n\n⏱️ You have 2 minutes to cancel for an instant UPI refund if needed.`
          : `Your payment of ₹${totalAmount} via ${paymentMethod} has been sent to ${cart.shopName}. Digital pickup pass is generated below!\n\n⏱️ Free cancellation with 100% instant UPI refund available within 2 minutes.`,
        [{ text: 'View Token Pass' }]
      );
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

  const handleSubmitRating = () => {
    if (ratingTargetOrder) {
      rateOrder(ratingTargetOrder.id, ratingStars, reviewComment);
      setRatingTargetOrder(null);
      setReviewComment('');
      Alert.alert('Thank You!', 'Your rating has been saved for this canteen.');
    }
  };

  const paymentApps = [
    { id: 'PhonePe', label: '💜 PhonePe' },
    { id: 'GPay', label: '💙 GPay' },
    { id: 'Paytm', label: '🟦 Paytm / UPI' },
    { id: 'Cash', label: '💵 Pay at Stall' }
  ];

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
          <Text style={styles.toastNoticeText}>✅ {reorderSuccessNotice}</Text>
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
            <Text style={styles.headerTitle}>Cart & Orders</Text>
            <Text style={styles.headerSub}>Items ready to buy, live pickup pass & past orders</Text>
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
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}>🛒</Text>
              <Text style={styles.sectionTitle}>Items to Buy</Text>
            </View>
            {cartTotalItems > 0 && (
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>{cartTotalItems} {cartTotalItems === 1 ? 'item' : 'items'}</Text>
              </View>
            )}
          </View>

          {cartTotalItems > 0 ? (
            <View style={styles.cartContentBox}>
              {/* Stall Name Tag */}
              <View style={styles.stallBanner}>
                <Text style={styles.stallBannerText}>🏪 {cart.shopName || 'Campus Food Stall'}</Text>
                <Text style={styles.stallCampusTag}>Silver Oak University</Text>
              </View>

              {/* Items List */}
              <View style={styles.itemsListContainer}>
                {cartItems.map((item, idx) => (
                  <View key={item.id || idx} style={styles.cartItemRow}>
                    <View style={styles.cartItemLeft}>
                      <View style={styles.vegIndicator}>
                        <View style={[styles.vegDot, { backgroundColor: item.veg !== false ? '#10b981' : '#ef4444' }]} />
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
                  <Text style={styles.cartRushTitle}>🔥 KITCHEN HIGH RUSH ACTIVE</Text>
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
                    <Text style={styles.roommateTitle}>👥 Roommate / Group Pickup</Text>
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
                      💵 10% UPI Token Pre-order + 90% Cash at Stall
                    </Text>
                    <Text style={styles.cashNoticeSub}>
                      Pay only ₹{deposit10Percent} now via UPI to confirm kitchen prep. Pay remaining ₹{dueAtCounter} in cash at the canteen counter. ⏱️ 100% refundable if cancelled within 2 minutes.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.onlineNoticeBox}>
                    <Text style={styles.onlineNoticeTitle}>
                      ⚡ 100% Online UPI Payment ({paymentMethod})
                    </Text>
                    <Text style={styles.onlineNoticeSub}>
                      Pay ₹{totalAmount} upfront with zero counter cash hassle. ⏱️ Free cancellation with 100% instant UPI refund within 2 minutes.
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
                      <Text style={[styles.billLabel, { color: '#0284c7', fontWeight: '800' }]}>⚡ Pay Now via UPI (10% Token)</Text>
                      <Text style={[styles.billValue, { color: '#0284c7', fontWeight: '800' }]}>₹{deposit10Percent}</Text>
                    </View>
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { color: '#b45309', fontWeight: '800' }]}>💵 Pay at Counter (Cash)</Text>
                      <Text style={[styles.billValue, { color: '#b45309', fontWeight: '800' }]}>₹{dueAtCounter}</Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.billRow, styles.billRowTotal]}>
                    <Text style={styles.billTotalLabel}>Total Payable Now (UPI)</Text>
                    <Text style={styles.billTotalValue}>₹{totalAmount}</Text>
                  </View>
                )}
              </View>

              {/* Place Order CTA */}
              <TouchableOpacity
                style={styles.placeOrderBtn}
                onPress={handlePlaceOrder}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : isCash ? (
                  <>
                    <Text style={styles.placeOrderBtnText}>💵 Pay ₹{deposit10Percent} UPI Token & Pre-order</Text>
                    <Text style={styles.placeOrderBtnSub}>Pay ₹{dueAtCounter} Cash at Stall • Instant Token</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.placeOrderBtnText}>⚡ Pay ₹{totalAmount} via {paymentMethod}</Text>
                    <Text style={styles.placeOrderBtnSub}>100% Online • Instant Digital Pickup Pass</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCartBox}>
              <Text style={styles.emptyCartIcon}>🍽️</Text>
              <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
              <Text style={styles.emptyCartSub}>
                Browse delicious dishes from college food stalls, add your favourites and skip the long queue!
              </Text>
              <TouchableOpacity
                style={styles.exploreDishesBtn}
                onPress={onNavigateToExplore}
                activeOpacity={0.85}
              >
                <Text style={styles.exploreDishesBtnText}>Browse Dishes in Explore ➔</Text>
              </TouchableOpacity>
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
                  <Text style={styles.timerText}>⏳ {formatTimer(secondsLeft)}</Text>
                </View>
              )}
            </View>

            <View style={styles.activePassBody}>
              <View>
                <Text style={styles.tokenPrefix}>CAMPUS PICKUP TOKEN</Text>
                <Text style={styles.tokenNumber}>#{activeOrderObj.tokenNumber || activeOrderObj.id}</Text>
                <Text style={styles.activePassShop}>🏪 {activeOrderObj.canteenName || activeOrderObj.shopName}</Text>
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
              <Text style={styles.viewPassBtnText}>🎫 View Full Digital Pickup Pass & Barcode ➔</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ============================================================ */}
        {/* SECTION 3: PAST ORDERS HISTORY                               */}
        {/* ============================================================ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionIcon}>📜</Text>
              <Text style={styles.sectionTitle}>Past Orders History</Text>
            </View>
            <View style={styles.badgePillSecondary}>
              <Text style={styles.badgeTextSecondary}>{pastOrders.length} past</Text>
            </View>
          </View>

          {pastOrders.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Text style={styles.emptyHistoryIcon}>🧾</Text>
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
                const orderDate = new Date(ord.createdAt || ord.timestamp || ord.orderTime || Date.now());

                return (
                  <View key={ord.id} style={styles.pastOrderCard}>
                    {/* Top Row: Shop & Status */}
                    <View style={styles.pastOrderTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pastOrderShop}>{ord.canteenName || ord.shopName || 'Campus Food Stall'}</Text>
                        <Text style={styles.pastOrderDate}>
                          {orderDate.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
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
                        <Text style={styles.pastOrderTotalLabel}>Total Paid</Text>
                        <Text style={styles.pastOrderTotalVal}>₹{ord.totalAmount}</Text>
                      </View>

                      <View style={styles.pastOrderActions}>
                        {/* Rate Button */}
                        <TouchableOpacity
                          style={styles.rateBtn}
                          onPress={() => handleOpenRating(ord)}
                        >
                          <Text style={styles.rateBtnText}>
                            {ord.rating ? `⭐ ${ord.rating}` : '⭐ Rate'}
                          </Text>
                        </TouchableOpacity>

                        {/* 1-Tap Re-order Button */}
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleReorder(ord)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.reorderBtnText}>🔄 Re-order</Text>
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
                    ★
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f4ee',
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
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastNoticeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#27221d',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerSub: {
    color: '#766d63',
    fontSize: 12,
    marginTop: 2,
  },
  clearCartBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#eee7dc',
  },
  clearCartText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#fffdf9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e8e1d7',
    padding: 16,
    marginBottom: 16,
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
    color: '#1c2521',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.15,
  },
  badgePill: {
    backgroundColor: '#10b98120',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#10b98140',
  },
  badgeText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  badgePillSecondary: {
    backgroundColor: '#e5eee8',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeTextSecondary: {
    color: '#376048',
    fontSize: 12,
    fontWeight: '600',
  },
  stallBanner: {
    backgroundColor: '#f3eee6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stallBannerText: {
    color: '#b85c38',
    fontSize: 13,
    fontWeight: '700',
  },
  stallCampusTag: {
    color: '#64748b',
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
    borderBottomColor: '#eee7dc',
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
    borderColor: '#334155',
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
    color: '#27221d',
    fontSize: 14,
    fontWeight: '700',
  },
  cartItemPrice: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3eee6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfd4c5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 12,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepperBtnText: {
    color: '#b85c38',
    fontSize: 15,
    fontWeight: '800',
  },
  stepperQtyText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
  cartItemSubtotal: {
    color: '#1c2521',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 44,
    textAlign: 'right',
  },
  instructionsContainer: {
    marginTop: 8,
    marginBottom: 14,
  },
  inputLabel: {
    color: '#65736a',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  instructionInput: {
    backgroundColor: '#f3eee6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dfd4c5',
    color: '#27221d',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f3eee6',
    borderWidth: 1,
    borderColor: '#dfd4c5',
  },
  paymentPillSelected: {
    backgroundColor: '#f8e8df',
    borderColor: '#d76b43',
  },
  paymentPillText: {
    color: '#766d63',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentPillTextSelected: {
    color: '#b85c38',
    fontWeight: '800',
  },
  cashNoticeBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#fff7e4',
    borderWidth: 1,
    borderColor: '#efd39a',
  },
  cashNoticeAlert: {
    borderColor: '#f59e0b',
    backgroundColor: '#78350f20',
  },
  cashNoticeTitle: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
  },
  cashNoticeSub: {
    color: '#766d63',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  onlineNoticeBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  onlineNoticeTitle: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800',
  },
  onlineNoticeSub: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  billBox: {
    backgroundColor: '#f3eee6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    color: '#65736a',
    fontSize: 13,
  },
  billValue: {
    color: '#1c2521',
    fontSize: 13,
    fontWeight: '600',
  },
  billRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#dfd8cb',
    paddingTop: 8,
    marginTop: 4,
  },
  billTotalLabel: {
    color: '#27221d',
    fontSize: 15,
    fontWeight: '800',
  },
  billTotalValue: {
    color: '#10b981',
    fontSize: 17,
    fontWeight: '900',
  },
  placeOrderBtn: {
    backgroundColor: '#1c2521',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#172019',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  placeOrderBtnDisabled: {
    opacity: 0.5,
  },
  placeOrderBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  placeOrderBtnSub: {
    color: '#ecfdf5',
    fontSize: 12,
    fontWeight: '600',
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
    color: '#1c2521',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyCartSub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  exploreDishesBtn: {
    backgroundColor: '#d76b43',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  exploreDishesBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  activePassCard: {
    backgroundColor: '#1c2521',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#4d8062',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#172019',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
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
    backgroundColor: '#06b6d420',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#06b6d440',
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06b6d4',
  },
  activeStatusText: {
    color: '#a8d0b4',
    fontSize: 11,
    fontWeight: '800',
  },
  timerPill: {
    backgroundColor: '#314238',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  timerText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800',
  },
  activePassBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tokenPrefix: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenNumber: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  activePassShop: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  pinContainer: {
    backgroundColor: '#162238',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  pinLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  pinCode: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 2,
  },
  activePassItems: {
    backgroundColor: '#26332b',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  activeItemsSummary: {
    color: '#94a3b8',
    fontSize: 12,
  },
  viewPassBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewPassBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyHistorySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  pastOrdersList: {
    gap: 12,
  },
  pastOrderCard: {
    backgroundColor: '#f3eee6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e1d7',
    padding: 14,
  },
  pastOrderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  pastOrderShop: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  pastOrderDate: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  orderStatusPill: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: '#10b98120',
  },
  statusCancelled: {
    backgroundColor: '#ef444420',
  },
  statusReady: {
    backgroundColor: '#06b6d420',
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextCompleted: {
    color: '#10b981',
  },
  statusTextCancelled: {
    color: '#ef4444',
  },
  statusTextReady: {
    color: '#38bdf8',
  },
  pastOrderItemsBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
    gap: 4,
  },
  pastOrderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pastOrderItemQty: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
    width: 24,
  },
  pastOrderItemName: {
    flex: 1,
    color: '#cbd5e1',
    fontSize: 12,
  },
  pastOrderItemPrice: {
    color: '#94a3b8',
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
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  pastOrderTotalVal: {
    color: '#ffffff',
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
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  rateBtnText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
  },
  reorderBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#d76b43',
  },
  reorderBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  ratingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ratingModalContent: {
    backgroundColor: '#0d1527',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  ratingModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  ratingModalSub: {
    color: '#94a3b8',
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
    color: '#fbbf24',
  },
  starEmpty: {
    color: '#334155',
  },
  ratingInput: {
    backgroundColor: '#162238',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    fontSize: 13,
    padding: 12,
    height: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  ratingModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelRatingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
  },
  cancelRatingText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  submitRatingBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  cartRushNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  cartRushTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cartRushSub: {
    color: '#fde68a',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  cartFacultyCard: {
    backgroundColor: 'rgba(147, 51, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
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
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cartFacultyDesc: {
    color: '#e9d5ff',
    fontSize: 11,
    marginBottom: 8,
  },
  cartFacultyInput: {
    backgroundColor: '#0f172a',
    color: '#f3e8ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
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
    backgroundColor: '#162238',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#243452',
  },
  slotCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  slotCardTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  slotCardTitleActive: {
    color: '#38bdf8',
  },
  slotCardSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
  },
  roommateCard: {
    backgroundColor: '#162238',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#243452',
  },
  roommateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roommateTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  roommateSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  collectorInput: {
    backgroundColor: '#0b1120',
    color: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    marginTop: 8,
  },
});
