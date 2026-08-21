import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';

export default function ActiveOrderFloatingBanner({ activeOrder, onOpenPassModal }) {
  const [pulseAnim] = useState(new Animated.Value(1));
  const [timeLeftSec, setTimeLeftSec] = useState(0);

  useEffect(() => {
    if (!activeOrder) return;

    // Calculate remaining prep time
    const prepMinutes = activeOrder.estimatedMinutes || 12;
    const createdAt = new Date(activeOrder.createdAt || activeOrder.orderTime || Date.now()).getTime();
    const targetTime = createdAt + prepMinutes * 60 * 1000;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setTimeLeftSec(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeOrder]);

  // Pulse animation when status is "Ready for Pickup"
  useEffect(() => {
    if (activeOrder?.orderStatus === 'Ready for Pickup' || activeOrder?.orderStatus === 'Ready') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeOrder?.orderStatus]);

  if (!activeOrder || activeOrder.orderStatus === 'Completed' || activeOrder.orderStatus === 'Cancelled') {
    return null;
  }

  const isReady = activeOrder.orderStatus === 'Ready for Pickup' || activeOrder.orderStatus === 'Ready';
  const isInPrep = activeOrder.orderStatus === 'In-Prep' || activeOrder.orderStatus === 'In Prep';

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Progress Bar Width percentage
  const progressPercent = isReady ? 100 : isInPrep ? 60 : 25;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <TouchableOpacity activeOpacity={0.9} style={styles.card} onPress={onOpenPassModal}>
        {/* Top Section */}
        <View style={styles.headerRow}>
          <View style={styles.leftInfo}>
            <View style={styles.tokenBadge}>
              <Text style={styles.tokenText}>{activeOrder.tokenNumber || activeOrder.tokenNo || 'SQ-Pass'}</Text>
            </View>
            <View style={styles.nameBlock}>
              <Text style={styles.canteenName} numberOfLines={1}>
                {activeOrder.canteenName || activeOrder.shopName || 'Campus Canteen'}
              </Text>
              <Text style={styles.itemSummary} numberOfLines={1}>
                {(activeOrder.items || []).map(i => `${i.qty || 1}x ${i.title || i.name}`).join(', ') || 'Your Food Order'}
              </Text>
            </View>
          </View>

          <View style={styles.rightAction}>
            {isReady ? (
              <View style={styles.readyPill}>
                <Text style={styles.readyPillText}>🔔 READY</Text>
              </View>
            ) : (
              <View style={styles.timerPill}>
                <Text style={styles.timerIcon}>⏱️</Text>
                <Text style={styles.timerText}>{formatTime(timeLeftSec)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Dynamic Progress Bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: isReady ? '#10b981' : isInPrep ? '#6366f1' : '#f59e0b'
              }
            ]}
          />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepsRow}>
          <Text style={[styles.stepText, { color: '#94a3b8' }]}>Placed</Text>
          <Text style={[styles.stepText, isInPrep && { color: '#818cf8', fontWeight: '800' }]}>
            👨‍🍳 Kitchen Prepping
          </Text>
          <Text style={[styles.stepText, isReady && { color: '#10b981', fontWeight: '900' }]}>
            🎫 Ready for Pickup
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 14,
    marginBottom: 8,
    zIndex: 99,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.35)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tokenBadge: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  tokenText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  nameBlock: {
    flex: 1,
  },
  canteenName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
  },
  itemSummary: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  rightAction: {
    alignItems: 'flex-end',
  },
  readyPill: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#10b981',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 4,
  },
  readyPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerIcon: {
    fontSize: 11,
    marginRight: 4,
  },
  timerText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '600',
  },
});
