import React, { useContext, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Alert, ScrollView, Image, Share } from 'react-native';
import { AppContext } from '../context/AppContext';

export default function DigitalPickupPassModal({ visible, onClose }) {
  const { activeOrderId, orders, cancelOrder } = useContext(AppContext);
  const activeOrderObj = orders.find(o => o.id === activeOrderId);

  if (!activeOrderObj) return null;

  const isCancelled = activeOrderObj.orderStatus === 'Cancelled';
  const isCompleted = activeOrderObj.orderStatus === 'Completed';
  const isAbandoned = activeOrderObj.orderStatus === 'Abandoned';
  const isReady = activeOrderObj.orderStatus === 'Ready' || activeOrderObj.orderStatus === 'Ready for Pickup';

  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!activeOrderObj || !activeOrderObj.timestamp || isCompleted || isCancelled || isAbandoned || isReady) {
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
  }, [activeOrderObj, isCompleted, isCancelled, isAbandoned, isReady]);

  const formatTimer = (sec) => {
    if (sec === null || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const orderCreatedAt = new Date(activeOrderObj?.orderPlacedAt || activeOrderObj?.timestamp || Date.now()).getTime();
  const graceSecs = activeOrderObj?.cancellationGraceSecs || 120;
  const [cancelSecondsLeft, setCancelSecondsLeft] = useState(() => {
    const elapsed = Math.floor((Date.now() - orderCreatedAt) / 1000);
    return Math.max(0, graceSecs - elapsed);
  });

  useEffect(() => {
    if (!activeOrderObj || isCompleted || isCancelled || isAbandoned || isReady) {
      setCancelSecondsLeft(0);
      return;
    }
    const updateCancelTimer = () => {
      const elapsed = Math.floor((Date.now() - orderCreatedAt) / 1000);
      setCancelSecondsLeft(Math.max(0, graceSecs - elapsed));
    };
    updateCancelTimer();
    const timerInterval = setInterval(updateCancelTimer, 1000);
    return () => clearInterval(timerInterval);
  }, [activeOrderObj, isCompleted, isCancelled, isAbandoned, isReady]);

  const canCancel = cancelSecondsLeft > 0 && !isReady && !isCompleted && !isCancelled && !isAbandoned;
  const refundAmount = activeOrderObj?.upfrontPaid !== undefined
    ? Number(activeOrderObj.upfrontPaid)
    : (activeOrderObj?.paymentMethod === 'Cash'
        ? Number(activeOrderObj.heldDepositAmount || Math.ceil((activeOrderObj.totalAmount || 0) * 0.10))
        : Number(activeOrderObj?.totalAmount || 0));

  const handleSharePass = async () => {
    try {
      await Share.share({
        title: `SkipQ Pickup Pass - Token ${activeOrderObj.tokenNumber}`,
        message: `🎫 *SkipQ Pickup Pass*\n🏪 Canteen: ${activeOrderObj.shopName}\n🔢 Token: ${activeOrderObj.tokenNumber}\n🔐 PIN: ${activeOrderObj.pickupPin}\n⏰ Timing: ${activeOrderObj.pickupSlot || 'Immediate'}\n${activeOrderObj.groupCollectorName ? `👥 Collector: ${activeOrderObj.groupCollectorName}\n` : ''}Show this to counter staff for instant food collection!`
      });
    } catch (err) {
      console.log('Share pass note:', err);
    }
  };

  const handleCancelOrder = async () => {
    if (!canCancel) {
      Alert.alert(
        'Cancellation Window Closed',
        'Food preparation is underway at the canteen. To avoid food waste, orders cannot be cancelled after the 2-minute grace period.'
      );
      return;
    }

    Alert.alert(
      'Cancel Order & Refund',
      `Cancel this order? ₹${refundAmount} will be immediately refunded back to your ${activeOrderObj.paymentMethod || 'UPI'} account.`,
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: `Yes, Cancel & Refund ₹${refundAmount}`,
          style: 'destructive',
          onPress: async () => {
            const refundMsg = await cancelOrder(activeOrderObj.id, 'buyer');
            Alert.alert(
              '🎉 100% UPI Refund Initiated',
              `${refundMsg || `₹${refundAmount} refunded to your account.`}\n\nTransaction Ref: REF-${Date.now().toString().slice(-6)}`
            );
          }
        }
      ]
    );
  };

  const prepProgressPercent = Math.min(
    100,
    Math.max(
      12,
      100 -
        (secondsLeft !== null
          ? (secondsLeft / ((activeOrderObj.estimatedPrepMins || 5) * 60)) * 100
          : 50)
    )
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>SILVER OAK UNIVERSITY</Text>
              </View>
              <Text style={styles.modalTitle}>🎫 Digital Pickup Pass</Text>
              <Text style={styles.modalSub}>Instant Zero-Queue Counter Handoff</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Airline Boarding Pass Ticket Container */}
            <View
              style={[
                styles.ticketWrapper,
                isCancelled && styles.ticketCancelled,
                isCompleted && styles.ticketCompleted,
                isAbandoned && styles.ticketAbandoned,
                isReady && styles.ticketReady
              ]}
            >
              {/* TOP HALF OF TICKET */}
              <View style={styles.ticketTopHalf}>
                {/* Campus & Pass Header */}
                <View style={styles.passHeaderRow}>
                  <View>
                    <Text style={styles.passWatermark}>SOU EXPRESS PASS</Text>
                    <Text style={styles.shopName} numberOfLines={1}>
                      🏪 {activeOrderObj.shopName}
                    </Text>
                  </View>
                  <View style={styles.liveIndicator}>
                    <View
                      style={[
                        styles.liveDot,
                        {
                          backgroundColor: isReady
                            ? '#10b981'
                            : isCancelled
                            ? '#f43f5e'
                            : isCompleted
                            ? '#38bdf8'
                            : '#f59e0b'
                        }
                      ]}
                    />
                    <Text style={styles.liveText}>
                      {isReady
                        ? 'READY'
                        : isCancelled
                        ? 'CANCELLED'
                        : isCompleted
                        ? 'COLLECTED'
                        : 'COOKING'}
                    </Text>
                  </View>
                </View>

                {/* Badges: Faculty Express, Pre-Order Timing, Roommate Collector */}
                <View style={styles.passBadgesRow}>
                  {activeOrderObj.isFacultyExpress && (
                    <View style={styles.passFacultyBadge}>
                      <Text style={styles.passFacultyBadgeText}>⭐ FACULTY EXPRESS PRIORITY</Text>
                    </View>
                  )}
                  {activeOrderObj.pickupSlot && activeOrderObj.pickupSlot !== 'ASAP' && (
                    <View style={styles.passSlotBadge}>
                      <Text style={styles.passSlotBadgeText}>⏰ {activeOrderObj.pickupSlot}</Text>
                    </View>
                  )}
                  {activeOrderObj.groupCollectorName ? (
                    <View style={styles.passCollectorBadge}>
                      <Text style={styles.passCollectorBadgeText}>👥 PICKUP BY: {activeOrderObj.groupCollectorName}</Text>
                    </View>
                  ) : null}
                </View>

                {activeOrderObj.facultyRoomNote ? (
                  <View style={styles.facultyRoomBox}>
                    <Text style={styles.facultyRoomText}>🏫 Room Delivery: {activeOrderObj.facultyRoomNote}</Text>
                  </View>
                ) : null}

                {/* Token & 4-Digit Pickup PIN Row */}
                <View style={styles.tokenPinRow}>
                  {/* Token Number Card */}
                  <View style={styles.tokenBox}>
                    <Text style={styles.tokenLabel}>TOKEN NUMBER</Text>
                    <Text style={styles.tokenNumber}>{activeOrderObj.tokenNumber}</Text>
                    <Text style={styles.tokenSub}>Display at pickup</Text>
                  </View>

                  {/* 4-Digit Counter PIN Card */}
                  {activeOrderObj.pickupPin ? (
                    <View style={styles.pinBox}>
                      <Text style={styles.pinLabel}>PICKUP PIN</Text>
                      <Text style={styles.pinNumber}>{activeOrderObj.pickupPin}</Text>
                      <Text style={styles.pinHint}>Verifies handover</Text>
                    </View>
                  ) : null}
                </View>

                {/* Live Status Pill */}
                <View
                  style={[
                    styles.statusPill,
                    isCancelled
                      ? styles.statusCancel
                      : isCompleted
                      ? styles.statusCompleted
                      : isAbandoned
                      ? styles.statusCancel
                      : isReady
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
                        : isReady
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
                      : isReady
                      ? '🎉 READY FOR PICKUP! SHOW PIN AT COUNTER'
                      : '👨‍🍳 KITCHEN PREPARING FRESHLY...'}
                  </Text>
                </View>

                {/* Live Wait Countdown Progress (Only if preparing) */}
                {!isCompleted && !isCancelled && !isAbandoned && !isReady && (
                  <View style={styles.countdownCard}>
                    <View style={styles.countdownHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.clockIcon}>⏳</Text>
                        <Text style={styles.countdownTitle}>Kitchen Prep Countdown</Text>
                      </View>
                      <Text style={styles.countdownTimer}>
                        {secondsLeft !== null && secondsLeft > 0
                          ? `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                          : 'Almost Ready!'}
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${prepProgressPercent}%` }]} />
                    </View>
                    <Text style={styles.countdownHint}>
                      ⚡ SkipQ priority queue: Walk to counter when clock hits 00:00
                    </Text>
                  </View>
                )}
              </View>

              {/* PERFORATION DIVIDER WITH NOTCHES */}
              <View style={styles.perforationContainer}>
                <View style={styles.notchLeft} />
                <View style={styles.dashedDivider} />
                <View style={styles.notchRight} />
              </View>

              {/* BOTTOM HALF (STUB) OF TICKET */}
              <View style={styles.ticketBottomHalf}>
                {/* Student Info Bar */}
                <View style={styles.metaRow}>
                  <View>
                    <Text style={styles.metaLabel}>COLLECTOR</Text>
                    <Text style={styles.metaName}>
                      {activeOrderObj.buyerName || 'Campus Student'}
                    </Text>
                    {activeOrderObj.buyerRollNo ? (
                      <Text style={styles.metaSubText}>Enr: {activeOrderObj.buyerRollNo}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.metaLabel}>AMOUNT</Text>
                    {activeOrderObj.paymentMethod === 'Cash' ? (
                      <>
                        <Text style={styles.metaAmount}>₹{refundAmount} <Text style={{ fontSize: 13, color: '#38bdf8' }}>(Token)</Text></Text>
                        <Text style={[styles.metaSubText, { color: '#fbbf24', fontWeight: '800' }]}>
                          💵 Pay ₹{activeOrderObj.dueAtCounter !== undefined ? activeOrderObj.dueAtCounter : Math.max(0, activeOrderObj.totalAmount - refundAmount)} Cash at Stall
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.metaAmount}>₹{activeOrderObj.totalAmount}</Text>
                        <Text style={[styles.metaSubText, { color: '#4ade80', fontWeight: '800' }]}>
                          ⚡ 100% Paid via {activeOrderObj.paymentMethod || 'UPI'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Items Ordered List */}
                <View style={styles.itemsBox}>
                  <Text style={styles.itemsBoxTitle}>ORDER BREAKDOWN</Text>
                  {(activeOrderObj.items || []).map((i, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemBullet}>•</Text>
                      <Text style={styles.itemLineName}>{i.name}</Text>
                      <Text style={styles.itemQtyBadge}>x{i.qty}</Text>
                      <Text style={styles.itemLinePrice}>₹{i.price * i.qty}</Text>
                    </View>
                  ))}

                  {activeOrderObj.specialInstructions ? (
                    <View style={styles.instructionsBox}>
                      <Text style={styles.instructionsLabel}>📝 Note for Kitchen:</Text>
                      <Text style={styles.instructionsText}>
                        "{activeOrderObj.specialInstructions}"
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Refund Status Banner when Cancelled */}
                {isCancelled && (
                  <View style={styles.refundBannerBox}>
                    <Text style={styles.refundBannerTitle}>💸 100% UPI REFUND INITIATED</Text>
                    <Text style={styles.refundBannerSub}>
                      ₹{refundAmount} has been refunded to your {activeOrderObj.paymentMethod || 'UPI'} account. Status: REFUND_COMPLETED_UPI
                    </Text>
                  </View>
                )}

                {/* Scannable Pickup QR Code & Barcode */}
                {!isCancelled && !isCompleted && !isAbandoned && (
                  <View style={styles.barcodeSection}>
                    <View style={styles.qrPassContainer}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(`SKIPQ-PASS:${activeOrderObj.id}:${activeOrderObj.pickupPin}`)}&bgcolor=ffffff&color=0f172a&margin=6`
                        }}
                        style={styles.qrPassImage}
                        resizeMode="contain"
                      />
                      <Text style={styles.qrPassScanHint}>📷 Scan QR at Counter for Zero-Wait Handover</Text>
                    </View>

                    <View style={styles.barcodeBox}>
                      {/* Barcode Striped Lines Simulation */}
                      <View style={styles.barcodeLinesContainer}>
                        {[16, 28, 12, 34, 20, 10, 26, 38, 14, 22, 32, 18, 25, 30, 12, 28, 20, 36, 14, 24, 30].map(
                          (w, idx) => (
                            <View
                              key={idx}
                              style={[
                                styles.barcodeStripe,
                                {
                                  width: idx % 3 === 0 ? 3 : idx % 2 === 0 ? 2 : 1,
                                  marginRight: (idx % 4) + 2
                                }
                              ]}
                            />
                          )
                        )}
                      </View>
                      <Text style={styles.serialNumber}>
                        AUTH: SOU-{activeOrderObj.id.replace('ord-', '').toUpperCase()}-PASS
                      </Text>
                    </View>
                    <Text style={styles.barcodeSub}>
                      Show this QR or quote 4-digit PIN to counter operator
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Share Pass to Roommate / Friend */}
            {!isCancelled && !isCompleted && !isAbandoned && (
              <TouchableOpacity style={styles.sharePassBtn} onPress={handleSharePass}>
                <Text style={styles.sharePassBtnText}>📤 Share Pass to Roommate / Friend</Text>
              </TouchableOpacity>
            )}

            {/* 2-Minute Cancellation Grace Countdown */}
            {!isCancelled && !isCompleted && !isAbandoned && !isReady && (
              <View style={[styles.cancelGraceBanner, canCancel ? styles.cancelGraceActive : styles.cancelGraceLocked]}>
                <Text style={[styles.cancelGraceText, canCancel ? styles.cancelGraceTextActive : styles.cancelGraceTextLocked]}>
                  {canCancel
                    ? `⏱️ Cancellation Window: ${formatTimer(cancelSecondsLeft)} left for 100% instant UPI refund`
                    : '🔒 Cancellation Closed: Food is on the prep line to avoid canteen waste.'}
                </Text>
              </View>
            )}

            {/* Cancel Action */}
            {!isCancelled && !isCompleted && !isAbandoned && (
              <TouchableOpacity
                style={[styles.cancelBtn, !canCancel && styles.cancelBtnDisabled]}
                onPress={handleCancelOrder}
                disabled={!canCancel}
                activeOpacity={0.85}
              >
                <Text style={[styles.cancelBtnText, !canCancel && styles.cancelBtnTextDisabled]}>
                  {canCancel
                    ? `🚫 Cancel Order (Instant UPI Refund: ₹${refundAmount})`
                    : '🔒 Cancellation Closed (Kitchen Preparing Food)'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Back Button */}
            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>← Back to Campus Radar</Text>
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
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    padding: 14,
  },
  modalContent: {
    backgroundColor: '#0c1222',
    borderRadius: 24,
    padding: 16,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  headerBadgeText: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
  },

  /* TICKET WRAPPER */
  ticketWrapper: {
    backgroundColor: '#11192e',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  ticketCancelled: {
    borderColor: '#f43f5e',
  },
  ticketCompleted: {
    borderColor: '#10b981',
  },
  ticketAbandoned: {
    borderColor: '#f59e0b',
  },
  ticketReady: {
    borderColor: '#10b981',
  },

  ticketTopHalf: {
    padding: 16,
    backgroundColor: '#131e38',
  },
  passHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  passWatermark: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  shopName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
    letterSpacing: -0.2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  tokenPinRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tokenBox: {
    flex: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  tokenLabel: {
    color: '#06b6d4',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  tokenNumber: {
    color: '#22d3ee',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 2,
    letterSpacing: -0.5,
  },
  tokenSub: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '700',
  },

  pinBox: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  pinLabel: {
    color: '#818cf8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pinNumber: {
    color: '#c7d2fe',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 5,
    marginVertical: 2,
  },
  pinHint: {
    color: '#a5b4fc',
    fontSize: 8,
    fontWeight: '700',
  },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  statusPrep: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  statusCompleted: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  statusCancel: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statusPrepText: { color: '#fbbf24' },
  statusReadyText: { color: '#34d399' },
  statusCompletedText: { color: '#38bdf8' },
  statusCancelText: { color: '#fb7185' },

  countdownCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  countdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  clockIcon: { fontSize: 13 },
  countdownTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  countdownTimer: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '900',
  },
  progressTrack: {
    height: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  countdownHint: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },

  /* PERFORATION DIVIDER */
  perforationContainer: {
    position: 'relative',
    height: 24,
    backgroundColor: '#11192e',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notchLeft: {
    position: 'absolute',
    left: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0c1222',
  },
  notchRight: {
    position: 'absolute',
    right: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0c1222',
  },
  dashedDivider: {
    width: '84%',
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderStyle: 'dashed',
  },

  /* TICKET BOTTOM HALF */
  ticketBottomHalf: {
    padding: 16,
    backgroundColor: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metaName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  metaSubText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  metaAmount: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },

  itemsBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  itemsBoxTitle: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemBullet: {
    color: '#6366f1',
    fontWeight: '900',
    marginRight: 6,
  },
  itemLineName: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  itemQtyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 8,
  },
  itemLinePrice: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
  },
  instructionsBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  instructionsLabel: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
  },
  instructionsText: {
    color: '#fef08a',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 1,
  },

  heldDepositPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
  },
  heldDepositText: {
    color: '#22d3ee',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },

  barcodeSection: {
    alignItems: 'center',
    marginTop: 4,
  },
  barcodeBox: {
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
  },
  barcodeLinesContainer: {
    flexDirection: 'row',
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeStripe: {
    height: '100%',
    backgroundColor: '#000000',
  },
  serialNumber: {
    color: '#0f172a',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 4,
  },
  barcodeSub: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },

  cancelBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelBtnDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.12)',
    borderColor: '#475569',
  },
  cancelBtnText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelBtnTextDisabled: {
    color: '#94a3b8',
  },
  cancelGraceBanner: {
    padding: 10,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelGraceActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38bdf8',
  },
  cancelGraceLocked: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: '#f59e0b',
  },
  cancelGraceText: {
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  cancelGraceTextActive: {
    color: '#38bdf8',
  },
  cancelGraceTextLocked: {
    color: '#fbbf24',
  },
  refundBannerBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  refundBannerTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'center',
  },
  refundBannerSub: {
    color: '#a7f3d0',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 15,
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  doneBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '800',
  },
  passBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  passFacultyBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  passFacultyBadgeText: {
    color: '#f3e8ff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  passSlotBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  passSlotBadgeText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '800',
  },
  passCollectorBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  passCollectorBadgeText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  facultyRoomBox: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  facultyRoomText: {
    color: '#f3e8ff',
    fontSize: 11,
    fontWeight: '700',
  },
  qrPassContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  qrPassImage: {
    width: 140,
    height: 140,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  qrPassScanHint: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  sharePassBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sharePassBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
});



