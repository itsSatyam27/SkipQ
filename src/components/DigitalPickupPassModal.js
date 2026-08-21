import React, { useContext } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { AppContext } from '../context/AppContext';

export default function DigitalPickupPassModal({ visible, onClose }) {
  const { activeOrderId, orders, cancelOrder } = useContext(AppContext);
  const activeOrderObj = orders.find(o => o.id === activeOrderId);

  if (!activeOrderObj) return null;

  const isCancelled = activeOrderObj.orderStatus === 'Cancelled';
  const isCompleted = activeOrderObj.orderStatus === 'Completed';
  const isAbandoned = activeOrderObj.orderStatus === 'Abandoned';

  const handleCancelOrder = async () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? 100% of your amount will be refunded immediately.',
      [
        { text: 'No, keep order', style: 'cancel' },
        {
          text: 'Yes, Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const refundMsg = await cancelOrder(activeOrderObj.id, 'buyer');
            Alert.alert('Order Cancelled', `Your order has been cancelled successfully. ${refundMsg}`);
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🎫 Digital Pickup Pass</Text>
              <Text style={styles.modalSub}>Zero-Queue Counter Handoff Token</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Ticket Card Pass */}
            <View
              style={[
                styles.ticketCard,
                isCancelled && styles.ticketCancelled,
                isCompleted && styles.ticketCompleted,
                isAbandoned && styles.ticketAbandoned
              ]}
            >
              <Text style={styles.passTag}>SKIPQ DIGITAL PICKUP PASS</Text>
              <Text style={styles.shopName}>🏪 {activeOrderObj.shopName}</Text>

              {/* Token Badge */}
              <View style={styles.tokenBox}>
                <Text style={styles.tokenLabel}>TOKEN NUMBER</Text>
                <Text style={styles.tokenNumber}>{activeOrderObj.tokenNumber}</Text>
              </View>

              {/* Live Status Badge */}
              <View
                style={[
                  styles.statusPill,
                  isCancelled
                    ? styles.statusCancel
                    : isCompleted
                    ? styles.statusCompleted
                    : isAbandoned
                    ? styles.statusCancel
                    : activeOrderObj.orderStatus === 'Ready'
                    ? styles.statusReady
                    : styles.statusPrep
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    isCancelled
                      ? styles.statusCancelText
                      : isCompleted
                      ? styles.statusCompletedText
                      : isAbandoned
                      ? styles.statusCancelText
                      : activeOrderObj.orderStatus === 'Ready'
                      ? styles.statusReadyText
                      : styles.statusPrepText
                  ]}
                >
                  {isCancelled
                    ? '❌ ORDER CANCELLED & REFUNDED'
                    : isCompleted
                    ? '✅ ORDER COLLECTED & COMPLETED'
                    : isAbandoned
                    ? '🚨 ORDER MARKED UNCLAIMED'
                    : activeOrderObj.orderStatus === 'Ready'
                    ? '🎉 READY FOR PICKUP! SHOW AT COUNTER'
                    : '👨‍🍳 KITCHEN IS PREPARING YOUR FOOD...'}
                </Text>
              </View>

              {/* Student Details */}
              <View style={styles.metaBox}>
                <Text style={styles.metaText}>
                  👤 {activeOrderObj.buyerName || 'Campus Student'}{' '}
                  {activeOrderObj.buyerRollNo ? `(${activeOrderObj.buyerRollNo})` : ''}
                </Text>
                <Text style={styles.metaSub}>
                  Paid ₹{activeOrderObj.totalAmount} via {activeOrderObj.paymentMethod}
                </Text>
              </View>

              {/* Order Items Breakdown */}
              <View style={styles.itemsBox}>
                {(activeOrderObj.items || []).map((i, idx) => (
                  <Text key={idx} style={styles.itemLineText}>
                    • {i.name} x{i.qty} — ₹{i.price * i.qty}
                  </Text>
                ))}

                {activeOrderObj.specialInstructions ? (
                  <View style={styles.instructionsBox}>
                    <Text style={styles.instructionsLabel}>📝 Special Instructions:</Text>
                    <Text style={styles.instructionsText}>{activeOrderObj.specialInstructions}</Text>
                  </View>
                ) : null}
              </View>

              {/* Deposit Held Badge if Cash */}
              {activeOrderObj.heldDepositAmount > 0 && !isCancelled && !isCompleted && !isAbandoned && (
                <View style={styles.heldDepositPill}>
                  <Text style={styles.heldDepositText}>
                    🔒 ₹{activeOrderObj.heldDepositAmount} 10% Deposit Held in SkipQ Wallet (Refunded on pickup)
                  </Text>
                </View>
              )}

              {/* Barcode Simulator */}
              {!isCancelled && !isCompleted && !isAbandoned && (
                <>
                  <View style={styles.barcodeBox}>
                    <View style={styles.barcodeLines} />
                  </View>
                  <Text style={styles.barcodeSub}>Present this screen at the canteen counter</Text>
                </>
              )}
            </View>

            {/* Cancel Order Action */}
            {!isCancelled && !isCompleted && !isAbandoned && (
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelOrder}>
                <Text style={styles.cancelBtnText}>🚫 Cancel Order & Get Instant 100% Refund</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Back to Food Radar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
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
  ticketCard: {
    backgroundColor: '#131d33',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1',
    borderStyle: 'dashed',
  },
  ticketCancelled: {
    borderColor: '#f43f5e',
    opacity: 0.85,
  },
  ticketCompleted: {
    borderColor: '#10b981',
  },
  ticketAbandoned: {
    borderColor: '#f59e0b',
  },
  passTag: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shopName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  tokenBox: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  tokenLabel: {
    color: '#06b6d4',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenNumber: {
    color: '#06b6d4',
    fontSize: 32,
    fontWeight: '900',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusPrep: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  statusReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusCancel: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusPrepText: { color: '#f59e0b' },
  statusReadyText: { color: '#10b981' },
  statusCompletedText: { color: '#10b981' },
  statusCancelText: { color: '#f43f5e' },
  metaBox: {
    alignItems: 'center',
    marginBottom: 8,
  },
  metaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  metaSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  itemsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    width: '100%',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemLineText: {
    color: '#cbd5e1',
    fontSize: 12,
    paddingVertical: 2,
  },
  instructionsBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
  },
  instructionsLabel: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
  },
  instructionsText: {
    color: '#f8fafc',
    fontSize: 11,
    fontStyle: 'italic',
  },
  heldDepositPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 10,
  },
  heldDepositText: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  barcodeBox: {
    height: 32,
    width: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeLines: {
    height: 24,
    width: '90%',
    backgroundColor: '#000000',
  },
  barcodeSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 6,
  },
  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  cancelBtnText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  doneBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
});

