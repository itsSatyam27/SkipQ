import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  TouchableWithoutFeedback
} from 'react-native';
import { AppContext } from '../context/AppContext';

export default function WalletTopUpModal({
  visible,
  initialAmount = 200,
  onClose,
  onSuccess
}) {
  const { walletBalance, topUpWallet } = useContext(AppContext);

  const [amountStr, setAmountStr] = useState(String(initialAmount || 200));
  const [selectedMethod, setSelectedMethod] = useState('upi'); // 'upi' | 'card' | 'netbanking'
  const [upiApp, setUpiApp] = useState('gpay'); // 'gpay' | 'phonepe' | 'paytm' | 'id'
  const [upiIdInput, setUpiIdInput] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Sync initialAmount when modal opens
  React.useEffect(() => {
    if (visible && initialAmount) {
      setAmountStr(String(initialAmount));
    }
  }, [visible, initialAmount]);

  const numAmount = parseFloat(amountStr) || 0;

  const handlePay = async () => {
    if (numAmount <= 0 || isNaN(numAmount)) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than ₹0.');
      return;
    }

    if (selectedMethod === 'upi' && upiApp === 'id' && !upiIdInput.trim()) {
      Alert.alert('UPI ID Required', 'Please enter your UPI ID (e.g. yourname@upi).');
      return;
    }

    setIsProcessing(true);

    // Simulate payment gateway handshake (PhonePe / Razorpay / Card gateway)
    setTimeout(async () => {
      try {
        await topUpWallet(numAmount);
        setIsProcessing(false);
        onClose();

        const methodLabel =
          selectedMethod === 'upi'
            ? `UPI (${upiApp === 'gpay' ? 'Google Pay' : upiApp === 'phonepe' ? 'PhonePe' : upiApp === 'paytm' ? 'Paytm' : upiIdInput.trim()})`
            : selectedMethod === 'card'
            ? 'Debit/Credit Card'
            : 'Net Banking';

        Alert.alert(
          '🎉 Top-Up Successful!',
          `₹${numAmount} was successfully added via ${methodLabel}.\n\nNew Wallet Balance: ₹${(walletBalance + numAmount).toFixed(0)}`
        );

        if (onSuccess) onSuccess(numAmount);
      } catch (err) {
        setIsProcessing(false);
        Alert.alert('Top-Up Failed', err.message || 'Could not complete wallet payment.');
      }
    }, 1200);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.modalTitle}>💳 Top Up SkipQ Wallet</Text>
                  <Text style={styles.modalSub}>Current Balance: ₹{walletBalance.toFixed(0)}</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Amount Display & Quick Selectors */}
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>ENTER TOP-UP AMOUNT</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountStr}
                    onChangeText={val => setAmountStr(val.replace(/\D/g, ''))}
                    keyboardType="numeric"
                    maxLength={5}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                {/* Preset Chips */}
                <View style={styles.presetsRow}>
                  {[100, 200, 500, 1000].map(val => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.presetChip, numAmount === val && styles.presetChipActive]}
                      onPress={() => setAmountStr(String(val))}
                    >
                      <Text style={[styles.presetChipText, numAmount === val && styles.presetChipTextActive]}>
                        +₹{val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Payment Methods Section */}
              <Text style={styles.sectionTitle}>SELECT PAYMENT METHOD</Text>

              {/* 1. UPI Option */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'upi' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('upi')}
                activeOpacity={0.8}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.radioCircle, selectedMethod === 'upi' && styles.radioCircleActive]}>
                    {selectedMethod === 'upi' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.methodEmoji}>📱</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.methodTitleRow}>
                      <Text style={styles.methodTitle}>UPI (Instant Pay)</Text>
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedBadgeText}>RECOMMENDED</Text>
                      </View>
                    </View>
                    <Text style={styles.methodDesc}>Google Pay, PhonePe, Paytm, or any UPI app</Text>
                  </View>
                </View>

                {/* UPI Sub-Apps */}
                {selectedMethod === 'upi' && (
                  <View style={styles.upiAppsContainer}>
                    <View style={styles.upiAppsRow}>
                      {[
                        { id: 'gpay', label: 'GPay', icon: '🟢' },
                        { id: 'phonepe', label: 'PhonePe', icon: '🟣' },
                        { id: 'paytm', label: 'Paytm', icon: '🔵' },
                        { id: 'id', label: 'UPI ID', icon: '⚡' }
                      ].map(app => (
                        <TouchableOpacity
                          key={app.id}
                          style={[styles.upiAppBtn, upiApp === app.id && styles.upiAppBtnActive]}
                          onPress={() => setUpiApp(app.id)}
                        >
                          <Text style={styles.upiAppIcon}>{app.icon}</Text>
                          <Text style={[styles.upiAppText, upiApp === app.id && styles.upiAppTextActive]}>
                            {app.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {upiApp === 'id' && (
                      <TextInput
                        style={styles.upiInput}
                        placeholder="e.g. mobile@upi or username@okhdfcbank"
                        placeholderTextColor="#94a3b8"
                        value={upiIdInput}
                        onChangeText={setUpiIdInput}
                        autoCapitalize="none"
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* 2. Debit / Credit Card Option */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'card' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('card')}
                activeOpacity={0.8}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.radioCircle, selectedMethod === 'card' && styles.radioCircleActive]}>
                    {selectedMethod === 'card' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.methodEmoji}>💳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Debit / Credit Card</Text>
                    <Text style={styles.methodDesc}>Visa, MasterCard, RuPay, Maestro</Text>
                  </View>
                </View>

                {selectedMethod === 'card' && (
                  <View style={styles.cardDetailsBox}>
                    <TextInput
                      style={styles.cardField}
                      placeholder="Card Number (4xxx xxxx xxxx xxxx)"
                      placeholderTextColor="#94a3b8"
                      keyboardType="numeric"
                      maxLength={19}
                      value={cardNumber}
                      onChangeText={setCardNumber}
                    />
                    <View style={styles.cardRow}>
                      <TextInput
                        style={[styles.cardField, { flex: 1 }]}
                        placeholder="MM / YY"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={5}
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                      />
                      <TextInput
                        style={[styles.cardField, { width: 90 }]}
                        placeholder="CVV"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        maxLength={4}
                        secureTextEntry
                        value={cardCvv}
                        onChangeText={setCardCvv}
                      />
                    </View>
                  </View>
                )}
              </TouchableOpacity>

              {/* 3. Net Banking */}
              <TouchableOpacity
                style={[styles.methodCard, selectedMethod === 'netbanking' && styles.methodCardActive]}
                onPress={() => setSelectedMethod('netbanking')}
                activeOpacity={0.8}
              >
                <View style={styles.methodHeader}>
                  <View style={[styles.radioCircle, selectedMethod === 'netbanking' && styles.radioCircleActive]}>
                    {selectedMethod === 'netbanking' && <View style={styles.radioDot} />}
                  </View>
                  <Text style={styles.methodEmoji}>🏛️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>Net Banking</Text>
                    <Text style={styles.methodDesc}>SBI, HDFC, ICICI, Axis & 50+ Banks</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Pay Action Button */}
              <TouchableOpacity
                style={[styles.payBtn, (numAmount <= 0 || isProcessing) && styles.payBtnDisabled]}
                onPress={handlePay}
                disabled={numAmount <= 0 || isProcessing}
                activeOpacity={0.85}
              >
                {isProcessing ? (
                  <View style={styles.btnRow}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.payBtnText}>  Processing ₹{numAmount} Payment...</Text>
                  </View>
                ) : (
                  <Text style={styles.payBtnText}>
                    Pay ₹{numAmount} via {selectedMethod === 'upi' ? 'UPI' : selectedMethod === 'card' ? 'Card' : 'Net Banking'} ➔
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  modalSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '900',
  },
  amountBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  amountLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  currencySymbol: {
    color: '#0c52a3',
    fontSize: 28,
    fontWeight: '900',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 32,
    fontWeight: '900',
    paddingVertical: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#e6f2fb',
    borderColor: '#0c52a3',
    borderWidth: 1.5,
  },
  presetChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '800',
  },
  presetChipTextActive: {
    color: '#0c52a3',
    fontWeight: '900',
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  methodCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  methodCardActive: {
    borderColor: '#0c52a3',
    backgroundColor: '#f8fafc',
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#0c52a3',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0c52a3',
  },
  methodEmoji: {
    fontSize: 20,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  methodTitle: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
  },
  methodDesc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  recommendedBadge: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  recommendedBadgeText: {
    color: '#0f766e',
    fontSize: 8,
    fontWeight: '900',
  },
  upiAppsContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  upiAppsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  upiAppBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  upiAppBtnActive: {
    backgroundColor: '#e6f2fb',
    borderColor: '#0c52a3',
    borderWidth: 1.5,
  },
  upiAppIcon: {
    fontSize: 14,
    marginBottom: 2,
  },
  upiAppText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '800',
  },
  upiAppTextActive: {
    color: '#0c52a3',
    fontWeight: '900',
  },
  upiInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 8,
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '600',
  },
  cardDetailsBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  cardField: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 12.5,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  payBtn: {
    backgroundColor: '#0c52a3',
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  payBtnDisabled: {
    opacity: 0.5,
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  payBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
