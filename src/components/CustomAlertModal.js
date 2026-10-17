import { useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import useReducedMotion from '../hooks/useReducedMotion';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  Easing
} from 'react-native';

export default function CustomAlertModal({ alertData, onClose }) {
  const insets = useSafeAreaInsets();
  const context = useContext(AppContext);
  const { light } = useSellerTheme();
  const dark = !light;
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const actions = alertData?.buttons || [];
  // Never expire a choice, destructive action, retry, or callback awaiting a tap.
  const isToast = !!alertData && (actions.length === 0 || (actions.length === 1 && !actions[0].onPress && !actions[0].style && /^(ok|okay|got it)$/i.test(actions[0].text || 'OK')));
  useEffect(() => {
    if (!isToast) { setDisplayed(null); return; }
    setDisplayed(alertData);
    progress.setValue(0);
    const enter = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    enter.start();
    const timer = setTimeout(() => {
      Animated.timing(progress, { toValue: 0, duration: reduced ? 0 : 200, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => { if (finished) closeRef.current(); });
    }, 3500);
    return () => { clearTimeout(timer); progress.stopAnimation(); };
  }, [alertData, isToast, reduced, progress]);
  if (!alertData) return null;

  const { title = '', message = '', buttons = [] } = alertData;

  // Determine Alert Category & Theme Colors
  const fullText = (title + ' ' + message).toLowerCase();

  let accentColor = '#0c52a3';
  let iconName = 'orders';
  let badgeBg = '#e6f2fb';

  if (
    fullText.includes('₹') ||
    fullText.includes('added') ||
    fullText.includes('success') ||
    fullText.includes('complete') ||
    fullText.includes('thank') ||
    fullText.includes('🎉')
  ) {
    accentColor = '#059669';
    iconName = 'check';
    badgeBg = '#ecfdf5';
  } else if (
    fullText.includes('error') ||
    fullText.includes('could not') ||
    fullText.includes('denied') ||
    fullText.includes('delete') ||
    fullText.includes('cancel') ||
    fullText.includes('restricted') ||
    fullText.includes('suspended') ||
    fullText.includes('fail')
  ) {
    accentColor = '#dc2626';
    iconName = 'close';
    badgeBg = '#fef2f2';
  } else if (
    fullText.includes('warning') ||
    fullText.includes('proximity') ||
    fullText.includes('notice') ||
    fullText.includes('deposit') ||
    fullText.includes('lock')
  ) {
    accentColor = '#d97706';
    iconName = 'clock';
    badgeBg = '#fef3c7';
  }

  // Normalize buttons
  const effectiveButtons =
    Array.isArray(buttons) && buttons.length > 0
      ? buttons
      : [{ text: 'OK', onPress: null }];

  const handleButtonPress = (btn) => {
    onClose();
    if (btn && typeof btn.onPress === 'function') {
      btn.onPress();
    }
  };

  const hasCancel = effectiveButtons.some(b => b.style === 'cancel');

  if (isToast) return displayed && <View style={[styles.toastHost, { top: Math.max(insets.top, 12) + 8, pointerEvents: 'box-none' }]}>
    <Animated.View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.toast, { backgroundColor: dark ? '#17191d' : '#fff', borderColor: dark ? '#34302a' : '#dce5ef', opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }] }]}>
      <View style={[styles.toastIcon, { backgroundColor: dark ? '#292418' : badgeBg }]}><InterfaceIcon name={iconName} size={21} color={dark ? '#ffb313' : accentColor} /></View>
      <View style={{ flex: 1 }}>{!!title && <Text style={[styles.toastTitle, { color: dark ? '#f5f4f0' : '#172d48' }]}>{title}</Text>}{!!message && <Text style={[styles.toastMessage, { color: dark ? '#b6bac2' : '#64748b' }]}>{message}</Text>}</View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={onClose} style={styles.toastDismiss}><InterfaceIcon name="close" size={17} color={dark ? '#b6bac2' : '#64748b'} /></TouchableOpacity>
    </Animated.View>
  </View>;

  return (
    <Modal
      visible={!!alertData}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (hasCancel) onClose();
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (hasCancel) onClose();
        }}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.dialogCard, { borderColor: `${accentColor}40` }]}>
              {/* Top Accent Glowing Icon */}
              <View style={[styles.iconHalo, { backgroundColor: badgeBg, borderColor: `${accentColor}50` }]}>
                <InterfaceIcon name={iconName} size={28} color={accentColor} />
              </View>

              {/* Title */}
              {!!title && (
                <Text style={styles.titleText}>{title}</Text>
              )}

              {/* Message */}
              {!!message && (
                <Text style={styles.messageText}>{message}</Text>
              )}

              {/* Action Buttons */}
              <View
                style={[
                  styles.buttonsContainer,
                  effectiveButtons.length > 2 && styles.buttonsStacked
                ]}
              >
                {effectiveButtons.map((btn, idx) => {
                  const isCancel = btn.style === 'cancel';
                  const isDestructive = btn.style === 'destructive';

                  let btnBg = accentColor;
                  let textColor = '#ffffff';
                  let borderWidth = 0;
                  let borderColor = 'transparent';

                  if (isCancel) {
                    btnBg = '#f1f5f9';
                    textColor = '#475569';
                    borderWidth = 1;
                    borderColor = '#e2e8f0';
                  } else if (isDestructive) {
                    btnBg = '#dc2626';
                    textColor = '#ffffff';
                  }

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.actionBtn,
                        effectiveButtons.length <= 2 && styles.actionBtnRow,
                        { backgroundColor: btnBg, borderWidth, borderColor }
                      ]}
                      onPress={() => handleButtonPress(btn)}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.actionBtnText, { color: textColor }]}>
                        {btn.text || 'OK'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  toastHost: { position: 'absolute', left: 14, right: 14, zIndex: 10000, alignItems: 'center' },
  toast: { width: '100%', maxWidth: 520, borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 12 },
  toastIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  toastMessage: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  toastDismiss: { width: 40, minHeight: 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginRight: -4 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1.5,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  iconHalo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 24,
  },
  titleText: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  messageText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
    fontWeight: '600',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonsStacked: {
    flexDirection: 'column',
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnRow: {
    flex: 1,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
