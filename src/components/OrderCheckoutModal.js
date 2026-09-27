import React, { useState, useContext, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Linking,
  Switch
} from 'react-native';
import { AppContext } from '../context/AppContext';

const BREAK_SLOTS = [
  { id: 'ASAP', label: '⚡ ASAP', sub: 'Cook Now' },
  { id: '11:15 AM - Morning Recess', label: '🔔 11:15 AM', sub: 'Recess Break' },
  { id: '01:10 PM - Lunch Break', label: '🍱 01:10 PM', sub: 'Lunch Break' },
  { id: '03:45 PM - Evening Break', label: '☕ 03:45 PM', sub: 'Evening Tea' },
];

export default function OrderCheckoutModal({ visible, target, onClose, onOrderPlaced }) {
  const { placeOrder, walletBalance, cart, userProfile, canteens, rushModeActive } = useContext(AppContext);

  const [paymentMethod, setPaymentMethod] = useState('PhonePe');
  const [specialInstructions, setInstructions] = useState('');
  const [pickupSlot, setPickupSlot] = useState('ASAP');
  const [isGroupOrder, setIsGroupOrder] = useState(false);
  const [groupCollectorName, setGroupCollectorName] = useState('');
  const [facultyRoomNote, setFacultyRoomNote] = useState(userProfile?.facultyRoomNote || '');

  useEffect(() => {
    if (cart.specialInstructions) {
      setInstructions(cart.specialInstructions);
    } else {
      setInstructions('');
    }
  }, [visible, cart]);

  // Determine items and shop (either from multi-item cart or single direct target)
  const isCartCheckout = !target && cart.items && cart.items.length > 0;
  const items = isCartCheckout
    ? cart.items
    : target
    ? [{ name: target.item.name, price: target.item.price, qty: 1, id: target.item.id }]
    : [];

  const shopId = isCartCheckout ? cart.shopId : target ? target.shop.id : null;
  const shopName = isCartCheckout ? cart.shopName : target ? target.shop.name : '';

  if (!visible || items.length === 0) return null;

  const totalAmount = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const deposit10Percent = Math.max(5, Math.ceil(totalAmount * 0.10));
  const isCash = paymentMethod === 'Cash';
  const upfrontAmount = isCash ? deposit10Percent : totalAmount;
  const dueAtCounter = isCash ? Math.max(0, totalAmount - deposit10Percent) : 0;

  const currentShopObj = canteens?.find(c => c.id === shopId) || {};
  const shopUpiId = currentShopObj.upiId || 'skipq.canteen@upi';
  const upiUri = `upi://pay?pa=${shopUpiId}&pn=${encodeURIComponent(shopName)}&am=${upfrontAmount}&cu=INR&tn=${encodeURIComponent(isCash ? 'SkipQ 10% Preorder Token' : 'SkipQ Order')}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}&bgcolor=ffffff&color=0f172a&margin=8`;

  const handleConfirmOrder = async () => {
    try {
      const isFaculty = userProfile?.userType === 'faculty';
      const orderData = {
        shopId,
        shopName,
        buyerName: userProfile?.name || (isFaculty ? 'University Faculty' : 'Campus Student'),
        buyerRollNo: userProfile?.rollNo || '',
        buyerPhone: userProfile?.phone || '',
        items,
        specialInstructions: specialInstructions.trim(),
        totalAmount,
        upfrontPaid: upfrontAmount,
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

      const newOrder = await placeOrder(orderData);
      onClose();
      onOrderPlaced(newOrder);
    } catch (err) {
      Alert.alert('Order Placement Error', err.message);
    }
  };

  const paymentApps = [
    { id: 'PhonePe', label: '💜 PhonePe' },
    { id: 'GPay', label: '💙 Google Pay' },
    { id: 'Paytm', label: '🟦 Paytm / UPI' },
    { id: 'Cash', label: '💵 Pay After Takeout' }
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>⚡ Confirm Campus Order</Text>
              <Text style={styles.shopNameText}>🏪 {shopName}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* High Canteen Rush Mode Alert */}
            {rushModeActive && (
              <View style={styles.rushBanner}>
                <Text style={styles.rushBannerTitle}>🔥 HIGH CANTEEN RUSH ACTIVE</Text>
                <Text style={styles.rushBannerSub}>
                  Kitchen is experiencing surge volume. Estimated prep times have a +10m buffer.
                </Text>
              </View>
            )}

            {/* Student / Faculty Ordering Identity */}
            <View style={styles.studentCard}>
              <View style={styles.studentHeaderRow}>
                <Text style={styles.studentLabel}>
                  {userProfile?.userType === 'faculty' ? 'STAFF / FACULTY ACCOUNT' : 'STUDENT ACCOUNT'}
                </Text>
                {userProfile?.userType === 'faculty' && (
                  <View style={styles.facultyExpressBadge}>
                    <Text style={styles.facultyExpressBadgeText}>⭐ EXPRESS PRIORITY</Text>
                  </View>
                )}
              </View>
              <Text style={styles.studentName}>
                👤 {userProfile?.name || 'Campus Member'}{' '}
                {userProfile?.rollNo ? `• ID: ${userProfile.rollNo}` : ''}
              </Text>
            </View>

            {/* Faculty Room Delivery Note */}
            {userProfile?.userType === 'faculty' && (
              <View style={styles.facultyDeskBox}>
                <Text style={styles.facultyDeskLabel}>🏫 STAFF ROOM / DEPARTMENT DELIVERY (OPTIONAL)</Text>
                <TextInput
                  style={styles.facultyDeskInput}
                  placeholder="e.g. Block A, Staff Room 204 or Express Pickup"
                  placeholderTextColor="#a78bfa"
                  value={facultyRoomNote}
                  onChangeText={setFacultyRoomNote}
                />
              </View>
            )}

            {/* Pre-Order Break Slot Selector */}
            <Text style={styles.sectionLabel}>⏰ PICKUP TIMING (BREAK SLOTS)</Text>
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

            {/* Roommate / Group Order Option */}
            <View style={styles.groupOrderCard}>
              <View style={styles.groupOrderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupOrderTitle}>👥 Roommate / Group Pickup</Text>
                  <Text style={styles.groupOrderSub}>Let a friend or roommate collect this order</Text>
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
                  placeholder="Friend's Name & Room (e.g. Yash - Room 304)"
                  placeholderTextColor="#64748b"
                  value={groupCollectorName}
                  onChangeText={setGroupCollectorName}
                />
              )}
            </View>

            {/* Order Items Breakdown */}
            <Text style={styles.sectionLabel}>ORDER SUMMARY ({items.reduce((s, i) => s + i.qty, 0)} ITEMS)</Text>
            <View style={styles.itemsBox}>
              {items.map((it, idx) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemSub}>₹{it.price} each</Text>
                  </View>
                  <Text style={styles.itemQty}>x{it.qty}</Text>
                  <Text style={styles.itemPrice}>₹{it.price * it.qty}</Text>
                </View>
              ))}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Payable Amount</Text>
                <Text style={styles.totalVal}>₹{totalAmount.toFixed(0)}</Text>
              </View>
            </View>

            {/* Custom Notes / Special Instructions */}
            <Text style={styles.sectionLabel}>SPECIAL INSTRUCTIONS / CHEF NOTE</Text>
            <TextInput
              style={styles.instructionsInput}
              placeholder="e.g. Less spicy, extra sauce, pack separately..."
              placeholderTextColor="#64748b"
              value={specialInstructions}
              onChangeText={setInstructions}
            />

            {/* Payment Method Selector */}
            <Text style={styles.sectionLabel}>SELECT PAYMENT METHOD</Text>
            <View style={styles.paymentGrid}>
              {paymentApps.map(app => (
                <TouchableOpacity
                  key={app.id}
                  style={[styles.paymentBtn, paymentMethod === app.id && styles.paymentBtnActive]}
                  onPress={() => setPaymentMethod(app.id)}
                >
                  <Text
                    style={[
                      styles.paymentBtnText,
                      paymentMethod === app.id && styles.paymentBtnTextActive
                    ]}
                  >
                    {app.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live Dynamic UPI QR Box for Digital Payments & Preorder Token */}
            <View style={styles.upiQrBox}>
              <View style={styles.qrHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.qrHeaderTitle}>
                    {isCash ? '📱 Pay 10% Token via UPI' : `📱 Scan & Pay with ${paymentMethod}`}
                  </Text>
                  <Text style={styles.qrHeaderSub}>
                    {isCash
                      ? `Pay ₹${deposit10Percent} token now • Pay ₹${dueAtCounter} cash at counter`
                      : '100% online • 2-min instant UPI refund guarantee'}
                  </Text>
                </View>
                <View style={styles.liveUpiBadge}>
                  <Text style={styles.liveUpiBadgeText}>⚡ LIVE UPI</Text>
                </View>
              </View>

              <View style={styles.qrImageContainer}>
                <Image
                  source={{ uri: qrUrl }}
                  style={styles.qrCodeImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.upiMetaBox}>
                <Text style={styles.upiIdDisplay}>
                  Payee VPA: <Text style={styles.upiIdBold}>{shopUpiId}</Text>
                </Text>
                <Text style={styles.upiTotalDisplay}>
                  Payable Now: <Text style={styles.upiAmountBold}>₹{upfrontAmount}</Text>
                </Text>
              </View>

              {Platform.OS !== 'web' ? (
                <TouchableOpacity
                  style={styles.openAppBtn}
                  onPress={() => {
                    Linking.openURL(upiUri).catch(() => {
                      Alert.alert('Notice', 'Scan the QR code directly using your camera or UPI app.');
                    });
                  }}
                >
                  <Text style={styles.openAppBtnText}>
                    {isCash ? `Pay ₹${deposit10Percent} Token via UPI ↗` : `Pay ₹${totalAmount} via ${paymentMethod} ↗`}
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.webQrHint}>
                  📲 Point your phone camera or any UPI scanner at this screen to pay
                </Text>
              )}
            </View>

            {/* Cash Reminder Notice */}
            {isCash && (
              <View style={styles.depositNotice}>
                <Text style={styles.depositNoticeTitle}>
                  💵 10% UPI Token Pre-order + 90% Cash at Stall
                </Text>
                <Text style={styles.depositNoticeSub}>
                  ₹{deposit10Percent} paid via UPI reserves your queue slot and confirms hot food prep. Pay remaining ₹{dueAtCounter} cash at stall. ⏱️ 100% refundable if cancelled within 2 minutes!
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleConfirmOrder}
            >
              <Text style={styles.submitBtnText}>
                {isCash
                  ? `🚀 Pay ₹${deposit10Percent} Token & Pre-order`
                  : `🚀 Confirm ₹${totalAmount} Order & Get Pass`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  shopNameText: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  studentCard: {
    backgroundColor: '#131d33',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  studentLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  studentName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 6,
  },
  itemsBox: {
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    color: '#64748b',
    fontSize: 11,
  },
  itemQty: {
    color: '#a5b4fc',
    fontWeight: '800',
    fontSize: 12,
    marginRight: 12,
  },
  itemPrice: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  totalVal: {
    color: '#10b981',
    fontSize: 20,
    fontWeight: '900',
  },
  instructionsInput: {
    backgroundColor: '#131d33',
    color: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  paymentBtn: {
    flexBasis: '48%',
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  paymentBtnActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
  paymentBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentBtnTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  depositNotice: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: '#06b6d4',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  depositWarning: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
  },
  depositNoticeTitle: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 2,
  },
  depositNoticeSub: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 15,
  },
  submitBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  submitBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  upiQrBox: {
    backgroundColor: '#131d33',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
    alignItems: 'center',
  },
  qrHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  qrHeaderTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  qrHeaderSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  liveUpiBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveUpiBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
  },
  qrImageContainer: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 14,
    marginVertical: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  qrCodeImage: {
    width: 150,
    height: 150,
  },
  upiMetaBox: {
    backgroundColor: '#0b1120',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    alignItems: 'center',
    marginVertical: 6,
  },
  upiIdDisplay: {
    color: '#94a3b8',
    fontSize: 11,
  },
  upiIdBold: {
    color: '#06b6d4',
    fontWeight: '800',
  },
  upiTotalDisplay: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2,
  },
  upiAmountBold: {
    color: '#10b981',
    fontWeight: '900',
    fontSize: 13,
  },
  openAppBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 6,
    width: '100%',
    alignItems: 'center',
  },
  openAppBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  webQrHint: {
    color: '#64748b',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  rushBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  rushBannerTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  rushBannerSub: {
    color: '#fde68a',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  studentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  facultyExpressBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  facultyExpressBadgeText: {
    color: '#e9d5ff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  facultyDeskBox: {
    backgroundColor: 'rgba(147, 51, 234, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  facultyDeskLabel: {
    color: '#c084fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  facultyDeskInput: {
    backgroundColor: '#0f172a',
    color: '#f3e8ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.25)',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  slotCard: {
    flexBasis: '48%',
    backgroundColor: '#131d33',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  slotCardActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
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
  groupOrderCard: {
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  groupOrderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupOrderTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  groupOrderSub: {
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

