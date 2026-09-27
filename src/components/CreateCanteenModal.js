import React, { useState, useContext } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';

export default function CreateCanteenModal({ visible, onClose }) {
  const { addCanteen, userLocation, requestUserLocation } = useContext(AppContext);

  const [name, setName] = useState('');
  const [locationName, setLocationName] = useState('');
  const [openingHours, setOpeningHours] = useState('08:00 AM - 10:00 PM');
  const [upiId, setUpiId] = useState('');
  const [phone, setPhone] = useState('');
  const [tags, setTags] = useState('Snacks, Chai, Fast Food');
  const [useCurrentGps, setUseCurrentGps] = useState(true);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a Canteen Name.');
      return;
    }
    if (!locationName.trim()) {
      Alert.alert('Validation Error', 'Please specify counter or floor location.');
      return;
    }

    try {
      const parsedTags = tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      await addCanteen({
        name: name.trim(),
        location: locationName.trim(),
        openingHours: openingHours.trim(),
        upiId: upiId.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@upi`,
        phone: phone.trim() || '+91 98765 00000',
        tags: parsedTags.length > 0 ? parsedTags : ['Campus Eats'],
        lat: useCurrentGps ? (userLocation?.lat ?? 23.0917) : 23.0917,
        lng: useCurrentGps ? (userLocation?.lng ?? 72.5349) : 72.5349,
        banner: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
        menu: []
      });

      Alert.alert('🎉 Canteen Created!', `"${name}" is now registered and live on the student food radar.`);
      setName('');
      setLocationName('');
      onClose();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to create canteen.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>🏪 Register New Canteen</Text>
              <Text style={styles.modalSubtitle}>Add your live food counter to campus radar</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Canteen Name */}
            <Text style={styles.label}>Canteen / Stall Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Hostels 12-14 Night Mess, QuickBite Cafe"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />

            {/* Counter Location */}
            <Text style={styles.label}>Counter Location & Landmark *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ground Floor, Near Library Lawn, Main Gate"
              placeholderTextColor="#64748b"
              value={locationName}
              onChangeText={setLocationName}
            />

            {/* GPS Pin */}
            <View style={styles.gpsContainer}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsLabel}>📍 Canteen Coordinates</Text>
                <Text style={styles.gpsCoords}>
                  Lat: {(userLocation?.lat ?? 23.0917).toFixed(4)}, Lng: {(userLocation?.lng ?? 72.5349).toFixed(4)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.gpsBtn}
                onPress={async () => {
                  await requestUserLocation();
                  Alert.alert('GPS Locked', 'Pinned to your current physical location.');
                }}
              >
                <Text style={styles.gpsBtnText}>🎯 Recalibrate</Text>
              </TouchableOpacity>
            </View>

            {/* Operating Hours */}
            <Text style={styles.label}>Operating Hours</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 08:00 AM - 11:30 PM"
              placeholderTextColor="#64748b"
              value={openingHours}
              onChangeText={setOpeningHours}
            />

            {/* UPI ID */}
            <Text style={styles.label}>Merchant UPI ID (For Direct Payments)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. canteen.pay@okaxis"
              placeholderTextColor="#64748b"
              value={upiId}
              onChangeText={setUpiId}
              autoCapitalize="none"
            />

            {/* Phone */}
            <Text style={styles.label}>Counter Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor="#64748b"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            {/* Tags */}
            <Text style={styles.label}>Categories / Tags (comma separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Fast Food, Beverages, Rolls, Maggi"
              placeholderTextColor="#64748b"
              value={tags}
              onChangeText={setTags}
            />
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
              <Text style={styles.submitBtnText}>Launch Canteen 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
  },
  formScroll: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gpsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  gpsLabel: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '700',
  },
  gpsCoords: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  gpsBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  gpsBtnText: {
    color: '#090d16',
    fontWeight: '800',
    fontSize: 11,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
