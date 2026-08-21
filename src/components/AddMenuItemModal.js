import React, { useState, useContext, useEffect } from 'react';
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

const CATEGORIES = ['Snacks', 'Beverages', 'Meals', 'Rolls', 'Sandwiches', 'Desserts'];

export default function AddMenuItemModal({ visible, editItem = null, onClose }) {
  const { addMenuItem, updateMenuItem, sellerShopId } = useContext(AppContext);

  const [name, setName] = useState('');
  const [category, setCategory] = useState('Snacks');
  const [price, setPrice] = useState('');
  const [prepTime, setPrepTime] = useState('5 mins');
  const [isVeg, setIsVeg] = useState(true);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (editItem) {
      setName(editItem.name || '');
      setCategory(editItem.category || 'Snacks');
      setPrice(editItem.price ? String(editItem.price) : '');
      setPrepTime(editItem.prepTime || '5 mins');
      setIsVeg(editItem.isVeg !== undefined ? editItem.isVeg : true);
      setDescription(editItem.description || '');
    } else {
      setName('');
      setCategory('Snacks');
      setPrice('');
      setPrepTime('5 mins');
      setIsVeg(true);
      setDescription('');
    }
  }, [editItem, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Please enter an item name.');
      return;
    }
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price in ₹.');
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      price: priceNum,
      prepTime: prepTime.trim() || '5 mins',
      isVeg,
      description: description.trim() || 'Freshly prepared at counter.'
    };

    if (editItem && editItem.id) {
      await updateMenuItem(sellerShopId, editItem.id, payload);
      Alert.alert('Dish Updated', `"${payload.name}" updated successfully.`);
    } else {
      await addMenuItem(sellerShopId, payload);
      Alert.alert('Dish Added', `"${payload.name}" added to your live menu.`);
    }

    onClose();
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
              <Text style={styles.modalTitle}>
                {editItem ? '✏️ Edit Menu Item' : '🍳 Add New Food Item'}
              </Text>
              <Text style={styles.modalSubtitle}>Manage live canteen stock & pricing</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Dish Name */}
            <Text style={styles.label}>Dish / Item Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Cheese Butter Maggi, Paneer Roll"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />

            {/* Veg / Non-Veg Toggle */}
            <Text style={styles.label}>Dietary Type</Text>
            <View style={styles.dietaryRow}>
              <TouchableOpacity
                style={[styles.dietaryBtn, isVeg && styles.dietaryBtnVegActive]}
                onPress={() => setIsVeg(true)}
              >
                <Text style={[styles.dietaryText, isVeg && styles.dietaryTextActive]}>🟢 100% Pure Veg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dietaryBtn, !isVeg && styles.dietaryBtnNonVegActive]}
                onPress={() => setIsVeg(false)}
              >
                <Text style={[styles.dietaryText, !isVeg && styles.dietaryTextActive]}>🔴 Non-Veg / Egg</Text>
              </TouchableOpacity>
            </View>

            {/* Category Selector */}
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Price & Prep Time */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Price (₹) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="50"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Estimated Prep Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 5 mins"
                  placeholderTextColor="#64748b"
                  value={prepTime}
                  onChangeText={setPrepTime}
                />
              </View>
            </View>

            {/* Description */}
            <Text style={styles.label}>Description / Ingredients</Text>
            <TextInput
              style={[styles.input, styles.descInput]}
              placeholder="e.g. Served hot with homemade mint & tamarind chutney..."
              placeholderTextColor="#64748b"
              multiline
              value={description}
              onChangeText={setDescription}
            />

            {/* Actions */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {editItem ? 'Update Dish 💾' : 'Save to Menu 🚀'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
    marginBottom: 14,
    paddingBottom: 10,
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
  label: {
    fontSize: 11,
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
  descInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  dietaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dietaryBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dietaryBtnVegActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
  },
  dietaryBtnNonVegActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  dietaryText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  dietaryTextActive: {
    color: '#ffffff',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  catChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  catChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  catChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
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
  saveBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});

