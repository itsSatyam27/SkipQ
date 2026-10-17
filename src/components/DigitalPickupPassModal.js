import useReducedMotion from '../hooks/useReducedMotion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { orderDate } from '../utils/orderDisplay.cjs';
import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useContext, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, Alert, ScrollView, Image, Share, Animated } from 'react-native';
import { AppContext } from '../context/AppContext';
import QRCode from 'react-native-qrcode-svg';

function PickupProgress({ percent, secondsLeft, ready }) {
  const styles = useSellerStyles(baseStyles);
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    const animation = Animated.timing(value, { toValue: percent, duration: reduced ? 0 : 850, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [percent, reduced, value]);
  const time = secondsLeft == null ? '--:--' : `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`;
  return <View style={styles.countdown}>
    <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.prepEyebrow}>{ready ? 'READY TO COLLECT' : 'KITCHEN PROGRESS'}</Text><Text style={styles.countTitle}>{ready ? 'Your food is ready' : secondsLeft === 0 ? 'Waiting for kitchen update' : 'Freshly preparing your order'}</Text></View><View style={[styles.timerBadge, ready && styles.readyStatus]}>{ready ? <InterfaceIcon name="check" size={24} color="#18824b" /> : <><Text style={styles.timer}>{time}</Text><Text style={styles.timerCaption}>estimated left</Text></>}</View></View>
    <View accessibilityRole="progressbar" accessibilityLabel={ready ? 'Order ready for pickup' : 'Estimated preparation progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }} style={styles.track}><Animated.View style={[styles.fill, ready && { backgroundColor: '#47db85' }, { width: value.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }) }]} /></View>
    <View style={styles.prepSteps}>{['Placed', 'Preparing', 'Ready'].map((label,index) => <View key={label} style={styles.prepStep}><View style={[styles.stepDot, index < 2 && styles.stepDone, index === 2 && ready && styles.stepReady]} /><Text style={[styles.stepText, ((index === 1 && !ready) || (index === 2 && ready)) && styles.stepTextActive]}>{label}</Text></View>)}</View>
    <Text style={styles.hint}>{ready ? 'Show your QR or PIN at the counter.' : 'Timing is an estimate. Collect only after the kitchen marks your order Ready.'}</Text>
  </View>;
}

export default function DigitalPickupPassModal({ visible, onClose }) {
  const styles = useSellerStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);

  const { light } = useSellerTheme();
  const { activeOrderId, orders, cancelOrder } = useContext(AppContext);
  const activeOrderObj = orders.find(o => o.id === activeOrderId);
  useEffect(() => { if (visible) scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [visible, activeOrderId]);


  const isCancelled = activeOrderObj?.orderStatus === 'Cancelled';
  const isCompleted = activeOrderObj?.orderStatus === 'Completed';
  const isAbandoned = activeOrderObj?.orderStatus === 'Abandoned';
  const isReady = activeOrderObj?.orderStatus === 'Ready' || activeOrderObj?.orderStatus === 'Ready for Pickup';

  const [secondsLeft, setSecondsLeft] = useState(null);

  useEffect(() => {
    if (!activeOrderObj || isCompleted || isCancelled || isAbandoned || isReady) {
      setSecondsLeft(0);
      return;
    }

    const prepMins = activeOrderObj.estimatedPrepMins ?? 5;
    const targetMs = (orderDate(activeOrderObj)?.getTime() || Date.now()) + prepMins * 60 * 1000;

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

  const canCancel = Boolean(activeOrderObj) && !isCompleted && !isCancelled && !isAbandoned;
  const refundAmount = Number(activeOrderObj?.refundAmount || 0);

  const handleSharePass = async () => {
    try {
      await Share.share({
        title: `SkipQ Pickup Pass - Token ${activeOrderObj.tokenNumber}`,
        message: ` *SkipQ Pickup Pass*\n Canteen: ${activeOrderObj.shopName}\n Token: ${activeOrderObj.tokenNumber}\n PIN: ${activeOrderObj.pickupPin}\n⏰ Timing: ${activeOrderObj.pickupSlot || 'Immediate'}\n${activeOrderObj.groupCollectorName ? ` Collector: ${activeOrderObj.groupCollectorName}\n` : ''}Show this to counter staff for instant food collection!`
      });
    } catch (err) {
      console.log('Share pass note:', err);
    }
  };

  const handleCancelOrder = () => {
    if (!canCancel) return;
    Alert.alert('Cancel order?', 'UPI refunds must be arranged directly with the canteen. SkipQ does not transfer refunds.', [
      { text: 'Keep order', style: 'cancel' },
      { text: 'Cancel order', style: 'destructive', onPress: async () => {
        try { const message = await cancelOrder(activeOrderObj.id); Alert.alert('Order cancelled', message); }
        catch (error) { Alert.alert('Could not cancel', error.message); }
      } }
    ]);
  };

  if (!activeOrderObj) return null;

  // Estimated time must never imply actual readiness; only the seller can do that.
  const prepProgressPercent = isReady ? 100 : secondsLeft == null ? 0 : Math.min(95, Math.max(0, 100 - secondsLeft / ((activeOrderObj.estimatedPrepMins ?? 5) * 60 || 1) * 100));

  const closed = isCancelled || isCompleted || isAbandoned;
  const status = isCancelled ? 'Cancelled' : isCompleted ? 'Collected' : isAbandoned ? 'Unclaimed' : isReady ? 'Ready' : 'Cooking';
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.sheet, { paddingTop: Math.max(14, insets.top), paddingBottom: Math.max(12, insets.bottom) }]}>
      <View style={styles.handle} />
      <View style={styles.headingRow}><Text style={styles.campusBadge}>SILVER OAK UNIVERSITY</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close pickup pass" onPress={onClose} style={styles.close}><InterfaceIcon name="close" size={19} color={light ? '#172333' : '#f5f4f0'} /></TouchableOpacity></View>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Digital pickup pass</Text><Text style={styles.subtitle}>Show your QR or PIN at the counter.</Text>
        <View style={styles.ticket}>
          <View style={styles.ticketHeading}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>{activeOrderObj.isFacultyExpress ? 'FACULTY EXPRESS PASS' : 'CAMPUS PICKUP PASS'}</Text><Text style={styles.shop}>{activeOrderObj.shopName}</Text></View><Text style={[styles.status, isReady && styles.readyStatus]}>{status}</Text></View>
          {!closed && <PickupProgress percent={prepProgressPercent} secondsLeft={secondsLeft} ready={isReady} />}
          {!closed && <>
            {activeOrderObj.pickupPin ? <View style={styles.qr}><View style={styles.qrWhite}><QRCode value={`SKIPQ-PASS:${activeOrderObj.id}:${activeOrderObj.pickupPin}`} size={164} quietZone={8} color="#090b0d" backgroundColor="#ffffff" /></View><Text style={styles.scanHint}>Scan QR at the counter for pickup</Text></View> : <Text style={styles.hint}>Your pickup PIN is loading. Reopen the pass if it does not appear.</Text>}
            {!!activeOrderObj.pickupPin && <><Text style={styles.centerLabel}>PICKUP PIN - VERIFIES HANDOVER</Text><View style={styles.pinRow}>{String(activeOrderObj.pickupPin).split('').map((digit, index) => <Text key={index} style={styles.pinDigit}>{digit}</Text>)}</View></>}
          </>}
          <Text style={styles.centerLabel}>TOKEN NUMBER - DISPLAY AT PICKUP</Text><Text selectable style={styles.token}>{activeOrderObj.tokenNumber}</Text>
          <View style={styles.divider} />
          <View style={styles.row}><View style={{ flex: 1 }}><Text style={styles.label}>COLLECTOR</Text><Text style={styles.name}>{activeOrderObj.groupCollectorName || activeOrderObj.buyerName || 'Campus customer'}</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={styles.label}>AMOUNT</Text><Text style={styles.amount}>{'\u20B9'}{activeOrderObj.totalAmount}</Text></View></View>
          <Text style={styles.payment}>{isCancelled ? activeOrderObj.refundText || 'Contact the canteen about any refund.' : activeOrderObj.paymentMethod === 'Cash' ? `Pay \u20B9${activeOrderObj.dueAtCounter ?? activeOrderObj.totalAmount} cash at stall` : activeOrderObj.paymentStatus === 'CONFIRMED_BY_MERCHANT' ? 'UPI confirmed by canteen' : 'UPI awaiting canteen confirmation'}</Text>
          <View style={styles.items}><Text style={styles.label}>ORDER BREAKDOWN</Text>{(activeOrderObj.items || []).map((item,index) => <View style={styles.itemRow} key={index}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemQuantity}>x{item.qty}</Text><Text style={styles.itemPrice}>{'\u20B9'}{item.qty * item.price}</Text></View>)}</View>
          {!!activeOrderObj.specialInstructions && <Text style={styles.hint}>Kitchen note: {activeOrderObj.specialInstructions}</Text>}
          {!!activeOrderObj.facultyRoomNote && <Text style={styles.hint}>Staff room: {activeOrderObj.facultyRoomNote}</Text>}
          {!!activeOrderObj.pickupSlot && activeOrderObj.pickupSlot !== 'ASAP' && <Text style={styles.hint}>Pickup: {activeOrderObj.pickupSlot}</Text>}
          <Text style={styles.footnote}>Share the QR or quote the 4-digit PIN to the counter operator.</Text>
        </View>
        {!closed && <TouchableOpacity accessibilityRole="button" onPress={handleSharePass} style={styles.primary}><Text style={styles.primaryText}>Share pass to roommate / friend</Text></TouchableOpacity>}
        {canCancel && <><View style={styles.notice}><InterfaceIcon name="info" size={16} color="#ffb313" /><Text style={styles.noticeText}>You can cancel this active order. UPI refunds are handled by the canteen.</Text></View><TouchableOpacity accessibilityRole="button" onPress={handleCancelOrder} style={styles.cancel}><Text style={styles.cancelText}>Cancel order</Text></TouchableOpacity></>}
        <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.back}><Text style={styles.backText}>Back to Campus Radar</Text></TouchableOpacity>
      </ScrollView>
    </View></View>
  </Modal>;
}
const baseStyles = StyleSheet.create({
  prepEyebrow: { color: '#ffb313', fontSize: 8, letterSpacing: 1.1, fontWeight: '700', marginBottom: 6 },
  timerBadge: { backgroundColor: '#292418', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, alignItems: 'center', minWidth: 86 },
  timerCaption: { color: '#a5a9b2', fontSize: 8, marginTop: 3 },
  prepSteps: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7, gap: 5 },
  prepStep: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#41464f' },
  stepDone: { backgroundColor: '#ffb313' }, stepReady: { backgroundColor: '#47db85' },
  stepText: { color: '#a5a9b2', fontSize: 9 }, stepTextActive: { color: '#f5f4f0', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: '#0009', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 440, height: '96%', backgroundColor: '#090b0d', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18 },
  handle: { width: 34, height: 3, borderRadius: 2, backgroundColor: '#41464f', alignSelf: 'center', marginBottom: 10 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  campusBadge: { color: '#ffb313', backgroundColor: '#17191d', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 6, paddingBottom: 16 }, title: { color: '#f5f4f0', fontSize: 28, lineHeight: 30, fontWeight: '800', letterSpacing: -0.8 },
  subtitle: { color: '#a5a9b2', fontSize: 11, marginTop: 7, marginBottom: 17 },
  ticket: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 18, padding: 15 },
  ticketHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 }, eyebrow: { color: '#ffb313', fontSize: 8, letterSpacing: 1, fontWeight: '700' },
  shop: { color: '#f5f4f0', fontSize: 17, fontWeight: '700', marginTop: 5 },
  status: { color: '#ffb313', backgroundColor: '#292418', fontSize: 9, fontWeight: '700', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  readyStatus: { color: '#47db85', backgroundColor: '#15231c' },
  countdown: { backgroundColor: '#090b0d', borderWidth: 1, borderColor: '#26292e', borderRadius: 13, padding: 12, marginTop: 15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, countTitle: { color: '#f5f4f0', fontSize: 11, fontWeight: '600' }, timer: { color: '#ffb313', fontSize: 22, fontWeight: '700' },
  track: { height: 9, backgroundColor: '#26292e', borderRadius: 5, overflow: 'hidden', marginTop: 17, marginBottom: 12 }, fill: { height: 9, borderRadius: 5, backgroundColor: '#ffb313' },
  hint: { color: '#a5a9b2', fontSize: 10, lineHeight: 16, marginTop: 5 }, qr: { alignItems: 'center', marginTop: 18 }, qrWhite: { backgroundColor: '#ffffff', padding: 5, borderRadius: 12 }, scanHint: { color: '#ffb313', fontSize: 10, marginTop: 10 },
  centerLabel: { color: '#a5a9b2', fontSize: 8, letterSpacing: 1, textAlign: 'center', marginTop: 18 }, pinRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 10 },
  pinDigit: { color: '#f5f4f0', fontSize: 27, fontWeight: '700', width: 44, textAlign: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: '#090b0d', borderWidth: 1, borderColor: '#26292e' },
  token: { color: '#ffb313', fontSize: 16, letterSpacing: 1.5, fontWeight: '700', textAlign: 'center', marginTop: 9, padding: 11, borderRadius: 10, backgroundColor: '#17191d' },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#41464f', marginVertical: 18 },
  label: { color: '#a5a9b2', fontSize: 8, letterSpacing: 1 }, name: { color: '#f5f4f0', fontSize: 12, fontWeight: '700', marginTop: 6 }, amount: { color: '#f5f4f0', fontSize: 23, fontWeight: '700', marginTop: 5 }, payment: { color: '#ffb313', fontSize: 10, textAlign: 'right', marginTop: 7 },
  items: { padding: 12, borderRadius: 12, backgroundColor: '#090b0d', borderWidth: 1, borderColor: '#26292e', marginTop: 15 }, itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 10 }, itemName: { color: '#f5f4f0', fontSize: 12, flex: 1 }, itemQuantity: { color: '#a5a9b2', fontSize: 10 }, itemPrice: { color: '#f5f4f0', fontSize: 12, fontWeight: '600' },
  footnote: { color: '#a5a9b2', textAlign: 'center', fontSize: 9, lineHeight: 15, marginTop: 15 }, primary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#ffb313', marginTop: 14, padding: 12 }, primaryText: { color: '#090b0d', fontSize: 12, fontWeight: '700' }, notice: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', padding: 12, backgroundColor: '#17191d', borderRadius: 12, marginTop: 12 }, noticeText: { color: '#a5a9b2', flex: 1, fontSize: 10, lineHeight: 16 },
  cancel: { borderRadius: 12, borderWidth: 1, borderColor: '#57252c', padding: 13, alignItems: 'center', marginTop: 10 }, cancelText: { color: '#ff536c', fontSize: 12, fontWeight: '600' }, back: { borderRadius: 12, borderWidth: 1, borderColor: '#26292e', padding: 13, alignItems: 'center', marginTop: 10 }, backText: { color: '#f5f4f0', fontSize: 12 }
});
