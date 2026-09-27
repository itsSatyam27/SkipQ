import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing
} from 'react-native';

export default function DynamicActiveBookingPill({
  visible,
  activeOrder,
  onClose,
  onOpenPassModal
}) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerBarAnim = useRef(new Animated.Value(1)).current;
  const pulseBadgeAnim = useRef(new Animated.Value(1)).current;

  const [timeLeftSec, setTimeLeftSec] = useState(0);

  // Active Countdown calculation
  useEffect(() => {
    if (!activeOrder) return;

    const prepMinutes = activeOrder.estimatedPrepMins || activeOrder.estimatedMinutes || 6;
    const createdAt = new Date(
      activeOrder.timestamp || activeOrder.createdAt || activeOrder.orderTime || Date.now()
    ).getTime();
    const targetTime = createdAt + prepMinutes * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setTimeLeftSec(remaining);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeOrder]);

  // Pulse animation for status badge
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBadgeAnim, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseBadgeAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, []);

  // Show / Hide animations and 10s auto-minimize timer
  useEffect(() => {
    let dismissTimer = null;

    if (visible) {
      // Reset timer progress bar
      timerBarAnim.setValue(1);

      // Slide and fade in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(timerBarAnim, {
          toValue: 0,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      ]).start();

      // Auto-minimize after 10 seconds of inactivity
      dismissTimer = setTimeout(() => {
        handleDismiss();
      }, 10000);
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -120,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        })
      ]).start();
    }

    return () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      })
    ]).start(() => {
      if (onClose) onClose();
    });
  };

  const handlePillPress = () => {
    handleDismiss();
    if (onOpenPassModal) {
      onOpenPassModal();
    }
  };

  if (!visible && fadeAnim._value === 0) {
    return null;
  }

  if (!activeOrder || activeOrder.orderStatus === 'Completed' || activeOrder.orderStatus === 'Cancelled') {
    return null;
  }

  const isReady = activeOrder.orderStatus === 'Ready for Pickup' || activeOrder.orderStatus === 'Ready';
  const isInPrep =
    activeOrder.orderStatus === 'Preparing' ||
    activeOrder.orderStatus === 'In-Prep' ||
    activeOrder.orderStatus === 'In Prep';

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = isReady ? 100 : isInPrep ? 65 : 25;

  return (
    <View style={styles.overlayContainer} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Full-screen touch detector to dismiss when tapping anywhere else */}
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Floating Dynamic Island Capsule Pill */}
      <Animated.View
        style={[
          styles.pillContainer,
          {
            transform: [{ translateY: slideAnim }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.92}
          style={styles.pillCard}
          onPress={handlePillPress}
        >
          {/* Top Row: Token & Live Timer & Status */}
          <View style={styles.topRow}>
            <View style={styles.tokenPill}>
              <Text style={styles.tokenPrefix}>TOKEN</Text>
              <Text style={styles.tokenText}>
                #{activeOrder.tokenNumber || activeOrder.tokenNo || activeOrder.id || 'SQ'}
              </Text>
            </View>

            <View style={styles.statusGroup}>
              {isReady ? (
                <View style={styles.readyBadge}>
                  <Animated.View
                    style={[
                      styles.statusDot,
                      { backgroundColor: '#10b981', transform: [{ scale: pulseBadgeAnim }] }
                    ]}
                  />
                  <Text style={styles.readyBadgeText}>BELL READY</Text>
                </View>
              ) : (
                <View style={styles.countdownPill}>
                  <Text style={styles.timerEmoji}>⏱️</Text>
                  <Text style={styles.timerText}>{formatTime(timeLeftSec)}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.closeChip}
                onPress={handleDismiss}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.closeChipText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Middle Row: Stall & Item summary */}
          <View style={styles.middleRow}>
            <Text style={styles.shopName} numberOfLines={1}>
              🏪 {activeOrder.canteenName || activeOrder.shopName || 'Silver Oak Canteen'}
            </Text>
            <Text style={styles.itemSummary} numberOfLines={1}>
              {(activeOrder.items || [])
                .map(i => `${i.qty || 1}x ${i.title || i.name}`)
                .join(', ') || 'Your Order'}
            </Text>

            {(activeOrder.isFacultyExpress || (activeOrder.pickupSlot && activeOrder.pickupSlot !== 'ASAP') || activeOrder.groupCollectorName) && (
              <View style={styles.badgeTagsRow}>
                {activeOrder.isFacultyExpress && (
                  <View style={styles.facultyPill}>
                    <Text style={styles.facultyPillText}>⭐ FACULTY EXPRESS</Text>
                  </View>
                )}
                {activeOrder.pickupSlot && activeOrder.pickupSlot !== 'ASAP' && (
                  <View style={styles.slotPill}>
                    <Text style={styles.slotPillText}>⏰ {activeOrder.pickupSlot}</Text>
                  </View>
                )}
                {activeOrder.groupCollectorName ? (
                  <View style={styles.collectorPill}>
                    <Text style={styles.collectorPillText}>👥 {activeOrder.groupCollectorName}</Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progressPercent}%`,
                  backgroundColor: isReady ? '#10b981' : '#6366f1',
                },
              ]}
            />
          </View>

          {/* Footer Call to Action & Auto-minimize notice */}
          <View style={styles.bottomRow}>
            <Text style={styles.ctaText}>Tap for Counter PIN & QR Code ➔</Text>
            <Text style={styles.autoDismissHint}>Auto-closes in 10s</Text>
          </View>

          {/* 10-Second Auto-dismiss Progress Indicator Line */}
          <View style={styles.timerTrack}>
            <Animated.View
              style={[
                styles.timerBar,
                {
                  width: timerBarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  pillContainer: {
    position: 'absolute',
    top: 78, // cleanly floating below header bar without overlapping
    left: 14,
    right: 14,
    zIndex: 10000,
  },
  pillCard: {
    backgroundColor: '#0c162b',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 14,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#162b4d',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38bdf860',
  },
  tokenPrefix: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10b98125',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b98150',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  readyBadgeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '900',
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timerEmoji: {
    fontSize: 11,
  },
  timerText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  closeChip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#162238',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  middleRow: {
    marginBottom: 8,
  },
  shopName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  itemSummary: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#162238',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  ctaText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  autoDismissHint: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },
  timerTrack: {
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 4,
    marginHorizontal: -14,
    marginBottom: -8,
  },
  timerBar: {
    height: '100%',
    backgroundColor: '#38bdf8',
  },
  badgeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  facultyPill: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  facultyPillText: {
    color: '#e9d5ff',
    fontSize: 9,
    fontWeight: '800',
  },
  slotPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  slotPillText: {
    color: '#e0f2fe',
    fontSize: 9,
    fontWeight: '800',
  },
  collectorPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  collectorPillText: {
    color: '#a7f3d0',
    fontSize: 9,
    fontWeight: '800',
  },
});

