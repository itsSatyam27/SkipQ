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

  let accentColor = '#0c52a3';
  let iconEmoji = '✨';
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
    iconEmoji = fullText.includes('₹') ? '💳' : '✅';
    badgeBg = '#ecfdf5';
  } else if (
    fullText.includes('error') ||
    fullText.includes('delete') ||
    fullText.includes('cancel') ||
    fullText.includes('restricted') ||
    fullText.includes('suspended') ||
    fullText.includes('fail')
  ) {
    accentColor = '#dc2626';
    iconEmoji = fullText.includes('delete') ? '🗑️' : '⚠️';
    badgeBg = '#fef2f2';
  } else if (
    fullText.includes('warning') ||
    fullText.includes('proximity') ||
    fullText.includes('notice') ||
    fullText.includes('deposit') ||
    fullText.includes('lock')
  ) {
    accentColor = '#d97706';
    iconEmoji = fullText.includes('proximity') ? '📍' : '⚡';
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
