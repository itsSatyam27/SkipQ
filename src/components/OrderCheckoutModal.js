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
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';

export default function OrderCheckoutModal({ visible, target, onClose, onOrderPlaced }) {
  const { placeOrder, walletBalance, cart, userProfile } = useContext(AppContext);

  const [paymentMethod, setPaymentMethod] = useState('PhonePe');
  const [specialInstructions, setInstructions] = useState('');

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
  const deposit10Percent = Math.ceil(totalAmount * 0.10);
  const isCash = paymentMethod === 'Cash';
  const isDepositAvailable = walletBalance >= deposit10Percent;

  const handleConfirmOrder = async () => {
    try {
      const orderData = {
        shopId,
        shopName,
        buyerName: userProfile?.name || 'Campus Student',
        buyerRollNo: userProfile?.rollNo || '',
        buyerPhone: userProfile?.phone || '',
        items,
        specialInstructions: specialInstructions.trim(),
        totalAmount,
        paymentMethod,
        paymentStatus: isCash ? 'PENDING_CASH' : 'PAID'
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
            {/* Student Ordering Identity */}
            <View style={styles.studentCard}>
              <Text style={styles.studentLabel}>ORDERING AS:</Text>
              <Text style={styles.studentName}>
                👤 {userProfile?.name || 'Campus Student'}{' '}
                {userProfile?.rollNo ? `• ID: ${userProfile.rollNo}` : ''}
              </Text>
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

            {/* 10% Deposit Warning for Cash */}
            {isCash && (
              <View style={[styles.depositNotice, !isDepositAvailable && styles.depositWarning]}>
                <Text style={styles.depositNoticeTitle}>
                  🔒 10% Refundable Security Deposit: ₹{deposit10Percent}
                </Text>
                <Text style={styles.depositNoticeSub}>
                  To guarantee order pickup and prevent counter food waste, ₹{deposit10Percent} is held from your SkipQ Security Wallet (Current Balance: ₹{walletBalance.toFixed(0)}). It is immediately refunded upon counter pickup!
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                isCash && !isDepositAvailable && styles.submitBtnDisabled
              ]}
              disabled={isCash && !isDepositAvailable}
              onPress={handleConfirmOrder}
            >
              <Text style={styles.submitBtnText}>
                {isCash && !isDepositAvailable
                  ? '⚠️ Top Up Wallet to Order with Cash'
                  : '🚀 Place Order & Get Digital Pass'}
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
});
