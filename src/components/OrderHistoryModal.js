import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';

export default function OrderHistoryModal({ visible, onClose, onReorderSuccess }) {
  const { orders, reorderItems, rateOrder } = useContext(AppContext);

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [ratingTargetOrder, setRatingTargetOrder] = useState(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'COMPLETED' | 'ACTIVE'

  if (!visible) return null;

  const filteredOrders = (orders || []).filter(ord => {
    if (filterType === 'COMPLETED') return ord.orderStatus === 'Completed';
    if (filterType === 'ACTIVE') return ord.orderStatus !== 'Completed' && ord.orderStatus !== 'Cancelled';
    return true;
  });

  const handleReorder = (orderObj) => {
    if (!orderObj || !orderObj.items || orderObj.items.length === 0) return;
    reorderItems(orderObj.id);
    onClose();
    if (onReorderSuccess) {
      onReorderSuccess(orderObj);
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
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>📜 Order History & Receipts</Text>
              <Text style={styles.subtitle}>Track past orders, invoices & quick re-order</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {['ALL', 'ACTIVE', 'COMPLETED'].map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, filterType === f && styles.filterPillActive]}
                onPress={() => setFilterType(f)}
              >
                <Text style={[styles.filterText, filterType === f && styles.filterTextActive]}>
                  {f === 'ALL' ? 'All Orders' : f === 'ACTIVE' ? '⚡ Active' : '✅ Completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Orders List */}
          <ScrollView style={styles.scrollList} contentContainerStyle={{ paddingBottom: 24 }}>
            {filteredOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>No orders found</Text>
                <Text style={styles.emptySubtitle}>Your order history will show up here.</Text>
              </View>
            ) : (
              filteredOrders.map((ord) => {
                const isCompleted = ord.orderStatus === 'Completed';
                const isReady = ord.orderStatus === 'Ready for Pickup' || ord.orderStatus === 'Ready';

                return (
                  <View key={ord.id} style={styles.orderCard}>
                    {/* Card Top */}
                    <View style={styles.cardTop}>
                      <View style={styles.canteenHeader}>
                        <Text style={styles.canteenName}>
                          {ord.canteenName || ord.shopName || 'Campus Canteen'}
                        </Text>
                        <Text style={styles.orderDate}>
                          {new Date(ord.createdAt || ord.orderTime || Date.now()).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isCompleted
                            ? styles.statusCompleted
                            : isReady
                            ? styles.statusReady
                            : styles.statusPrep
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>{ord.orderStatus || 'Pending'}</Text>
                      </View>
                    </View>

                    {/* Items preview */}
                    <View style={styles.itemsPreview}>
                      {(ord.items || []).map((it, idx) => (
                        <Text key={idx} style={styles.itemLine}>
                          • {it.qty || 1}x {it.title || it.name} (₹{(it.price || it.unitPrice || 0) * (it.qty || 1)})
                        </Text>
                      ))}
                    </View>

                    {/* Card Footer: Amount & Actions */}
                    <View style={styles.cardBottom}>
                      <View>
                        <Text style={styles.totalLabel}>Total Paid</Text>
                        <Text style={styles.totalValue}>₹{ord.totalAmount || ord.total || 0}</Text>
                      </View>

                      <View style={styles.actionButtonsRow}>
                        {/* Receipt Button */}
                        <TouchableOpacity
                          style={styles.receiptBtn}
                          onPress={() => setSelectedReceipt(ord)}
                        >
                          <Text style={styles.receiptBtnText}>🧾 Invoice</Text>
                        </TouchableOpacity>

                        {/* Star Rating Button if Completed */}
                        {isCompleted && (
                          <TouchableOpacity
                            style={styles.rateBtn}
                            onPress={() => handleOpenRating(ord)}
                          >
                            <Text style={styles.rateBtnText}>
                              {ord.rating ? `⭐ ${ord.rating}/5` : '⭐ Rate'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Re-order Button */}
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleReorder(ord)}
                        >
                          <Text style={styles.reorderBtnText}>🔁 Re-order</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Digital Invoice / Receipt Modal */}
        {selectedReceipt && (
          <Modal visible={!!selectedReceipt} animationType="fade" transparent>
            <View style={styles.receiptOverlay}>
              <View style={styles.receiptCard}>
                <View style={styles.receiptHeader}>
                  <Text style={styles.receiptBrand}>⚡ SkipQ Digital Invoice</Text>
                  <TouchableOpacity onPress={() => setSelectedReceipt(null)}>
                    <Text style={styles.receiptClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.invoiceMeta}>
                  <Text style={styles.metaText}>Token ID: <Text style={styles.bold}>{selectedReceipt.tokenNumber || selectedReceipt.tokenNo || selectedReceipt.id}</Text></Text>
                  <Text style={styles.metaText}>Canteen: <Text style={styles.bold}>{selectedReceipt.canteenName || selectedReceipt.shopName}</Text></Text>
                  <Text style={styles.metaText}>Date: <Text style={styles.bold}>{new Date(selectedReceipt.createdAt || Date.now()).toLocaleString()}</Text></Text>
                  <Text style={styles.metaText}>Verification Code: <Text style={[styles.bold, { color: '#06b6d4' }]}>{selectedReceipt.verificationCode || 'SQ-8899'}</Text></Text>
                </View>

                <View style={styles.receiptDivider} />

                <Text style={styles.sectionHeader}>Itemized Breakdown</Text>
                {(selectedReceipt.items || []).map((it, i) => (
                  <View key={i} style={styles.receiptItemRow}>
                    <Text style={styles.receiptItemName}>{it.qty || 1}x {it.title || it.name}</Text>
                    <Text style={styles.receiptItemPrice}>₹{(it.price || 0) * (it.qty || 1)}</Text>
                  </View>
                ))}

                <View style={styles.receiptDivider} />

                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptFeeLabel}>Campus Convenience Fee</Text>
                  <Text style={styles.receiptFree}>FREE (₹0)</Text>
                </View>
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptFeeLabel}>GST / Institution Taxes</Text>
                  <Text style={styles.receiptFree}>₹0.00</Text>
                </View>

                <View style={[styles.receiptItemRow, { marginTop: 10 }]}>
                  <Text style={styles.receiptGrandTotal}>Grand Total Paid</Text>
                  <Text style={styles.receiptGrandTotalAmount}>₹{selectedReceipt.totalAmount || 0}</Text>
                </View>

                <View style={styles.paidStamp}>
                  <Text style={styles.paidStampText}>✅ PAID VIA CAMPUS WALLET</Text>
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => setSelectedReceipt(null)}
                >
                  <Text style={styles.doneBtnText}>Close Invoice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}

        {/* Rating Modal */}
        {ratingTargetOrder && (
          <Modal visible={!!ratingTargetOrder} animationType="fade" transparent>
            <View style={styles.receiptOverlay}>
              <View style={styles.ratingCard}>
                <Text style={styles.ratingTitle}>Rate your Meal</Text>
                <Text style={styles.ratingSubtitle}>
                  {ratingTargetOrder.canteenName || ratingTargetOrder.shopName}
                </Text>

                {/* Stars */}
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRatingStars(star)}>
                      <Text style={[styles.starIcon, ratingStars >= star && styles.starActive]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.feedbackInput}
                  placeholder="How was the food quality and prep speed? (Optional)"
                  placeholderTextColor="#64748b"
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                />

                <View style={styles.ratingActions}>
                  <TouchableOpacity
                    style={styles.cancelRatingBtn}
                    onPress={() => setRatingTargetOrder(null)}
                  >
                    <Text style={styles.cancelRatingText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.submitRatingBtn}
                    onPress={handleSubmitRating}
                  >
                    <Text style={styles.submitRatingText}>Submit Review</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0b1120',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1e293b',
  },
  filterPillActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  scrollList: {
    maxHeight: 520,
  },
  orderCard: {
    backgroundColor: '#131d33',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  canteenHeader: {
    flex: 1,
  },
  canteenName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  orderDate: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  statusReady: {
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
  },
  statusPrep: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38bdf8',
  },
  itemsPreview: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 8,
    marginVertical: 4,
  },
  itemLine: {
    color: '#cbd5e1',
    fontSize: 12,
    marginBottom: 2,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  totalLabel: {
    color: '#64748b',
    fontSize: 10,
  },
  totalValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  receiptBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  receiptBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  rateBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rateBtnText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  reorderBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reorderBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  // Invoice overlay
  receiptOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  receiptCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  receiptBrand: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '900',
  },
  receiptClose: {
    color: '#94a3b8',
    fontSize: 18,
    fontWeight: '700',
  },
  invoiceMeta: {
    marginBottom: 12,
  },
  metaText: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 2,
  },
  bold: {
    color: '#ffffff',
    fontWeight: '800',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 10,
  },
  sectionHeader: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  receiptItemName: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  receiptItemPrice: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  receiptFeeLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  receiptFree: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  receiptGrandTotal: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  receiptGrandTotalAmount: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '900',
  },
  paidStamp: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 14,
  },
  paidStampText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  // Rating modal styles
  ratingCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  ratingTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  ratingSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  starIcon: {
    fontSize: 32,
    color: '#334155',
  },
  starActive: {
    color: '#f59e0b',
  },
  feedbackInput: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 12,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  ratingActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelRatingBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelRatingText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  submitRatingBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitRatingText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },
});
