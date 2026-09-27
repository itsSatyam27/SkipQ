import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated
} from 'react-native';

export default function CustomAlertModal({ alertData, onClose }) {
  if (!alertData) return null;

  const { title = '', message = '', buttons = [] } = alertData;

  // Determine Alert Category & Theme Colors
  const fullText = (title + ' ' + message).toLowerCase();

  let accentColor = '#38bdf8';
  let iconEmoji = '✨';
  let badgeBg = '#0c2340';

  if (
    fullText.includes('₹') ||
    fullText.includes('added') ||
    fullText.includes('success') ||
    fullText.includes('complete') ||
    fullText.includes('thank') ||
    fullText.includes('🎉')
  ) {
    accentColor = '#10b981';
    iconEmoji = fullText.includes('₹') ? '💳' : '✅';
    badgeBg = '#064e3b35';
  } else if (
    fullText.includes('error') ||
    fullText.includes('delete') ||
    fullText.includes('cancel') ||
    fullText.includes('restricted') ||
    fullText.includes('suspended') ||
    fullText.includes('fail')
  ) {
    accentColor = '#ef4444';
    iconEmoji = fullText.includes('delete') ? '🗑️' : '⚠️';
    badgeBg = '#7f1d1d35';
  } else if (
    fullText.includes('warning') ||
    fullText.includes('proximity') ||
    fullText.includes('notice') ||
    fullText.includes('deposit') ||
    fullText.includes('lock')
  ) {
    accentColor = '#f59e0b';
    iconEmoji = fullText.includes('proximity') ? '📍' : '⚡';
    badgeBg = '#78350f35';
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
            <View style={[styles.dialogCard, { borderColor: `${accentColor}50` }]}>
              {/* Top Accent Glowing Icon */}
              <View style={[styles.iconHalo, { backgroundColor: badgeBg, borderColor: `${accentColor}60` }]}>
                <Text style={styles.iconEmoji}>{iconEmoji}</Text>
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
                    btnBg = '#162238';
                    textColor = '#94a3b8';
                    borderWidth = 1;
                    borderColor = '#334155';
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0c1527',
    borderRadius: 22,
    borderWidth: 1.5,
    paddingTop: 24,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
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
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  messageText: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
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
