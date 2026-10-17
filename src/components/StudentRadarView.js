import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { prepMinutes, prepLabel, itemCountLabel } from '../utils/orderDisplay.cjs';
import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useContext, useMemo, useState } from 'react';
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
import LocationControl from './LocationControl';
import { isUsableLocation } from '../services/locationPolicy.cjs';
import { getDistanceInMeters, formatDistance, isWithinOrderingPerimeter, MAX_ORDER_DISTANCE_METERS } from '../utils/distance';

export default function StudentRadarView({ onSelectOrderItem, onOpenCartCheckout, onOpenPassModal }) {
  const styles = useSellerStyles(baseStyles);
  const insets = useSafeAreaInsets();
  const cartDockBottom = 70 + Math.max(12, insets.bottom) + 12;
  const { light } = useSellerTheme();
  const {
    canteens,
    university,
    userLocation,
    locationTesting,
    requestUserLocation,
    banStatus,
    cart,
    addToCart,
    updateCartQty,
    clearCart,
    orders,
    activeOrderId,
    userProfile,
    setRole
  } = useContext(AppContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeTab, setActiveTab] = useState('dishes'); // 'dishes' or 'canteens'
  const [vegOnly, setVegOnly] = useState(false);
  const [fastPrepOnly, setFastPrepOnly] = useState(false);
  const [expandedDish, setExpandedDish] = useState(null);

  const campusCanteens = useMemo(() => canteens.filter(c => c.universityId === university), [canteens, university]);
  const hasUserLocation = isUsableLocation(userLocation);
  const souCampusDist = hasUserLocation
    ? getDistanceInMeters(userLocation.lat, userLocation.lng, 23.0917, 72.5349)
    : null;
  const isWithinCampus = hasUserLocation && souCampusDist != null && souCampusDist <= MAX_ORDER_DISTANCE_METERS;

  // Flatten & group dishes across all canteens
  const radarItems = useMemo(() => {
  const itemGroupMap = {};
  campusCanteens.forEach(shop => {
    const shopLat = shop.lat ?? 23.0917;
    const shopLng = shop.lng ?? 72.5349;
    const distMeters = hasUserLocation
      ? getDistanceInMeters(userLocation.lat, userLocation.lng, shopLat, shopLng)
      : null;
    const isWithin300m = locationTesting || (distMeters != null && isWithinOrderingPerimeter(distMeters, userLocation?.accuracy || 0));

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
      const prepMinsVal = prepMinutes(item.prepTime);
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
            image: item.image || '',
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
          prepTime: prepLabel(item.prepTime),
          isAvailable: shop.status === 'Open' && item.isAvailable !== false,
          isVeg: item.isVeg,
          itemId: item.id,
          shopObj: shop,
          itemObj: item
        });
      }
    });
  });

  return Object.values(itemGroupMap);
  }, [locationTesting, campusCanteens, fastPrepOnly, searchQuery, selectedCategory, userLocation?.lat, userLocation?.lng, userLocation?.accuracy, vegOnly]);
  const categories = ['All', 'Snacks', 'Beverages', 'Meals', 'Rolls', 'Sandwiches', 'Desserts'];

  // Cart calculations
  const cartTotalItems = (cart?.items || []).reduce((sum, it) => sum + it.qty, 0);
  const cartTotalPrice = (cart?.items || []).reduce((sum, it) => sum + it.price * it.qty, 0);

  const getItemCartQty = (shopId, itemId) => {
    if (cart.shopId !== shopId) return 0;
    const found = cart.items.find(i => i.id === itemId);
    return found ? found.qty : 0;
  };

  const handleAddToCart = async (shopObj, itemObj) => {
    if (shopObj.status !== 'Open') {
      Alert.alert('Orders paused', `${shopObj.name} is not accepting new orders right now.`);
      return;
    }
    if (banStatus === 'perm_ban') {
      Alert.alert('Account Restricted', 'Your account is permanently suspended due to repeated uncollected orders.');
      return;
    }
    if (!locationTesting) {
      let location = userLocation;
      if (!isUsableLocation(location)) {
        try { location = await requestUserLocation(); } catch { return; }
      }
      if (!isUsableLocation(location)) return;
      const distMeters = getDistanceInMeters(location.lat, location.lng, shopObj.lat ?? 23.0917, shopObj.lng ?? 72.5349);
      const isWithin300m = isWithinOrderingPerimeter(distMeters, location.accuracy);
      if (!isWithin300m) {
        Alert.alert(
          'Outside pickup range',
          `You are currently ${formatDistance(distMeters)} away from ${shopObj.name}. SkipQ strictly allows ordering only when you are physically on campus (<500m).`,
          [{ text: 'Got it', style: 'cancel' }]
        );
        return;
      }
    }
    if (cart.shopId && cart.shopId !== shopObj.id && cartTotalItems > 0) {
      Alert.alert(
        'Replace Cart Items?',
        `Your cart currently contains ${cartTotalItems} item(s) from "${cart.shopName}". Would you like to clear it and start ordering from "${shopObj.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear & Add',
            style: 'destructive',
            onPress: () => addToCart(shopObj, itemObj)
          }
        ]
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
              {userProfile?.name ? `Hey ${userProfile.name.split(' ')[0]} ` : 'Hey Foodie '}
            </Text>
            <Text style={styles.greetingSub}>Order ahead & pick up with zero queue</Text>
          </View>

          <LocationControl compact />
        </View>

        {!hasUserLocation && !locationTesting && <LocationControl />}

        {/* Minimal Search Box */}
        <View style={styles.searchBar}>
          <View style={{ padding: 6 }}><InterfaceIcon name="search" size={24} color="#ffb313" /></View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search puff, chai, frankie, meals..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.searchClearText}></Text>
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
            <Text style={styles.vegFilterText}>{vegOnly ? ' Veg Only ' : ' Veg'}</Text>
          </TouchableOpacity>

          {/* Quick Prep Toggle Chip */}
          <TouchableOpacity
            style={[styles.fastFilterChip, fastPrepOnly && styles.fastFilterChipActive]}
            onPress={() => setFastPrepOnly(!fastPrepOnly)}
          >
            <Text style={styles.fastFilterText}>{fastPrepOnly ? ' ≤5m ' : ' ≤5m'}</Text>
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
          contentContainerStyle={[styles.contentList, cartTotalItems > 0 && { paddingBottom: cartDockBottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            campusCanteens.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <View style={{ padding: 6 }}><InterfaceIcon name="menu" size={24} color="#ffb313" /></View>
                </View>
                <Text style={styles.emptyTitle}>No Live Canteens on Campus Yet</Text>
                <Text style={styles.emptySub}>
                  Silver Oak University currently has no active food stalls registered.
                </Text>
                <View style={styles.emptyVendorBox}>
                  <Text style={styles.emptyVendorTitle}>Are you a Canteen Operator?</Text>
                  <Text style={styles.emptyVendorSub}>
                    Register your campus food stall or switch to Vendor POS to add menu items and start taking orders!
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyVendorActionBtn}
                    onPress={() => setRole('seller')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.emptyVendorActionBtnText}> Open Vendor POS / Register Canteen </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <View style={{ padding: 6 }}><InterfaceIcon name="menu" size={24} color="#ffb313" /></View>
                <Text style={styles.emptyTitle}>No dishes found</Text>
                <Text style={styles.emptySub}>
                  {searchQuery
                    ? `No matching dishes found for "${searchQuery}"`
                    : selectedCategory !== 'All'
                    ? `No dishes in "${selectedCategory}". Try choosing All or another category.`
                    : 'No dishes available matching the current dietary/speed filters.'}
                </Text>
                <TouchableOpacity
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSelectedCategory('All');
                    setVegOnly(false);
                    setFastPrepOnly(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearFilterBtnText}> Reset Filters</Text>
                </TouchableOpacity>
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
                    {group.image ? <Image source={{ uri: group.image }} style={styles.dishImg} resizeMode="cover" /> : <View style={[styles.dishImg, { alignItems: 'center', justifyContent: 'center' }]}><InterfaceIcon name="menu" size={25} color="#a5a9b2" /></View>}

                  </View>

                  {/* Dish Details */}
                  <View style={styles.dishDetails}>
                    <View style={styles.titlePriceRow}>
                    <View style={[styles.nameDietBadge, group.isVeg ? styles.vegBadgeGreen : styles.vegBadgeRed]}>
                      <View style={[styles.vegDotInner, group.isVeg ? styles.vegDotGreen : styles.vegDotRed]} />
                    </View>
                      <Text style={styles.dishTitle} numberOfLines={1}>
                        {group.name}
                      </Text>
                    </View>

                    <Text style={styles.dishStallMeta} numberOfLines={1}>
                      {primaryShop.shopName} •  {primaryShop.prepTime}
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

                  <Text style={styles.dishPrice}>₹{primaryShop.price}</Text>
                  {/* Right Action: Add button or Stepper */}
                  <View style={styles.dishActionCol}>
                    {!primaryShop.isAvailable ? (
                      <View style={styles.soldOutBadge}>
                        <Text style={styles.soldOutText}>{primaryShop.shopObj.status !== 'Open' ? 'Paused' : 'Sold Out'}</Text>
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
                              {formatDistance(alt.distMeters)} •  {alt.prepTime}
                            </Text>
                          </View>
                          <Text style={styles.altStallPrice}>₹{alt.price}</Text>
                          {!alt.isAvailable ? (
                            <Text style={styles.soldOutText}>{alt.shopObj.status !== 'Open' ? 'Paused' : 'Sold Out'}</Text>
                          ) : altQty > 0 ? (
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
          contentContainerStyle={[styles.contentList, cartTotalItems > 0 && { paddingBottom: cartDockBottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <View style={{ padding: 6 }}><InterfaceIcon name="menu" size={24} color="#ffb313" /></View>
              </View>
              <Text style={styles.emptyTitle}>No Canteen Stalls Registered</Text>
              <Text style={styles.emptySub}>
                Registered food counters at Silver Oak University will appear here live as vendors sign up.
              </Text>
              <TouchableOpacity
                style={[styles.emptyVendorActionBtn, { marginTop: 16 }]}
                onPress={() => setRole('seller')}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyVendorActionBtnText}> Open Vendor POS / Register Canteen </Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: shop }) => {
            const shopLat = shop.lat ?? 23.0917;
            const shopLng = shop.lng ?? 72.5349;
            const distMeters = hasUserLocation
              ? getDistanceInMeters(userLocation.lat, userLocation.lng, shopLat, shopLng)
              : null;
            const isOpen = shop.status === 'Open';

            return (
              <View style={styles.stallCard}>
                <Image source={{ uri: shop.banner }} style={styles.stallBanner} resizeMode="cover" />
                <View style={styles.stallBody}>
                  <View style={styles.stallTitleRow}>
                    <Text style={styles.stallName}>{shop.name}</Text>
                    <View style={[styles.stallStatusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
                      <Text style={[styles.stallStatusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                        {isOpen ? ' Open' : ' Closed'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.stallLocation}> {shop.location}</Text>

                  <View style={styles.stallMetaRow}>
                    <Text style={styles.stallMetaChip}> {shop.avgWaitMins || 5}m wait</Text>
                    <Text style={styles.stallMetaChip}> {shop.currentQueue || 0} in queue</Text>
                    <Text style={styles.stallMetaChip}> {distMeters != null ? formatDistance(distMeters) : 'Location pending'}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.viewStallMenuBtn}
                    onPress={() => {
                      setSearchQuery(shop.name);
                      setActiveTab('dishes');
                    }}
                  >
                    <Text style={styles.viewStallMenuText}>
                      Browse Menu ({itemCountLabel(shop.menu?.length || 0)})
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
        <View style={[styles.floatingCartDock, { bottom: cartDockBottom }]}>
          <TouchableOpacity style={styles.floatingCartPill} onPress={onOpenCartCheckout} activeOpacity={0.9}>
            <View style={styles.cartPillLeft}>
              <View style={styles.cartIconBadge}>
                <View style={{ padding: 6 }}><InterfaceIcon name="orders" size={24} color="#ffb313" /></View>
              </View>
              <View>
                <Text style={styles.cartPillTitle}>{cartTotalItems} item{cartTotalItems > 1 ? 's' : ''} in cart</Text>
                <Text style={styles.cartPillShop}>{cart.shopName}</Text>
              </View>
            </View>
            <View style={styles.cartPillRight}>
              <Text style={styles.cartPillPrice}>₹{cartTotalPrice}</Text>
              <Text style={styles.cartPillAction}>View Cart </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  nameDietBadge: { width: 13, height: 13, borderRadius: 3, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  screenContainer: {
    flex: 1,
    backgroundColor: '#090b0d',
  },
  topSection: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#090b0d',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  greetingTitle: {
    color: '#f5f4f0',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  greetingSub: {
    color: '#a5a9b2',
    fontSize: 12,
    marginTop: 1,
    fontWeight: '600',
  },
  rangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  rangePillActive: {
    backgroundColor: '#ccfbf1',
    borderColor: '#99f6e4',
  },
  rangePillAway: {
    backgroundColor: '#292418',
    borderColor: '#fde68a',
  },
  rangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rangeDotActive: {
    backgroundColor: '#0f766e',
  },
  rangeDotAway: {
    backgroundColor: '#b45309',
  },
  rangeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  rangeTextActive: {
    color: '#0f766e',
  },
  rangeTextAway: {
    color: '#b45309',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121417',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#26292e',
    marginBottom: 10,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f5f4f0',
    fontSize: 13.5,
    fontWeight: '600',
    paddingVertical: 0,
  },
  searchClearText: {
    color: '#a5a9b2',
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#121417',
    borderWidth: 1,
    borderColor: '#26292e',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  catChipActive: {
    backgroundColor: '#ffb313',
    borderColor: '#ffb313',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  catChipText: {
    color: '#b6bac2',
    fontSize: 12,
    fontWeight: '700',
  },
  catChipTextActive: {
    color: '#090b0d',
    fontWeight: '900',
  },
  catDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#26292e',
    marginHorizontal: 4,
  },
  vegFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#121417',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  vegFilterChipActive: {
    backgroundColor: '#15231c',
    borderColor: '#10b981',
  },
  vegFilterText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  fastFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#121417',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  fastFilterChipActive: {
    backgroundColor: '#292418',
    borderColor: '#f59e0b',
  },
  fastFilterText: {
    color: '#b45309',
    fontSize: 11.5,
    fontWeight: '800',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#26292e',
    marginTop: 2,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 0,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  segmentBtnActive: {
    backgroundColor: '#ffb313',
  },
  segmentText: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: '#090b0d',
    fontWeight: '900',
  },
  contentList: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },
  dishCard: {
    backgroundColor: '#121417',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#26292e',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  dishMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  imageWrap: {
    position: 'relative',
    width: 76,
    height: 76,
    borderRadius: 16,
    overflow: 'hidden',
  },
  dishImg: {
    width: '100%',
    height: '100%',
  },
  vegDotBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#121417',
    borderWidth: 1.5,
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
    width: 6,
    height: 6,
    borderRadius: 3,
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
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '900',
    flex: 1,
  },
  dishPrice: {
    color: '#f5f4f0',
    fontSize: 16,
    fontWeight: '900',
  },
  dishStallMeta: {
    color: '#a5a9b2',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  dishDesc: {
    color: '#a5a9b2',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  expandStallsBtn: {
    marginTop: 4,
  },
  expandStallsText: {
    color: '#ffb313',
    fontSize: 10.5,
    fontWeight: '800',
  },
  dishActionCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: '#ffb313',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#0c52a3',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addBtnText: {
    color: '#090b0d',
    fontSize: 12,
    fontWeight: '900',
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202329',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  stepperBtnText: {
    color: '#ffb313',
    fontSize: 14,
    fontWeight: '900',
  },
  stepperQtyText: {
    color: '#ffb313',
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 4,
  },
  soldOutBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  soldOutText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  altStallsList: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  altStallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  altStallName: {
    color: '#f5f4f0',
    fontSize: 12,
    fontWeight: '800',
  },
  altStallMeta: {
    color: '#a5a9b2',
    fontSize: 10.5,
  },
  altStallPrice: {
    color: '#f5f4f0',
    fontSize: 13,
    fontWeight: '900',
  },
  altAddBtn: {
    backgroundColor: '#202329',
    borderColor: '#bae6fd',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  altAddText: {
    color: '#ffb313',
    fontSize: 11,
    fontWeight: '900',
  },
  altStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#202329',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  altStepperText: {
    color: '#ffb313',
    fontSize: 13,
    fontWeight: '900',
  },
  altQtyText: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '900',
  },
  stallCard: {
    backgroundColor: '#121417',
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#26292e',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  stallBanner: {
    width: '100%',
    height: 110,
  },
  stallBody: {
    padding: 14,
  },
  stallTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stallName: {
    color: '#f5f4f0',
    fontSize: 16,
    fontWeight: '900',
    flex: 1,
  },
  stallStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusOpen: {
    backgroundColor: '#ccfbf1',
  },
  statusClosed: {
    backgroundColor: '#fee2e2',
  },
  stallStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextOpen: {
    color: '#0f766e',
  },
  statusTextClosed: {
    color: '#dc2626',
  },
  stallLocation: {
    color: '#a5a9b2',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  stallMetaRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  stallMetaChip: {
    color: '#b6bac2',
    fontSize: 10.5,
    backgroundColor: '#17191d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '700',
  },
  viewStallMenuBtn: {
    backgroundColor: '#17191d',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  viewStallMenuText: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '900',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#f5f4f0',
    fontSize: 16,
    fontWeight: '900',
  },
  emptySub: {
    color: '#a5a9b2',
    fontSize: 12.5,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  clearFilterBtn: {
    marginTop: 14,
    backgroundColor: '#ffb313',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  clearFilterBtnText: {
    color: '#090b0d',
    fontSize: 12.5,
    fontWeight: '900',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#202329',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  emptyVendorBox: {
    backgroundColor: '#121417',
    borderRadius: 20,
    padding: 18,
    marginTop: 20,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: '#26292e',
    alignItems: 'center',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyVendorTitle: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyVendorSub: {
    color: '#a5a9b2',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyVendorActionBtn: {
    backgroundColor: '#ffb313',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    marginTop: 14,
    alignItems: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyVendorActionBtnText: {
    color: '#090b0d',
    fontSize: 13,
    fontWeight: '900',
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
    backgroundColor: '#ffb313',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cartPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconText: {
    fontSize: 15,
  },
  cartPillTitle: {
    color: '#090b0d',
    fontSize: 13.5,
    fontWeight: '900',
  },
  cartPillShop: {
    color: '#42320c',
    fontSize: 11,
    fontWeight: '700',
  },
  cartPillRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartPillPrice: {
    color: '#090b0d',
    fontSize: 15,
    fontWeight: '900',
  },
  cartPillAction: {
    backgroundColor: '#121417',
    color: '#ffb313',
    fontSize: 11.5,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
});
