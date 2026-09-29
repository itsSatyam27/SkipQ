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
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  descInput: {
    height: 76,
    textAlignVertical: 'top',
  },
  dietaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dietaryBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  dietaryBtnVegActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#10b981',
  },
  dietaryBtnNonVegActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  dietaryText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  dietaryTextActive: {
    color: '#0f172a',
    fontWeight: '900',
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 6,
    marginTop: 2,
  },
  catChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catChipActive: {
    backgroundColor: '#0c52a3',
    borderColor: '#0c52a3',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  catChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
    marginBottom: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 14,
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#0c52a3',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
});

