import React, { useContext, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { getDistanceInMeters, formatDistance, MAX_ORDER_DISTANCE_METERS } from '../utils/distance';
import ActiveOrderFloatingBanner from './ActiveOrderFloatingBanner';

export default function StudentRadarView({ onSelectOrderItem, onOpenCartCheckout, onOpenPassModal, onOpenHistoryModal }) {
  const {
    canteens,
    university,
    userLocation,
    setUserLocation,
    requestUserLocation,
    banStatus,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    orders,
    activeOrderId
  } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('radar'); // 'radar' or 'shops'

  const campusCanteens = canteens.filter(c => c.universityId === university);

  // Group food items across all campus canteens
  let itemGroupMap = {};
  campusCanteens.forEach(shop => {
    const distMeters = getDistanceInMeters(userLocation.lat, userLocation.lng, shop.lat, shop.lng);
    const isWithin300m = distMeters <= MAX_ORDER_DISTANCE_METERS;

    (shop.menu || []).forEach(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        shop.name.toLowerCase().includes(q);

      const matchesCat =
        selectedCategory === 'All' ||
        (item.category && item.category.toLowerCase() === selectedCategory.toLowerCase()) ||
        item.name.toLowerCase().includes(selectedCategory.toLowerCase());

      if (matchesQuery && matchesCat) {
        const key = item.name.toLowerCase();
        if (!itemGroupMap[key]) {
          itemGroupMap[key] = {
            name: item.name,
            category: item.category || 'Snacks',
            isVeg: item.isVeg !== undefined ? item.isVeg : true,
            description: item.description,
            canteens: []
          };
        }
        itemGroupMap[key].canteens.push({
          shopId: shop.id,
          shopName: shop.name,
          shopLocation: shop.location,
          distMeters,
          isWithin300m,
          price: item.price,
          prepTime: item.prepTime,
          isAvailable: item.isAvailable,
          isVeg: item.isVeg,
          itemId: item.id,
          shopObj: shop,
          itemObj: item
        });
      }
    });
  });

  const radarItems = Object.values(itemGroupMap);
  const categories = ['All', 'Snacks', 'Beverages', 'Meals', 'Rolls', 'Sandwiches', 'Desserts'];

  // Cart Calculations
  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);
  const cartTotalPrice = (cart?.items || []).reduce((sum, it) => sum + it.price * it.qty, 0);

  const getItemCartQty = (shopId, itemId) => {
    if (cart.shopId !== shopId) return 0;
    const found = cart.items.find(i => i.id === itemId);
    return found ? found.qty : 0;
  };

  const handleAddToCart = (shopObj, itemObj, isWithin300m, distMeters) => {
    if (banStatus === 'perm_ban') {
      Alert.alert('Account Banned', 'Your account is permanently suspended due to uncollected orders.');
      return;
    }
    if (!isWithin300m) {
      Alert.alert(
        '🚫 Distance Limit Exceeded (>300m)',
        `Order blocked! You are ${formatDistance(distMeters)} away from ${shopObj.name}. SkipQ enforces a 300-meter maximum distance limit to ensure freshly prepared hot food.`
      );
      return;
    }
    addToCart(shopObj, itemObj);
  };

  return (
    <View style={styles.container}>
      {/* Hero Header Card */}
      <View style={styles.heroBanner}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>Campus Live Food Radar ⚡</Text>
            <Text style={styles.heroSub}>Find real dishes & zero-queue pickup across counters</Text>
          </View>
        </View>

        {/* GPS Control Bar */}
        <View style={styles.gpsSimulatorRow}>
          <Text style={styles.gpsLabel}>📡 GPS:</Text>
          <TouchableOpacity
            style={[styles.simBtn, userLocation.lat === 19.1334 && styles.simBtnActive]}
            onPress={() => setUserLocation({ lat: 19.1334, lng: 72.9133 })}
          >
            <Text style={styles.simBtnText}>📍 Center (30m)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.simBtn, userLocation.lat === 19.1420 && styles.simBtnActive]}
            onPress={() => setUserLocation({ lat: 19.1420, lng: 72.9250 })}
          >
            <Text style={styles.simBtnText}>🚨 Out of Range (>500m)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.gpsRecalibrateBtn}
            onPress={async () => {
              await requestUserLocation();
              Alert.alert('GPS Updated', 'Recalibrated using your phone GPS hardware.');
            }}
          >
            <Text style={styles.gpsRecalibrateText}>🎯 Phone GPS</Text>
          </TouchableOpacity>
        </View>

        {/* Search Box */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search dish, canteen, or craving..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContainer}
      >
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, selectedCategory === cat && styles.chipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
              {cat === 'All' ? '✨ All Dishes' : cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Navigation View Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'radar' && styles.tabBtnActive]}
          onPress={() => setActiveTab('radar')}
        >
          <Text style={[styles.tabText, activeTab === 'radar' && styles.tabTextActive]}>
            ⚡ Dish Availability Radar ({radarItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'shops' && styles.tabBtnActive]}
          onPress={() => setActiveTab('shops')}
        >
          <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>
            🏬 Campus Stalls ({campusCanteens.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content Rendering */}
      {activeTab === 'radar' ? (
        <FlatList
          data={radarItems}
          keyExtractor={item => item.name}
          contentContainerStyle={[styles.listPadding, cartTotalItems > 0 && { paddingBottom: 110 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🍽️</Text>
              <Text style={styles.emptyTitle}>No Matching Food Items</Text>
              <Text style={styles.emptySub}>Try searching another item or add dishes in Canteen POS.</Text>
            </View>
          }
          renderItem={({ item: group }) => (
            <View style={styles.radarCard}>
              <View style={styles.cardHeader}>
                <View style={styles.tagRow}>
                  <Text style={styles.categoryTag}>{group.category}</Text>
                  <Text style={styles.dietTag}>{group.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                </View>
                <Text style={styles.itemName}>{group.name}</Text>
                {group.description ? <Text style={styles.itemDesc}>{group.description}</Text> : null}
              </View>

              <View style={styles.matrixBox}>
                <Text style={styles.matrixTitle}>AVAILABLE AT {group.canteens.length} CANTEEN(S):</Text>
                {group.canteens.map(shopInfo => {
                  const qty = getItemCartQty(shopInfo.shopId, shopInfo.itemId);

                  return (
                    <View key={shopInfo.shopId} style={styles.matrixRow}>
                      <View style={styles.shopInfo}>
                        <Text style={styles.shopName}>{shopInfo.shopName}</Text>
                        <Text style={styles.shopLocationText}>📍 {shopInfo.shopLocation}</Text>
                        <View style={styles.distanceBadgeRow}>
                          <Text
                            style={[
                              styles.distBadgeText,
                              shopInfo.isWithin300m ? styles.distValid : styles.distInvalid
                            ]}
                          >
                            {shopInfo.isWithin300m ? '🟢' : '🔴'} {formatDistance(shopInfo.distMeters)}{' '}
                            ({shopInfo.isWithin300m ? 'Within 300m' : '>300m'})
                          </Text>
                          <Text style={styles.prepTimeBadge}>• ⏳ {shopInfo.prepTime}</Text>
                        </View>
                      </View>

                      <View style={styles.rowRight}>
                        <Text style={styles.priceText}>₹{shopInfo.price}</Text>

                        {/* Stepper or Add button */}
                        {!shopInfo.isAvailable ? (
                          <View style={[styles.orderBtn, styles.orderBtnDisabled]}>
                            <Text style={styles.orderBtnText}>Sold Out</Text>
                          </View>
                        ) : !shopInfo.isWithin300m ? (
                          <TouchableOpacity
                            style={[styles.orderBtn, styles.orderBtnDisabled]}
                            onPress={() =>
                              handleAddToCart(
                                shopInfo.shopObj,
                                shopInfo.itemObj,
                                shopInfo.isWithin300m,
                                shopInfo.distMeters
                              )
                            }
                          >
                            <Text style={styles.orderBtnText}>🚫 &gt;300m</Text>
                          </TouchableOpacity>
                        ) : qty > 0 ? (
                          <View style={styles.stepperContainer}>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => updateCartQty(shopInfo.itemId, -1)}
                            >
                              <Text style={styles.stepperBtnText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.stepperQty}>{qty}</Text>
                            <TouchableOpacity
                              style={styles.stepperBtn}
                              onPress={() => updateCartQty(shopInfo.itemId, 1)}
                            >
                              <Text style={styles.stepperBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.orderBtn}
                            onPress={() =>
                              handleAddToCart(
                                shopInfo.shopObj,
                                shopInfo.itemObj,
                                shopInfo.isWithin300m,
                                shopInfo.distMeters
                              )
                            }
                          >
                            <Text style={styles.orderBtnText}>+ Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={campusCanteens}
          keyExtractor={shop => shop.id}
          contentContainerStyle={[styles.listPadding, cartTotalItems > 0 && { paddingBottom: 110 }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🏪</Text>
              <Text style={styles.emptyTitle}>No Canteens Registered</Text>
              <Text style={styles.emptySub}>Switch to Canteen POS to register your first campus stall.</Text>
            </View>
          }
          renderItem={({ item: shop }) => {
            const distMeters = getDistanceInMeters(userLocation.lat, userLocation.lng, shop.lat, shop.lng);
            const isWithin300m = distMeters <= MAX_ORDER_DISTANCE_METERS;

            return (
              <View style={styles.shopCard}>
                <Image source={{ uri: shop.banner }} style={styles.shopBanner} />
                <View style={styles.shopContent}>
                  <View style={styles.shopHeaderRow}>
                    <Text style={styles.shopTitle}>{shop.name}</Text>
                    <Text style={styles.ratingBadge}>⭐ {shop.rating || 5.0}</Text>
                  </View>

                  <View style={styles.shopMetaRow}>
                    <Text style={styles.shopSub}>📍 {shop.location}</Text>
                    <Text style={[styles.distBadgeText, isWithin300m ? styles.distValid : styles.distInvalid]}>
                      • {formatDistance(distMeters)} ({isWithin300m ? 'Within 300m' : '>300m'})
                    </Text>
                  </View>

                  <View style={styles.shopMenuPreview}>
                    <Text style={styles.previewTitle}>LIVE MENU ITEMS ({(shop.menu || []).length})</Text>
                    {(shop.menu || []).map(item => {
                      const qty = getItemCartQty(shop.id, item.id);

                      return (
                        <View key={item.id} style={styles.previewRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.previewItemName, !item.isAvailable && styles.lineThrough]}>
                              {item.isVeg ? '🟢 ' : '🔴 '}
                              {item.name}
                            </Text>
                            <Text style={styles.previewSubInfo}>⏳ {item.prepTime || '5 mins'}</Text>
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={styles.previewPrice}>₹{item.price}</Text>

                            {!item.isAvailable ? (
                              <Text style={styles.soldOutBadge}>Sold Out</Text>
                            ) : !isWithin300m ? (
                              <Text style={styles.farBadge}>&gt;300m</Text>
                            ) : qty > 0 ? (
                              <View style={styles.stepperContainer}>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => updateCartQty(item.id, -1)}
                                >
                                  <Text style={styles.stepperBtnText}>-</Text>
                                </TouchableOpacity>
                                <Text style={styles.stepperQty}>{qty}</Text>
                                <TouchableOpacity
                                  style={styles.stepperBtn}
                                  onPress={() => updateCartQty(item.id, 1)}
                                >
                                  <Text style={styles.stepperBtnText}>+</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.miniOrderBtn}
                                onPress={() => handleAddToCart(shop, item, isWithin300m, distMeters)}
                              >
                                <Text style={styles.miniOrderText}>+ Add</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Active Order Floating Banner with Live Prep Countdown */}
      {(() => {
        const activeOrderObj = (orders || []).find(o => o.id === activeOrderId);
        return <ActiveOrderFloatingBanner activeOrder={activeOrderObj} onOpenPassModal={onOpenPassModal} />;
      })()}

      {/* Floating Bottom Cart Bar */}
      {cartTotalItems > 0 && (
        <View style={styles.floatingCartBar}>
          <View style={styles.cartInfoWrapper}>
            <View style={styles.cartBadgeCircle}>
              <Text style={styles.cartBadgeText}>{cartTotalItems}</Text>
            </View>
            <View>
              <Text style={styles.cartShopName} numberOfLines={1}>
                {cart.shopName}
              </Text>
              <Text style={styles.cartTotalText}>₹{cartTotalPrice.toFixed(0)} • Total</Text>
            </View>
          </View>

          <View style={styles.cartActionButtons}>
            <TouchableOpacity style={styles.clearCartBtn} onPress={clearCart}>
              <Text style={styles.clearCartText}>✕</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkoutBarBtn} onPress={onOpenCartCheckout}>
              <Text style={styles.checkoutBarText}>Review & Order 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  heroBanner: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    padding: 14,
    borderRadius: 18,
    margin: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroTop: {
    marginBottom: 8,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  gpsSimulatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  gpsLabel: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '800',
  },
  simBtn: {
    backgroundColor: '#131b2e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  simBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  simBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  gpsRecalibrateBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gpsRecalibrateText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    paddingVertical: 8,
    fontSize: 13,
  },
  clearBtn: {
    color: '#94a3b8',
    fontSize: 14,
    padding: 4,
  },
  chipsScroll: {
    maxHeight: 40,
  },
  chipsContainer: {
    paddingHorizontal: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  chipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#f8fafc',
  },
  listPadding: {
    padding: 12,
    paddingBottom: 60,
  },
  radarCard: {
    backgroundColor: '#131d33',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardHeader: {
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  categoryTag: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  dietTag: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
  },
  itemName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  itemDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  matrixBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  matrixTitle: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  matrixRow: {
    backgroundColor: '#1a233a',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  shopInfo: {
    flex: 1,
    marginRight: 8,
  },
  shopName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  shopLocationText: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  distanceBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  distBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  distValid: { color: '#10b981' },
  distInvalid: { color: '#f43f5e' },
  prepTimeBadge: {
    color: '#94a3b8',
    fontSize: 10,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  orderBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  orderBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.7,
  },
  orderBtnText: {
    color: '#090d16',
    fontSize: 11,
    fontWeight: '900',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#06b6d4',
    overflow: 'hidden',
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#06b6d4',
  },
  stepperBtnText: {
    color: '#090d16',
    fontWeight: '900',
    fontSize: 12,
  },
  stepperQty: {
    color: '#ffffff',
    fontWeight: '800',
    paddingHorizontal: 8,
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  emptySub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 },
  shopCard: {
    backgroundColor: '#131d33',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  shopBanner: {
    width: '100%',
    height: 100,
  },
  shopContent: {
    padding: 12,
  },
  shopHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shopTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  ratingBadge: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  shopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 4,
  },
  shopSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  shopMenuPreview: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 8,
    marginTop: 8,
  },
  previewTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  previewItemName: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  previewSubInfo: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1,
  },
  previewPrice: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
  },
  miniOrderBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniOrderText: {
    color: '#090d16',
    fontSize: 10,
    fontWeight: '900',
  },
  soldOutBadge: {
    color: '#64748b',
    fontSize: 10,
    fontStyle: 'italic',
  },
  farBadge: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: '700',
  },
  lineThrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  floatingCartBar: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    backgroundColor: '#1e1b4b',
    borderRadius: 18,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  cartInfoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cartBadgeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
  },
  cartShopName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  cartTotalText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '800',
  },
  cartActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearCartBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  clearCartText: {
    color: '#94a3b8',
    fontWeight: '800',
    fontSize: 12,
  },
  checkoutBarBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  checkoutBarText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
  },
});
