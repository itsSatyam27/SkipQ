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

export default function StudentRadarView({ onSelectOrderItem, onOpenCartCheckout, onOpenPassModal }) {
  const {
    canteens,
    university,
    userLocation,
    banStatus,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    orders,
    activeOrderId,
    userProfile
  } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes' or 'canteens'
  const [vegOnly, setVegOnly] = useState(false);
  const [fastPrepOnly, setFastPrepOnly] = useState(false);
  const [expandedDish, setExpandedDish] = useState(null);

  const campusCanteens = canteens.filter(c => c.universityId === university);
  const souCampusDist = getDistanceInMeters(userLocation?.lat ?? 23.0917, userLocation?.lng ?? 72.5349, 23.0917, 72.5349);
  const isWithinCampus = souCampusDist <= 400;

  // Flatten & group dishes across all canteens
  const itemGroupMap = {};
  campusCanteens.forEach(shop => {
    const distMeters = getDistanceInMeters(userLocation?.lat ?? 23.0917, userLocation?.lng ?? 72.5349, shop.lat, shop.lng);
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

      const matchesVeg = !vegOnly || item.isVeg === true;
      const prepMinMatch = (item.prepTime || '').match(/\d+/);
      const prepMinsVal = prepMinMatch ? parseInt(prepMinMatch[0], 10) : 5;
      const matchesFast = !fastPrepOnly || prepMinsVal <= 5;

      if (matchesQuery && matchesCat && matchesVeg && matchesFast) {
        const key = item.name.toLowerCase().trim();
        if (!itemGroupMap[key]) {
          itemGroupMap[key] = {
            id: item.id,
            name: item.name,
            category: item.category || 'Snacks',
            isVeg: item.isVeg !== undefined ? item.isVeg : true,
            description: item.description,
            image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
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
          prepTime: item.prepTime || '5m',
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

  // Cart calculations
  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);
  const cartTotalPrice = (cart?.items || []).reduce((sum, it) => sum + it.price * it.qty, 0);

  const getItemCartQty = (shopId, itemId) => {
    if (cart.shopId !== shopId) return 0;
    const found = cart.items.find(i => i.id === itemId);
    return found ? found.qty : 0;
  };

  const handleAddToCart = (shopObj, itemObj, isWithin300m, distMeters) => {
    if (banStatus === 'perm_ban') {
      Alert.alert('Account Restricted', 'Your account is permanently suspended due to repeated uncollected orders.');
      return;
    }
    if (!isWithin300m) {
      Alert.alert(
        '📍 Too Far from Canteen',
        `You are ${formatDistance(distMeters)} from ${shopObj.name}. Please be on-campus to place an order.`,
        [{ text: 'Got it', style: 'cancel' }]
      );
      return;
    }
    addToCart(shopObj, itemObj);
  };

  const activeOrderObj = orders.find(o => o.id === activeOrderId);

  return (
    <View style={styles.screenContainer}>
      {/* Top Search & Filter Section */}
      <View style={styles.topSection}>
        {/* Minimal Greeting & Live Status */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingTitle}>
              {userProfile?.name ? `Hey ${userProfile.name.split(' ')[0]} 👋` : 'Hey Foodie 👋'}
            </Text>
            <Text style={styles.greetingSub}>Order ahead & pick up with zero queue</Text>
          </View>

          {/* Discreet GPS Status Chip */}
          <TouchableOpacity
            style={[styles.rangePill, isWithinCampus ? styles.rangePillActive : styles.rangePillAway]}
            onPress={() => {
              if (!isWithinCampus) {
                Alert.alert(
                  '📍 Off Campus',
                  `You are ${formatDistance(souCampusDist)} from Silver Oak University. Please come to campus to order.`,
                  [{ text: 'OK' }]
                );
              }
            }}
          >
            <View style={[styles.rangeDot, isWithinCampus ? styles.rangeDotActive : styles.rangeDotAway]} />
            <Text style={[styles.rangeText, isWithinCampus ? styles.rangeTextActive : styles.rangeTextAway]}>
              {isWithinCampus ? 'On Campus' : `${formatDistance(souCampusDist)} away`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Minimal Search Box */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search puff, chai, frankie, meals..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.searchClearText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Minimal Category Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, selectedCategory === cat && styles.catChipActive]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text style={[styles.catChipText, selectedCategory === cat && styles.catChipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={styles.catDivider} />

          {/* Veg Toggle Chip */}
          <TouchableOpacity
            style={[styles.vegFilterChip, vegOnly && styles.vegFilterChipActive]}
            onPress={() => setVegOnly(!vegOnly)}
          >
            <Text style={styles.vegFilterText}>{vegOnly ? '🟢 Veg Only ✓' : '🌱 Veg'}</Text>
          </TouchableOpacity>

          {/* Quick Prep Toggle Chip */}
          <TouchableOpacity
            style={[styles.fastFilterChip, fastPrepOnly && styles.fastFilterChipActive]}
            onPress={() => setFastPrepOnly(!fastPrepOnly)}
          >
            <Text style={styles.fastFilterText}>{fastPrepOnly ? '⚡ ≤5m ✓' : '⚡ ≤5m'}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Segment Switcher: Dishes vs Stalls */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'dishes' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('dishes')}
          >
            <Text style={[styles.segmentText, activeTab === 'dishes' && styles.segmentTextActive]}>
              Dishes ({radarItems.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'canteens' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('canteens')}
          >
            <Text style={[styles.segmentText, activeTab === 'canteens' && styles.segmentTextActive]}>
              Stalls ({campusCanteens.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area */}
      {activeTab === 'dishes' ? (
        <FlatList
          data={radarItems}
          keyExtractor={item => item.name}
          contentContainerStyle={[styles.contentList, cartTotalItems > 0 && { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            campusCanteens.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <Text style={styles.emptyIcon}>🏪</Text>
                </View>
                <Text style={styles.emptyTitle}>No Live Canteens on Campus Yet</Text>
                <Text style={styles.emptySub}>
                  Silver Oak University currently has no active food stalls registered.
                </Text>
                <View style={styles.emptyVendorBox}>
                  <Text style={styles.emptyVendorTitle}>Are you a Canteen Operator?</Text>
                  <Text style={styles.emptyVendorSub}>
                    Register your campus food stall or switch your role to Seller in your Profile to start receiving orders!
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🍽️</Text>
                <Text style={styles.emptyTitle}>No dishes found</Text>
                <Text style={styles.emptySub}>Try searching for another dish or clearing filters.</Text>
              </View>
            )
          }
          renderItem={({ item: group }) => {
            const primaryShop = group.canteens[0];
            if (!primaryShop) return null;

            const cartQty = getItemCartQty(primaryShop.shopId, primaryShop.itemId);
            const hasMultipleStalls = group.canteens.length > 1;
            const isExpanded = expandedDish === group.name;

            return (
              <View style={styles.dishCard}>
                {/* Main Card Row */}
                <View style={styles.dishMainRow}>
                  {/* Dish Image with Veg Dot Badge */}
                  <View style={styles.imageWrap}>
                    <Image source={{ uri: group.image }} style={styles.dishImg} resizeMode="cover" />
                    <View style={[styles.vegDotBadge, group.isVeg ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
                      <View style={[styles.vegDotInner, group.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
                    </View>
                  </View>

                  {/* Dish Details */}
                  <View style={styles.dishDetails}>
                    <View style={styles.titlePriceRow}>
                      <Text style={styles.dishTitle} numberOfLines={1}>
                        {group.name}
                      </Text>
                      <Text style={styles.dishPrice}>₹{primaryShop.price}</Text>
                    </View>

                    <Text style={styles.dishStallMeta} numberOfLines={1}>
                      {primaryShop.shopName} • ⏳ {primaryShop.prepTime}
                    </Text>

                    {Boolean(group.description) && (
                      <Text style={styles.dishDesc} numberOfLines={1}>
                        {group.description}
                      </Text>
                    )}

                    {/* Multiple Stalls Link */}
                    {hasMultipleStalls && (
                      <TouchableOpacity
                        style={styles.expandStallsBtn}
                        onPress={() => setExpandedDish(isExpanded ? null : group.name)}
                      >
                        <Text style={styles.expandStallsText}>
                          {isExpanded
                            ? 'Hide other stalls ▲'
                            : `Also at ${group.canteens.length - 1} other counter${group.canteens.length > 2 ? 's' : ''} ▼`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Right Action: Add button or Stepper */}
                  <View style={styles.dishActionCol}>
                    {!primaryShop.isAvailable ? (
                      <View style={styles.soldOutBadge}>
                        <Text style={styles.soldOutText}>Sold Out</Text>
                      </View>
                    ) : cartQty > 0 ? (
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateCartQty(primaryShop.itemId, -1)}
                        >
                          <Text style={styles.stepperBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.stepperQtyText}>{cartQty}</Text>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          onPress={() => updateCartQty(primaryShop.itemId, 1)}
                        >
                          <Text style={styles.stepperBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() =>
                          handleAddToCart(
                            primaryShop.shopObj,
                            primaryShop.itemObj,
                            primaryShop.isWithin300m,
                            primaryShop.distMeters
                          )
                        }
                      >
                        <Text style={styles.addBtnText}>+ Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Expanded Alternate Stalls List */}
                {isExpanded && hasMultipleStalls && (
                  <View style={styles.altStallsList}>
                    {group.canteens.slice(1).map(alt => {
                      const altQty = getItemCartQty(alt.shopId, alt.itemId);
                      return (
                        <View key={alt.shopId} style={styles.altStallRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.altStallName}>{alt.shopName}</Text>
                            <Text style={styles.altStallMeta}>
                              {formatDistance(alt.distMeters)} • ⏳ {alt.prepTime}
                            </Text>
                          </View>
                          <Text style={styles.altStallPrice}>₹{alt.price}</Text>
                          {altQty > 0 ? (
                            <View style={styles.altStepper}>
                              <TouchableOpacity onPress={() => updateCartQty(alt.itemId, -1)}>
                                <Text style={styles.altStepperText}>−</Text>
                              </TouchableOpacity>
                              <Text style={styles.altQtyText}>{altQty}</Text>
                              <TouchableOpacity onPress={() => updateCartQty(alt.itemId, 1)}>
                                <Text style={styles.altStepperText}>+</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={styles.altAddBtn}
                              onPress={() => handleAddToCart(alt.shopObj, alt.itemObj, alt.isWithin300m, alt.distMeters)}
                            >
                              <Text style={styles.altAddText}>+ Add</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        /* Stalls View */
        <FlatList
          data={campusCanteens}
          keyExtractor={item => item.id}
          contentContainerStyle={[styles.contentList, cartTotalItems > 0 && { paddingBottom: 110 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>🏪</Text>
              </View>
              <Text style={styles.emptyTitle}>No Canteen Stalls Registered</Text>
              <Text style={styles.emptySub}>
                Registered food counters at Silver Oak University will appear here live as vendors sign up.
              </Text>
            </View>
          }
          renderItem={({ item: shop }) => {
            const distMeters = getDistanceInMeters(userLocation?.lat ?? 23.0917, userLocation?.lng ?? 72.5349, shop.lat, shop.lng);
            const isOpen = shop.status === 'Open';

            return (
              <View style={styles.stallCard}>
                <Image source={{ uri: shop.banner }} style={styles.stallBanner} resizeMode="cover" />
                <View style={styles.stallBody}>
                  <View style={styles.stallTitleRow}>
                    <Text style={styles.stallName}>{shop.name}</Text>
                    <View style={[styles.stallStatusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
                      <Text style={[styles.stallStatusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                        {isOpen ? '🟢 Open' : '🔴 Closed'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.stallLocation}>📍 {shop.location}</Text>

                  <View style={styles.stallMetaRow}>
                    <Text style={styles.stallMetaChip}>⏳ {shop.avgWaitMins || 5}m wait</Text>
                    <Text style={styles.stallMetaChip}>👥 {shop.currentQueue || 0} in queue</Text>
                    <Text style={styles.stallMetaChip}>📍 {formatDistance(distMeters)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.viewStallMenuBtn}
                    onPress={() => {
                      setSearchQuery(shop.name);
                      setActiveTab('dishes');
                    }}
                  >
                    <Text style={styles.viewStallMenuText}>
                      Browse Menu ({shop.menu ? shop.menu.length : 0} items) ➔
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Floating Cart Checkout Bar */}
      {cartTotalItems > 0 && (
        <View style={styles.floatingCartDock}>
          <TouchableOpacity style={styles.floatingCartPill} onPress={onOpenCartCheckout} activeOpacity={0.9}>
            <View style={styles.cartPillLeft}>
              <View style={styles.cartIconBadge}>
                <Text style={styles.cartIconText}>🛒</Text>
              </View>
              <View>
                <Text style={styles.cartPillTitle}>{cartTotalItems} item{cartTotalItems > 1 ? 's' : ''} in cart</Text>
                <Text style={styles.cartPillShop}>{cart.shopName}</Text>
              </View>
            </View>
            <View style={styles.cartPillRight}>
              <Text style={styles.cartPillPrice}>₹{cartTotalPrice}</Text>
              <Text style={styles.cartPillAction}>View Cart ➔</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#070a13',
  },
  topSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#070a13',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  greetingTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  greetingSub: {
    color: '#64748b',
    fontSize: 11.5,
    marginTop: 1,
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  rangePillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  rangePillAway: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  rangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rangeDotActive: {
    backgroundColor: '#10b981',
  },
  rangeDotAway: {
    backgroundColor: '#f59e0b',
  },
  rangeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rangeTextActive: {
    color: '#10b981',
  },
  rangeTextAway: {
    color: '#f59e0b',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 0,
  },
  searchClearText: {
    color: '#64748b',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  categoryList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  catChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  catChipText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  catDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 4,
  },
  vegFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  vegFilterChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  vegFilterText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  fastFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  fastFilterChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  fastFilterText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#0b1120',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 2,
    marginBottom: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: '#1e293b',
  },
  segmentText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#f1f5f9',
    fontWeight: '800',
  },
  contentList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  dishCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dishMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageWrap: {
    position: 'relative',
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
  },
  dishImg: {
    width: '100%',
    height: '100%',
  },
  vegDotBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 13,
    height: 13,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vegBadgeGreen: {
    borderColor: '#10b981',
  },
  vegBadgeRed: {
    borderColor: '#ef4444',
  },
  vegDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  vegDotGreen: {
    backgroundColor: '#10b981',
  },
  vegDotRed: {
    backgroundColor: '#ef4444',
  },
  dishDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  titlePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dishTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  dishPrice: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '900',
  },
  dishStallMeta: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  dishDesc: {
    color: '#64748b',
    fontSize: 10.5,
    marginTop: 2,
    lineHeight: 14,
  },
  expandStallsBtn: {
    marginTop: 4,
  },
  expandStallsText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '700',
  },
  dishActionCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    shadowColor: '#6366f1',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#6366f1',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  stepperBtnText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '900',
  },
  stepperQtyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  soldOutBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  soldOutText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
  },
  altStallsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  altStallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  altStallName: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  altStallMeta: {
    color: '#64748b',
    fontSize: 10,
  },
  altStallPrice: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  altAddBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  altAddText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '800',
  },
  altStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  altStepperText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '900',
  },
  altQtyText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  stallCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  stallBanner: {
    width: '100%',
    height: 100,
  },
  stallBody: {
    padding: 12,
  },
  stallTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stallName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  stallStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusClosed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  stallStatusText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusTextOpen: {
    color: '#10b981',
  },
  statusTextClosed: {
    color: '#ef4444',
  },
  stallLocation: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 8,
  },
  stallMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  stallMetaChip: {
    color: '#94a3b8',
    fontSize: 10,
    backgroundColor: '#1e293b',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  viewStallMenuBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  viewStallMenuText: {
    color: '#818cf8',
    fontSize: 11.5,
    fontWeight: '800',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.25)',
  },
  emptyVendorBox: {
    backgroundColor: '#0c1527',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    alignItems: 'center',
  },
  emptyVendorTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyVendorSub: {
    color: '#94a3b8',
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  floatingCartDock: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
  },
  floatingCartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#10b981',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  cartPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconText: {
    fontSize: 14,
  },
  cartPillTitle: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '900',
  },
  cartPillShop: {
    color: '#065f46',
    fontSize: 10.5,
    fontWeight: '700',
  },
  cartPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartPillPrice: {
    color: '#064e3b',
    fontSize: 14,
    fontWeight: '900',
  },
  cartPillAction: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
