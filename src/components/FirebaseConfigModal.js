import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import {
  isFirebaseConfigured,
  currentConfig,
  saveCustomFirebaseConfig,
  clearCustomFirebaseConfig
} from '../services/firebase';

export default function FirebaseConfigModal({ visible, onClose, onConfigSaved }) {
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [authDomain, setAuthDomain] = useState(currentConfig.authDomain || '');
  const [projectId, setProjectId] = useState(currentConfig.projectId || '');
  const [storageBucket, setStorageBucket] = useState(currentConfig.storageBucket || '');
  const [messagingSenderId, setMessagingSenderId] = useState(currentConfig.messagingSenderId || '');
  const [appId, setAppId] = useState(currentConfig.appId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setApiKey(currentConfig.apiKey || '');
      setAuthDomain(currentConfig.authDomain || '');
      setProjectId(currentConfig.projectId || '');
      setStorageBucket(currentConfig.storageBucket || '');
      setMessagingSenderId(currentConfig.messagingSenderId || '');
      setAppId(currentConfig.appId || '');
    }
  }, [visible]);

  const handleSave = async () => {
    if (!apiKey.trim() || !projectId.trim()) {
      Alert.alert('Incomplete Config', 'Please enter at least your Firebase API Key and Project ID.');
      return;
    }

    setSaving(true);
    try {
      const cfg = {
        apiKey: apiKey.trim(),
        authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
        projectId: projectId.trim(),
        storageBucket: storageBucket.trim() || `${projectId.trim()}.appspot.com`,
        messagingSenderId: messagingSenderId.trim(),
        appId: appId.trim()
      };

      await saveCustomFirebaseConfig(cfg);
      Alert.alert('Firebase Connected! 🔥', `Successfully connected to project "${cfg.projectId}". Live multi-device sync is now active.`);
      if (onConfigSaved) onConfigSaved(cfg);
      onClose();
    } catch (err) {
      Alert.alert('Connection Error', err.message || 'Failed to initialize Firebase with these credentials.');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Alert.alert('Revert to Local Sandbox', 'Are you sure you want to disconnect Firebase and use local storage mode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearCustomFirebaseConfig();
          setApiKey('');
          setAuthDomain('');
          setProjectId('');
          setStorageBucket('');
          setMessagingSenderId('');
          setAppId('');
          Alert.alert('Reverted to Sandbox', 'Now using offline-first local mode.');
          if (onConfigSaved) onConfigSaved(null);
          onClose();
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🔥 Firebase Cloud Sync</Text>
              <Text style={styles.modalSub}>Real-Time Multi-Device Database</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Status Card */}
            <View style={[styles.statusCard, isFirebaseConfigured ? styles.statusConnected : styles.statusSandbox]}>
              <View style={styles.statusRow}>
                <View style={[styles.statusDot, { backgroundColor: isFirebaseConfigured ? '#10b981' : '#f59e0b' }]} />
                <Text style={[styles.statusTitle, { color: isFirebaseConfigured ? '#34d399' : '#fbbf24' }]}>
                  {isFirebaseConfigured
                    ? `Live Firestore Connected (${currentConfig.projectId})`
                    : 'Local Sandbox Mode (Offline First)'}
                </Text>
              </View>
              <Text style={styles.statusDesc}>
                {isFirebaseConfigured
                  ? 'All canteen orders, menu prices, and wait times are syncing live across all student phones & kitchen KDS screens via Google Cloud Firestore.'
                  : 'Currently storing orders in device storage. Paste your Firebase web credentials below to enable multi-device live sync.'}
              </Text>
            </View>

            {/* Config Fields */}
            <Text style={styles.sectionTitle}>FIREBASE WEB APP CREDENTIALS</Text>

            <Text style={styles.fieldLabel}>API Key *</Text>
            <TextInput
              style={styles.input}
              placeholder="AIzaSy..."
              placeholderTextColor="#64748b"
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Project ID *</Text>
            <TextInput
              style={styles.input}
              placeholder="skipq-campus-prod"
              placeholderTextColor="#64748b"
              value={projectId}
              onChangeText={setProjectId}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Auth Domain</Text>
            <TextInput
              style={styles.input}
              placeholder="skipq-campus-prod.firebaseapp.com"
              placeholderTextColor="#64748b"
              value={authDomain}
              onChangeText={setAuthDomain}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Storage Bucket</Text>
            <TextInput
              style={styles.input}
              placeholder="skipq-campus-prod.appspot.com"
              placeholderTextColor="#64748b"
              value={storageBucket}
              onChangeText={setStorageBucket}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>Messaging Sender ID</Text>
            <TextInput
              style={styles.input}
              placeholder="1029384756"
              placeholderTextColor="#64748b"
              value={messagingSenderId}
              onChangeText={setMessagingSenderId}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>App ID</Text>
            <TextInput
              style={styles.input}
              placeholder="1:1029384756:web:abcd1234"
              placeholderTextColor="#64748b"
              value={appId}
              onChangeText={setAppId}
              autoCapitalize="none"
            />

            {/* Action Buttons */}
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Connect & Save Cloud Credentials 🚀</Text>
              )}
            </TouchableOpacity>

            {isFirebaseConfigured && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearBtnText}>Disconnect & Revert to Sandbox</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
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
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#0c1222',
    borderRadius: 24,
    padding: 18,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
  },
  statusCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
  },
  statusConnected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusSandbox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  statusDesc: {
    color: '#94a3b8',
    fontSize: 10,
    lineHeight: 14,
  },
  sectionTitle: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#131e38',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  clearBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  clearBtnText: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
  },
  doneBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
});
