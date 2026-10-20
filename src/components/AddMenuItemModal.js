import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import React, { useState, useContext, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Alert, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppContext } from '../context/AppContext';
import InterfaceIcon from './InterfaceIcon';
import { DISH_CATEGORIES, validateDishDraft } from '../services/dishDraft.cjs';

const initialDraft = item => ({ name: item?.name || '', category: item?.category || 'Snacks', price: item?.price != null ? String(item.price) : '', minutes: String(item?.prepTime || '5').match(/\d+/)?.[0] || '5', isVeg: item?.isVeg !== false, description: item?.description || '', image: item?.image || '' });
const PREP_TIME_OPTIONS = [{ value: '0', label: 'Ready to serve' }, { value: '5', label: '5 min' }, { value: '10', label: '10 min' }, { value: '15', label: '15 min' }];
export default function AddMenuItemModal({ visible, editItem = null, shopId, onClose }) {
  const styles = useSellerStyles(baseStyles);
  const { light } = useSellerTheme();
  const { addMenuItem, updateMenuItem, sellerShopId } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(() => initialDraft(editItem));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initialDraft(editItem)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickingImage, setPickingImage] = useState(false);
  const [prepOptionsOpen, setPrepOptionsOpen] = useState(false);
  const pending = useRef(false);
  const priceRef = useRef(null);
  useEffect(() => { if (visible) { const next = initialDraft(editItem); setDraft(next); setBaseline(JSON.stringify(next)); setError(''); setPrepOptionsOpen(false); } }, [visible, editItem]);
  const change = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setError(''); };
  const pickImage = async (source = 'gallery') => {
    if (saving || pickingImage) return;
    setPickingImage(true); setError('');
    try {
      const picker = require('expo-image-picker');
      const manipulator = require('expo-image-manipulator');
      if (source === 'camera') {
        const permission = await picker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new Error('Allow camera access in device settings to take a dish photo.');
      }
      const options = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = source === 'camera' ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      const context = manipulator.ImageManipulator.manipulate(result.assets[0].uri);
      context.resize({ width: 320 });
      const rendered = await context.renderAsync();
      const photo = await rendered.saveAsync({ format: manipulator.SaveFormat.JPEG, compress: 0.45, base64: true });
      if (!photo.base64 || photo.base64.length > 60000) throw new Error('Choose a simpler or smaller photo. The thumbnail must be under 45 KB.');
      change('image', 'data:image/jpeg;base64,' + photo.base64);
    } catch (e) { setError(/native module/i.test(e.message || '') ? 'Photo selection needs an updated development build on this device.' : e.message || 'Could not open this photo.'); }
    finally { setPickingImage(false); }
  };
  const close = () => {
    if (pending.current || pickingImage) return;
    Keyboard.dismiss();
    if (JSON.stringify(draft) === baseline) { onClose(); return; }
    Alert.alert('Discard dish changes?', 'Your unsaved dish details will be lost.', [{ text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose }]);
  };
  const save = async () => {
    if (pending.current || pickingImage) return;
    let payload;
    try { payload = validateDishDraft(draft); } catch (e) { setError(e.message); return; }
    pending.current = true; setSaving(true); setError(''); Keyboard.dismiss();
    try {
      if (editItem?.id) await updateMenuItem(shopId || sellerShopId, editItem.id, payload);
      else await addMenuItem(shopId || sellerShopId, payload);
      onClose();
      Alert.alert(editItem ? 'Dish updated' : 'Dish added', `${payload.name} is saved to your canteen menu.`);
    } catch (e) { setError(e.message || 'Could not save this dish. Your changes are still here.'); }
    finally { pending.current = false; setSaving(false); }
  };
  if (!visible) return null;
  return <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={close}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
      <View style={[styles.sheet, { marginTop: Math.max(12, insets.top), paddingBottom: Math.max(10, insets.bottom) }]}>
        <View style={styles.handle} />
        <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.eyebrow}>CANTEEN MENU</Text><Text style={styles.title}>{editItem ? 'Edit dish' : 'Add a dish'}</Text><Text style={styles.subtitle}>Set the details customers see when ordering.</Text></View><TouchableOpacity accessibilityRole="button" accessibilityLabel="Close dish editor" disabled={saving} onPress={close} style={styles.close}><InterfaceIcon name="close" size={21} /></TouchableOpacity></View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          <View style={styles.card}><Text style={styles.label}>Dish photo</Text><View style={styles.photoRow}>
            {draft.image ? <Image source={{ uri: draft.image }} style={styles.photoPreview} /> : <View style={[styles.photoPreview, { alignItems: 'center', justifyContent: 'center' }]}><InterfaceIcon name="menu" size={27} color="#ffb313" /></View>}
            <View style={{ flex: 1 }}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose dish photo" disabled={saving || pickingImage} onPress={() => pickImage('gallery')} style={styles.photoButton}>{pickingImage ? <ActivityIndicator color="#ffb313" /> : <Text style={styles.photoButtonText}>{draft.image ? 'Change photo' : 'Gallery'}</Text>}</TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Take dish photo" disabled={saving || pickingImage} onPress={() => pickImage('camera')} style={[styles.photoButton, { marginTop: 8 }]}><Text style={styles.photoButtonText}>Take photo</Text></TouchableOpacity>{!!draft.image && <TouchableOpacity accessibilityRole="button" disabled={saving || pickingImage} onPress={() => change('image', '')}><Text style={styles.removePhoto}>Remove photo</Text></TouchableOpacity>}</View>
          </View><Text style={styles.hint}>Optional. Your photo is resized before saving.</Text></View>
          <View style={styles.card}>
            <Text style={styles.label}>Dish name *</Text>
            <TextInput accessibilityLabel="Dish name" style={styles.input} placeholder="e.g. Cheese Butter Maggi, Paneer Roll" placeholderTextColor="#9aa8ba" value={draft.name} onChangeText={value => change('name', value)} maxLength={100} returnKeyType="next" onSubmitEditing={() => priceRef.current?.focus()} editable={!saving} />
            <View style={styles.row}>
              <View style={styles.column}><Text style={styles.label}>Price (INR) *</Text><TextInput ref={priceRef} accessibilityLabel="Dish price" style={styles.input} placeholder="50" placeholderTextColor="#9aa8ba" value={draft.price} onChangeText={value => change('price', value)} keyboardType="decimal-pad" maxLength={10} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} editable={!saving} /></View>
              <View style={styles.column}>
                <Text style={styles.label}>Prep time *</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Choose preparation time" accessibilityState={{ expanded: prepOptionsOpen }} disabled={saving} onPress={() => { Keyboard.dismiss(); setPrepOptionsOpen(open => !open); }} style={[styles.input, styles.prepSelector]}>
                  <Text numberOfLines={1} style={styles.prepValue}>{PREP_TIME_OPTIONS.find(option => option.value === draft.minutes)?.label || `${draft.minutes} min`}</Text>
                  <View style={[styles.prepChevron, prepOptionsOpen && styles.prepChevronOpen]}><InterfaceIcon name="chevron" size={16} color={light ? '#596579' : '#a5a9b2'} /></View>
                </TouchableOpacity>
                {prepOptionsOpen && <View style={styles.prepOptions}>{PREP_TIME_OPTIONS.map(option => {
                  const selected = draft.minutes === option.value;
                  return <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected }} disabled={saving} onPress={() => { change('minutes', option.value); setPrepOptionsOpen(false); }} style={[styles.prepOption, selected && styles.prepOptionSelected]}><Text style={[styles.prepOptionText, selected && styles.prepOptionTextSelected]}>{option.label}</Text>{selected && <InterfaceIcon name="check" size={15} color="#ffb313" />}</TouchableOpacity>;
                })}</View>}
              </View>
            </View>
            <Text style={styles.hint}>Choose an estimated wait time. Select “Ready to serve” for items already prepared.</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Dietary type</Text>
            <View style={styles.row}>{[{ value: true, label: 'Vegetarian', color: '#219478' }, { value: false, label: 'Non-veg / Egg', color: '#c85a5a' }].map(option => {
              const selected = draft.isVeg === option.value;
              return <TouchableOpacity key={option.label} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: selected }} disabled={saving} onPress={() => change('isVeg', option.value)} style={[styles.diet, selected && { borderColor: option.color, backgroundColor: light ? (option.value ? '#e6f6ec' : '#ffebef') : (option.value ? '#15231c' : '#21171a') }]}><View style={[styles.dietMark, { borderColor: option.color }]}><View style={[styles.dietDot, { backgroundColor: option.color }]} /></View><Text style={[styles.dietText, selected && { color: option.color, fontWeight: '700' }]}>{option.label}</Text>{selected && <InterfaceIcon name="check" size={17} color={option.color} />}</TouchableOpacity>;
            })}</View>
            <Text style={[styles.label, { marginTop: 22 }]}>Category</Text>
            <View style={styles.categories}>{DISH_CATEGORIES.map(category => <TouchableOpacity key={category} accessibilityRole="radio" accessibilityLabel={category} accessibilityState={{ checked: draft.category === category }} disabled={saving} onPress={() => change('category', category)} style={[styles.chip, draft.category === category && styles.chipSelected]}><Text style={[styles.chipText, draft.category === category && styles.chipTextSelected]}>{category}</Text>{draft.category === category && <InterfaceIcon name="check" size={13} color="#9b6500" />}</TouchableOpacity>)}</View>
          </View>
          <View style={styles.card}><Text style={styles.label}>Description / ingredients</Text><TextInput accessibilityLabel="Dish description" style={[styles.input, styles.description]} placeholder="Tell customers what is in this dish." placeholderTextColor="#9aa8ba" value={draft.description} onChangeText={value => change('description', value)} multiline maxLength={500} editable={!saving} /><Text style={styles.hint}>Optional. Mention key ingredients or allergens customers should know about.</Text></View>
        </ScrollView>
        <View style={styles.footer}>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : <Text style={styles.footerHint}>Changes appear in your live canteen menu after saving.</Text>}<View style={styles.row}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel dish changes" disabled={saving} onPress={close} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel={editItem ? 'Update dish' : 'Save dish to menu'} disabled={saving} onPress={save} style={[styles.save, saving && { opacity: 0.65 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{editItem ? 'Update dish' : 'Save to menu'}</Text>}</TouchableOpacity></View></View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const baseStyles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  photoPreview: { width: 76, height: 76, borderRadius: 15, backgroundColor: '#202329' },
  photoButton: { borderWidth: 1, borderColor: '#26292e', borderRadius: 12, padding: 12, alignItems: 'center' },
  photoButtonText: { color: '#f5f4f0', fontSize: 12, fontWeight: '600' },
  removePhoto: { color: '#a5a9b2', fontSize: 11, marginTop: 10, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: '#14273d80', alignItems: 'center', justifyContent: 'flex-end' },
  sheet: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: '#090b0d', borderTopLeftRadius: 25, borderTopRightRadius: 25, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 34, height: 4, borderRadius: 2, backgroundColor: '#cdd8e4', marginTop: 9 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { color: '#8496aa', fontSize: 9, fontWeight: '700', letterSpacing: 1.5 }, title: { color: '#f5f4f0', fontSize: 25, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 }, subtitle: { color: '#8596a9', fontSize: 11, lineHeight: 17, marginTop: 5 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#202329', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 }, content: { paddingHorizontal: 16, paddingBottom: 8 }, card: { backgroundColor: '#121417', padding: 17, borderRadius: 18, borderWidth: 1, borderColor: '#26292e', marginBottom: 13 },
  label: { color: '#b6bac2', fontSize: 12, fontWeight: '700', marginBottom: 12 }, input: { minHeight: 46, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#191c20', color: '#f5f4f0', borderWidth: 1, borderColor: '#26292e', borderRadius: 11, fontSize: 14 },
  row: { flexDirection: 'row', gap: 10 }, column: { flex: 1, minWidth: 0, marginTop: 18 }, hint: { color: '#8b9aae', fontSize: 10, lineHeight: 16, marginTop: 9 },
  prepSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }, prepValue: { flex: 1, color: '#f5f4f0', fontSize: 13 }, prepChevron: { transform: [{ rotate: '90deg' }] }, prepChevronOpen: { transform: [{ rotate: '-90deg' }] },
  prepOptions: { marginTop: 6, backgroundColor: '#191c20', borderWidth: 1, borderColor: '#41464f', borderRadius: 12, overflow: 'hidden' }, prepOption: { minHeight: 42, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, prepOptionSelected: { backgroundColor: '#292418' }, prepOptionText: { color: '#e5e6e8', fontSize: 12 }, prepOptionTextSelected: { color: '#ffb313', fontWeight: '700' },
  diet: { flex: 1, minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#26292e', borderRadius: 14, paddingHorizontal: 10 }, dietText: { color: '#e5e6e8', fontSize: 12, fontWeight: '600' }, dietMark: { width: 17, height: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', borderRadius: 4 }, dietDot: { width: 9, height: 9, borderRadius: 5 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 11, borderRadius: 22, backgroundColor: '#191c20', borderWidth: 1, borderColor: '#26292e' }, chipSelected: { backgroundColor: '#292418', borderColor: '#ffb313' }, chipText: { color: '#8191a5', fontSize: 12, fontWeight: '500' }, chipTextSelected: { color: '#ffb313', fontWeight: '700' },
  description: { minHeight: 90, textAlignVertical: 'top' }, footer: { paddingHorizontal: 18, paddingVertical: 12, backgroundColor: '#121417', borderTopWidth: 1, borderTopColor: '#26292e' }, footerHint: { color: '#8a9bb0', fontSize: 10, textAlign: 'center', marginBottom: 11 }, error: { color: '#b64040', fontSize: 12, lineHeight: 18, marginBottom: 11 }, cancel: { minHeight: 47, borderWidth: 1, borderColor: '#26292e', paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#7589a1', fontSize: 12, fontWeight: '600' }, save: { flex: 1, minHeight: 47, backgroundColor: '#ffb313', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#090b0d', fontSize: 13, fontWeight: '700' }
});
