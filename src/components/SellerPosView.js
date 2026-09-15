import React, { useContext, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  Image
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { announceTokenReady } from '../utils/audio';

export default function SellerPosView({
  onOpenAddItemModal,
  onOpenEditItemModal,
  onOpenCreateCanteenModal
}) {
  const {
    canteens,
    sellerShopId,
    setSellerShopId,
    toggleItemStock,
    updateItemPrice,
    deleteMenuItem,
    deleteCanteen,
    orders,
    markOrderReady,
    markOrderCompleted,
    verifyAndCompleteOrder,
    cancelOrder,
    markOrderAbandoned,
    university,
    rushModeActive,
    toggleRushMode
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'menu', 'analytics'
  const [orderFilter, setOrderFilter] = useState('active'); // 'active', 'completed'
  const [canteenPickerVisible, setCanteenPickerVisible] = useState(false);
  const [verifyModalVisible, setVerifyModalVisible] = useState(false);
  const [qrScanModalVisible, setQrScanModalVisible] = useState(false);
  const [orderToVerify, setOrderToVerify] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [chefBatchCollapsed, setChefBatchCollapsed] = useState(false);

  // Menu Management state
  const [menuSearch, setMenuSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  const campusCanteens = canteens.filter(c => c.universityId === university);
  const currentShop = campusCanteens.find(c => c.id === sellerShopId) || campusCanteens[0];

  if (!currentShop) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>🏪</Text>
        <Text style={styles.emptyTitle}>No Canteen Configured</Text>
        <Text style={styles.emptySub}>Register your first campus canteen to start managing orders.</Text>
        <TouchableOpacity style={styles.createFirstBtn} onPress={onOpenCreateCanteenModal}>
          <Text style={styles.createFirstBtnText}>+ Register New Canteen 🚀</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const shopOrders = orders.filter(o => o.shopId === currentShop.id);
  const activeOrders = shopOrders.filter(
    o => o.orderStatus !== 'Completed' && o.orderStatus !== 'Cancelled' && o.orderStatus !== 'Abandoned'
  );
  const completedOrders = shopOrders.filter(
    o => o.orderStatus === 'Completed' || o.orderStatus === 'Cancelled' || o.orderStatus === 'Abandoned'
  );

  // Sort Active Orders: Faculty Express orders first!
  const sortedActiveOrders = useMemo(() => {
    return [...activeOrders].sort((a, b) => {
      if (a.isFacultyExpress && !b.isFacultyExpress) return -1;
      if (!a.isFacultyExpress && b.isFacultyExpress) return 1;
      return 0;
    });
  }, [activeOrders]);

  // Chef Batching: Aggregate items across all preparing orders
  const chefBatchList = useMemo(() => {
    const counts = {};
    activeOrders.forEach(ord => {
      if (ord.orderStatus === 'Preparing') {
        (ord.items || []).forEach(it => {
          const name = it.name || it.title || 'Item';
          counts[name] = (counts[name] || 0) + (it.qty || 1);
        });
      }
    });
    return Object.entries(counts).map(([name, qty]) => ({ name, qty }));
  }, [activeOrders]);

  // Analytics Calculation
  const totalRevenue = shopOrders
    .filter(o => o.orderStatus === 'Completed')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  // Menu filtering
  const menuItems = currentShop.menu || [];
  const categories = ['All', ...new Set(menuItems.map(i => i.category || 'Snacks'))];
  const filteredMenu = useMemo(() => {
    let items = menuItems;
    if (categoryFilter !== 'All') {
      items = items.filter(i => (i.category || 'Snacks') === categoryFilter);
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase().trim();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, categoryFilter, menuSearch]);

  const inStockCount = menuItems.filter(i => i.isAvailable).length;
  const outOfStockCount = menuItems.filter(i => !i.isAvailable).length;

  const handleSellerCancel = orderId => {
    Alert.alert(
      'Cancel Student Order',
      'Are you sure you want to cancel this order? The student will be issued an instant 100% refund.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            const msg = await cancelOrder(orderId, 'seller');
            Alert.alert('Order Cancelled', `Student refunded. ${msg}`);
          }
        }
      ]
    );
  };

  const handleMarkAbandoned = (orderId, buyerName) => {
    Alert.alert(
      'Mark Order Unclaimed / No-Show',
      `Did ${buyerName} fail to pick up this order? This will forfeit their 10% security deposit and issue a strike & temporary ban penalty.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Issue Penalty & Mark Unclaimed',
          style: 'destructive',
          onPress: async () => {
            const { newUnclaimedCount, newBanStatus } = await markOrderAbandoned(orderId);
            Alert.alert(
              'No-Show Penalty Applied',
              `Order marked abandoned. Student strikes: ${newUnclaimedCount}. Status: ${newBanStatus.toUpperCase()}.`
            );
          }
        }
      ]
    );
  };

  const handleDeleteDish = (itemId, itemName) => {
    Alert.alert('Delete Dish', `Are you sure you want to remove "${itemName}" from your live menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMenuItem(currentShop.id, itemId)
      }
    ]);
  };

  const handleDeleteCurrentCanteen = () => {
    Alert.alert('Delete Canteen', `Permanently delete "${currentShop.name}" and remove all items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Canteen',
        style: 'destructive',
        onPress: async () => {
          await deleteCanteen(currentShop.id);
          Alert.alert('Canteen Deleted', 'The canteen has been removed.');
        }
      }
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Seller Header with Canteen Switcher */}
      <View style={styles.sellerHeader}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.sellerCampusBadge}>
              <View style={styles.sellerCampusDot} />
              <Text style={styles.sellerCampusText}>SILVER OAK UNIVERSITY • KDS</Text>
            </View>
            <TouchableOpacity
              style={styles.canteenSelectorBtn}
              onPress={() => setCanteenPickerVisible(true)}
            >
              <Text style={styles.shopTitle} numberOfLines={1}>
                🏪 {currentShop.name}
              </Text>
              <View style={styles.switchPill}>
                <Text style={styles.switchPillText}>Switch ▼</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.shopLoc}>📍 {currentShop.location}</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[styles.rushBtnHeader, rushModeActive && styles.rushBtnHeaderActive]}
              onPress={toggleRushMode}
              activeOpacity={0.85}
            >
              <Text style={styles.rushBtnIcon}>{rushModeActive ? '🔥' : '⚡'}</Text>
              <Text style={[styles.rushBtnText, rushModeActive && styles.rushBtnTextActive]}>
                {rushModeActive ? 'Rush ON' : 'Rush'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.newCanteenBtn} onPress={onOpenCreateCanteenModal}>
              <Text style={styles.newCanteenBtnText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, styles.statBoxActive]}>
            <Text style={[styles.statVal, { color: '#fbbf24' }]}>{activeOrders.length}</Text>
            <Text style={styles.statLbl}>Live Kitchen</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRevenue]}>
            <Text style={[styles.statVal, { color: '#34d399' }]}>₹{totalRevenue.toFixed(0)}</Text>
            <Text style={styles.statLbl}>Revenue</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMenu]}>
            <Text style={[styles.statVal, { color: '#38bdf8' }]}>{menuItems.length}</Text>
            <Text style={styles.statLbl}>Dishes</Text>
          </View>
        </View>
      </View>

      {/* POS Sub-Navigation — Segmented Control */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'orders' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.subTabText, activeTab === 'orders' && styles.subTabTextActive]}>
            🍳 Orders
          </Text>
          {activeOrders.length > 0 && (
            <View style={styles.subTabBadge}>
              <Text style={styles.subTabBadgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'menu' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.subTabText, activeTab === 'menu' && styles.subTabTextActive]}>
            📋 Menu
          </Text>
          <View style={[styles.subTabBadge, { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.subTabBadgeText, { color: '#94a3b8' }]}>{menuItems.length}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'analytics' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text style={[styles.subTabText, activeTab === 'analytics' && styles.subTabTextActive]}>
            📊 Stats
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 1: KITCHEN DISPLAY SYSTEM (KDS) — ORDERS       */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'orders' && (
        <View style={styles.panel}>
          {/* Chef Batching List Banner (Aggregate items needed now) */}
          {chefBatchList.length > 0 && (
            <View style={styles.batchBanner}>
              <TouchableOpacity
                style={styles.batchBannerHeader}
                onPress={() => setChefBatchCollapsed(!chefBatchCollapsed)}
                activeOpacity={0.8}
              >
                <View style={styles.batchTitleRow}>
                  <Text style={styles.batchIcon}>👨‍🍳</Text>
                  <Text style={styles.batchTitle}>CHEF BATCH LIST (COOKING NOW)</Text>
                  <View style={styles.batchCountBadge}>
                    <Text style={styles.batchCountText}>{chefBatchList.reduce((s, b) => s + b.qty, 0)} total</Text>
                  </View>
                </View>
                <Text style={styles.batchToggle}>{chefBatchCollapsed ? 'Show ▼' : 'Hide ▲'}</Text>
              </TouchableOpacity>
              {!chefBatchCollapsed && (
                <View style={styles.batchPillsWrap}>
                  {chefBatchList.map((bItem, bIdx) => (
                    <View key={bIdx} style={styles.batchPill}>
                      <Text style={styles.batchPillQty}>{bItem.qty}x</Text>
                      <Text style={styles.batchPillName}>{bItem.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Active / Completed Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, orderFilter === 'active' && styles.filterPillActive]}
              onPress={() => setOrderFilter('active')}
            >
              <Text style={[styles.filterPillText, orderFilter === 'active' && styles.filterPillTextActive]}>
                🔥 Live ({activeOrders.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterPill, orderFilter === 'completed' && styles.filterPillActive]}
              onPress={() => setOrderFilter('completed')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  orderFilter === 'completed' && styles.filterPillTextActive
                ]}
              >
                📜 History ({completedOrders.length})
              </Text>
            </TouchableOpacity>
          </View>

          {(orderFilter === 'active' ? sortedActiveOrders : completedOrders).length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>☕</Text>
              <Text style={styles.noOrdersText}>
                {orderFilter === 'active' ? 'No incoming orders right now.' : 'No past orders yet.'}
              </Text>
            </View>
          ) : (
            (orderFilter === 'active' ? sortedActiveOrders : completedOrders).map(order => {
              const isPreparing = order.orderStatus === 'Preparing';
              const isReady = order.orderStatus === 'Ready' || order.orderStatus === 'Ready for Pickup';
              const isCompleted = order.orderStatus === 'Completed';
              const isCancelled = order.orderStatus === 'Cancelled';
              const isAbandoned = order.orderStatus === 'Abandoned';
              const elapsedMins = order.timestamp
                ? Math.max(1, Math.round((Date.now() - new Date(order.timestamp).getTime()) / 60000))
                : 1;

              return (
                <View
                  key={order.id}
                  style={[
                    styles.kdsCard,
                    isReady && styles.kdsReadyCard,
                    isCompleted && styles.kdsCompletedCard,
                    isCancelled && styles.kdsCancelledCard,
                    isAbandoned && styles.kdsAbandonedCard
                  ]}
                >
                  {/* Token + Status Header */}
                  <View style={styles.kdsCardHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={styles.tokenRow}>
                        <View style={[styles.tokenPill, isReady && styles.tokenPillReady]}>
                          <Text style={[styles.tokenText, isReady && styles.tokenTextReady]}>
                            #{order.tokenNumber || 'SQ-00'}
                          </Text>
                        </View>
                        {isPreparing && (
                          <View style={styles.urgencyTag}>
                            <Text style={styles.urgencyText}>🔥 {elapsedMins}m ago</Text>
                          </View>
                        )}
                        {isReady && (
                          <View style={[styles.urgencyTag, styles.urgencyTagReady]}>
                            <Text style={styles.urgencyTextReady}>🔔 Awaiting PIN</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.orderStudentName}>
                        👤 {order.buyerName || 'Campus Student'}{' '}
                        {order.buyerRollNo ? `(${order.buyerRollNo})` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderTotalAmount}>₹{order.totalAmount}</Text>
                      <View style={styles.paymentChip}>
                        <Text style={styles.paymentChipText}>
                          {order.paymentMethod === 'Cash' ? '💵 Cash' : `⚡ ${order.paymentMethod}`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Items list */}
                  <View style={styles.itemsList}>
                    {(order.items || []).map((i, idx) => (
                      <View key={idx} style={styles.itemLine}>
                        <View style={styles.itemQtyBadge}>
                          <Text style={styles.itemQtyText}>x{i.qty}</Text>
                        </View>
                        <Text style={styles.itemText}>{i.name}</Text>
                        <Text style={styles.itemPriceSub}>₹{i.price * i.qty}</Text>
                      </View>
                    ))}

                    {/* Special Instructions */}
                    {order.specialInstructions ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>📝 CHEF NOTE</Text>
                        <Text style={styles.notesText}>{order.specialInstructions}</Text>
                      </View>
                    ) : null}

                    {order.heldDepositAmount > 0 && isPreparing && (
                      <Text style={styles.depositNotice}>
                        🔒 10% Security Deposit Held: ₹{order.heldDepositAmount}
                      </Text>
                    )}
                  </View>

                  {/* Faculty & Timing Badges */}
                  <View style={styles.kdsBadgeTagsRow}>
                    {order.isFacultyExpress && (
                      <View style={styles.facultyOrderTag}>
                        <Text style={styles.facultyOrderTagText}>⭐ FACULTY EXPRESS PRIORITY</Text>
                      </View>
                    )}
                    {order.pickupSlot && order.pickupSlot !== 'ASAP' && (
                      <View style={styles.orderSlotTag}>
                        <Text style={styles.orderSlotTagText}>⏰ {order.pickupSlot}</Text>
                      </View>
                    )}
                    {order.groupCollectorName ? (
                      <View style={styles.orderCollectorTag}>
                        <Text style={styles.orderCollectorTagText}>👥 Collector: {order.groupCollectorName}</Text>
                      </View>
                    ) : null}
                  </View>

                  {order.facultyRoomNote ? (
                    <View style={styles.facultyDeliveryBox}>
                      <Text style={styles.facultyDeliveryText}>🏫 Staff Room: {order.facultyRoomNote}</Text>
                    </View>
                  ) : null}

                  {/* Action Buttons */}
                  <View style={styles.kdsActionsColumn}>
                    {isPreparing && (
                      <TouchableOpacity
                        style={styles.kdsActionBtnPrimary}
                        onPress={() => {
                          announceTokenReady(order.tokenNumber, currentShop.name);
                          markOrderReady(order.id);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.kdsBtnTextPrimary}>🔔  Call Token & Mark Ready</Text>
                      </TouchableOpacity>
                    )}

                    {isReady && (
                      <View style={styles.verifyButtonPair}>
                        <TouchableOpacity
                          style={styles.kdsActionBtnVerify}
                          onPress={() => {
                            setOrderToVerify(order);
                            setPinInput('');
                            setPinError('');
                            setVerifyModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.kdsBtnTextPrimary}>✅  Verify PIN</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.kdsActionBtnScan}
                          onPress={() => {
                            setOrderToVerify(order);
                            setQrScanModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.kdsBtnTextScan}>📷  Scan QR</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!isCompleted && !isCancelled && !isAbandoned && (
                      <View style={styles.kdsSecondaryRow}>
                        <TouchableOpacity
                          style={styles.kdsActionBtnCancel}
                          onPress={() => handleSellerCancel(order.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.kdsBtnTextCancel}>❌ Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.kdsActionBtnNoShow}
                          onPress={() => handleMarkAbandoned(order.id, order.buyerName)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.kdsBtnTextNoShow}>🚨 No-Show</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {(isCompleted || isCancelled || isAbandoned) && (
                      <View style={styles.completedStatusChip}>
                        <Text style={styles.completedStatus}>
                          {isCompleted
                            ? '✅ Completed & Picked Up'
                            : isCancelled
                            ? '❌ Cancelled & Refunded'
                            : '🚨 Abandoned (No-Show Penalty)'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 2: MENU INVENTORY MANAGEMENT                   */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'menu' && (
        <View style={styles.panel}>
          {/* Header & Add Dish */}
          <View style={styles.menuHeader}>
            <View>
              <Text style={styles.panelTitle}>📋 Live Menu</Text>
              <Text style={styles.panelSub}>Manage dishes, prices & availability</Text>
            </View>
            <TouchableOpacity style={styles.addDishBtn} onPress={onOpenAddItemModal} activeOpacity={0.85}>
              <Text style={styles.addDishBtnText}>+ Add Dish</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes..."
              placeholderTextColor="#64748b"
              value={menuSearch}
              onChangeText={setMenuSearch}
            />
            {menuSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMenuSearch('')} style={styles.searchClearBtn}>
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollRow}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryPill, categoryFilter === cat && styles.categoryPillActive]}
                onPress={() => setCategoryFilter(cat)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryPillText, categoryFilter === cat && styles.categoryPillTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Inventory Health Stats */}
          <View style={styles.inventoryStatsRow}>
            <View style={styles.inventoryStatChip}>
              <Text style={styles.inventoryStatNum}>{menuItems.length}</Text>
              <Text style={styles.inventoryStatLabel}>Total</Text>
            </View>
            <View style={[styles.inventoryStatChip, { borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Text style={[styles.inventoryStatNum, { color: '#10b981' }]}>{inStockCount}</Text>
              <Text style={styles.inventoryStatLabel}>🟢 In Stock</Text>
            </View>
            <View style={[styles.inventoryStatChip, { borderColor: 'rgba(244, 63, 94, 0.3)' }]}>
              <Text style={[styles.inventoryStatNum, { color: '#f43f5e' }]}>{outOfStockCount}</Text>
              <Text style={styles.inventoryStatLabel}>⚪ Sold Out</Text>
            </View>
          </View>

          {/* Menu Item Cards */}
          {menuItems.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>🍳</Text>
              <Text style={styles.noOrdersText}>No dishes in menu yet.</Text>
              <TouchableOpacity style={styles.addFirstDishBtn} onPress={onOpenAddItemModal}>
                <Text style={styles.addFirstDishText}>+ Add Your First Dish</Text>
              </TouchableOpacity>
            </View>
          ) : filteredMenu.length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>🔍</Text>
              <Text style={styles.noOrdersText}>No dishes match your search or filter.</Text>
              <TouchableOpacity
                style={styles.addFirstDishBtn}
                onPress={() => { setMenuSearch(''); setCategoryFilter('All'); }}
              >
                <Text style={styles.addFirstDishText}>Clear Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredMenu.map(item => (
              <View key={item.id} style={[styles.menuCard, !item.isAvailable && styles.menuCardSoldOut]}>
                {/* Card Top: Image + Info */}
                <View style={styles.menuCardTopRow}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.menuCardImage} />
                  ) : (
                    <View style={styles.menuCardImagePlaceholder}>
                      <Text style={{ fontSize: 22 }}>🍽️</Text>
                    </View>
                  )}
                  <View style={styles.menuCardInfo}>
                    <View style={styles.menuCardNameRow}>
                      <Text style={styles.menuCardName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.dietTag, !item.isVeg && styles.dietTagNonVeg]}>
                        <Text style={styles.dietTagText}>{item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                      </View>
                    </View>
                    <View style={styles.menuCardMetaRow}>
                      <View style={styles.categoryChip}>
                        <Text style={styles.categoryChipText}>{item.category || 'Snacks'}</Text>
                      </View>
                      <Text style={styles.prepTimeText}>⏳ {item.prepTime || '5 mins'}</Text>
                    </View>
                  </View>
                </View>

                {/* Card Middle: Price + Stock */}
                <View style={styles.menuCardMiddleRow}>
                  <View style={styles.priceEditWrap}>
                    <Text style={styles.priceLabel}>₹</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      defaultValue={String(item.price)}
                      onEndEditing={e => updateItemPrice(currentShop.id, item.id, e.nativeEvent.text)}
                    />
                  </View>

                  <View style={styles.stockSwitchWrap}>
                    <Text
                      style={[
                        styles.stockLabel,
                        { color: item.isAvailable ? '#10b981' : '#f43f5e' }
                      ]}
                    >
                      {item.isAvailable ? '🟢 IN STOCK' : '⚪ SOLD OUT'}
                    </Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={() => toggleItemStock(currentShop.id, item.id)}
                      trackColor={{ false: '#f43f5e', true: '#10b981' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>

                {/* Card Bottom: Actions */}
                <View style={styles.menuCardActionRow}>
                  <TouchableOpacity
                    style={styles.editDishBtn}
                    onPress={() => onOpenEditItemModal(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.editDishBtnText}>✏️  Edit Dish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteDishBtn}
                    onPress={() => handleDeleteDish(item.id, item.name)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deleteDishBtnText}>🗑️  Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/* TAB 3: ANALYTICS & SETTINGS                        */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>📊 Canteen Performance</Text>
          <Text style={styles.panelSub}>Real-time stats for {currentShop.name}</Text>

          <View style={styles.analyticsGrid}>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsVal}>₹{totalRevenue.toFixed(0)}</Text>
              <Text style={styles.analyticsLabel}>Total Revenue (Completed)</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={styles.analyticsVal}>{shopOrders.length}</Text>
              <Text style={styles.analyticsLabel}>Total Orders Received</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#10b981' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Completed').length}
              </Text>
              <Text style={styles.analyticsLabel}>Completed Handoffs</Text>
            </View>
            <View style={styles.analyticsCard}>
              <Text style={[styles.analyticsVal, { color: '#f43f5e' }]}>
                {shopOrders.filter(o => o.orderStatus === 'Abandoned').length}
              </Text>
              <Text style={styles.analyticsLabel}>Unclaimed / No-Shows</Text>
            </View>
          </View>

          {/* Canteen Info Card */}
          <Text style={[styles.panelTitle, { marginTop: 20 }]}>⚙️ Canteen Details</Text>
          <View style={styles.canteenInfoCard}>
            <Text style={styles.infoLine}>📍 Location: {currentShop.location}</Text>
            <Text style={styles.infoLine}>⏰ Hours: {currentShop.openingHours || '08:00 AM - 10:00 PM'}</Text>
            <Text style={styles.infoLine}>💳 Merchant UPI: {currentShop.upiId || 'canteen@upi'}</Text>
            <Text style={styles.infoLine}>📞 Phone: {currentShop.phone || '+91 98765 00000'}</Text>
          </View>

          {/* Delete Canteen Option */}
          <TouchableOpacity style={styles.deleteCanteenBtn} onPress={handleDeleteCurrentCanteen}>
            <Text style={styles.deleteCanteenText}>🗑️ Delete This Canteen Counter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Canteen Switcher Modal */}
      <Modal visible={canteenPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Canteen Stall to Manage</Text>
              <TouchableOpacity onPress={() => setCanteenPickerVisible(false)}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={campusCanteens}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.canteenChoice, sellerShopId === item.id && styles.canteenChoiceActive]}
                  onPress={() => {
                    setSellerShopId(item.id);
                    setCanteenPickerVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.canteenChoiceName, sellerShopId === item.id && styles.canteenChoiceNameActive]}>
                      🏪 {item.name}
                    </Text>
                    <Text style={styles.canteenChoiceLoc}>📍 {item.location}</Text>
                  </View>
                  {sellerShopId === item.id && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.modalCreateBtn}
              onPress={() => {
                setCanteenPickerVisible(false);
                onOpenCreateCanteenModal();
              }}
            >
              <Text style={styles.modalCreateText}>+ Register New Campus Canteen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Handover PIN Verification Modal */}
      <Modal visible={verifyModalVisible} transparent animationType="fade" onRequestClose={() => setVerifyModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.verifyModalContent}>
            <View style={styles.verifyModalHeader}>
              <View>
                <Text style={styles.verifyModalTitle}>🔐 Counter Handover</Text>
                <Text style={styles.verifyModalSub}>
                  Token: {orderToVerify?.tokenNumber} • {orderToVerify?.buyerName}
                </Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setVerifyModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.verifyPinBox}>
              <Text style={styles.verifyInstruction}>
                Ask student for their 4-digit Digital Pass PIN:
              </Text>
              <TextInput
                style={styles.pinInputField}
                placeholder="4-digit PIN"
                placeholderTextColor="#64748b"
                keyboardType="number-pad"
                maxLength={4}
                value={pinInput}
                onChangeText={(val) => {
                  setPinInput(val);
                  setPinError('');
                }}
              />
              {pinError ? <Text style={styles.pinErrorText}>⚠️ {pinError}</Text> : null}
            </View>

            <View style={styles.verifyBtnRow}>
              <TouchableOpacity
                style={styles.verifyConfirmBtn}
                onPress={async () => {
                  if (!orderToVerify) return;
                  try {
                    await verifyAndCompleteOrder(orderToVerify.id, pinInput);
                    setVerifyModalVisible(false);
                    setOrderToVerify(null);
                    Alert.alert('Order Handed Over', `Token ${orderToVerify.tokenNumber} marked completed.`);
                  } catch (e) {
                    setPinError(e.message);
                  }
                }}
              >
                <Text style={styles.verifyConfirmText}>Verify PIN & Complete 🚀</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bypassBtn}
                onPress={async () => {
                  if (!orderToVerify) return;
                  await markOrderCompleted(orderToVerify.id);
                  setVerifyModalVisible(false);
                  setOrderToVerify(null);
                  Alert.alert('Order Handed Over', `Token ${orderToVerify.tokenNumber} marked completed (Manual override).`);
                }}
              >
                <Text style={styles.bypassBtnText}>Manual Vendor Handover</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fast QR Scan & Handover Modal */}
      <Modal visible={qrScanModalVisible} transparent animationType="slide" onRequestClose={() => setQrScanModalVisible(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
          <View style={styles.qrModalContent}>
            <View style={styles.verifyModalHeader}>
              <View>
                <Text style={styles.verifyModalTitle}>📷 QR Fast Scan & Handover</Text>
                <Text style={styles.verifyModalSub}>Point counter camera or tap ready ticket</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setQrScanModalVisible(false)}>
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Viewfinder simulation */}
            <View style={styles.viewfinderBox}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
              <View style={styles.laserScanLine} />
              <Text style={styles.viewfinderText}>Align pickup QR code in frame</Text>
            </View>

            {/* Target Order 1-Tap Verification */}
            {orderToVerify && (
              <View style={styles.fastMatchCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fastMatchToken}>TOKEN #{orderToVerify.tokenNumber}</Text>
                  <Text style={styles.fastMatchBuyer}>{orderToVerify.buyerName} • ₹{orderToVerify.totalAmount}</Text>
                  <Text style={styles.fastMatchPin}>PIN: {orderToVerify.pickupPin}</Text>
                </View>
                <TouchableOpacity
                  style={styles.fastMatchBtn}
                  onPress={async () => {
                    await markOrderCompleted(orderToVerify.id);
                    setQrScanModalVisible(false);
                    setOrderToVerify(null);
                    Alert.alert('✅ QR Verified!', `Token ${orderToVerify.tokenNumber} handed over successfully.`);
                  }}
                >
                  <Text style={styles.fastMatchBtnText}>⚡ 1-Tap Complete</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Quick list of other ready tokens */}
            <Text style={styles.readyListHeader}>OR TAP OTHER READY ORDERS:</Text>
            <ScrollView style={{ maxHeight: 140 }}>
              {activeOrders.filter(o => o.orderStatus === 'Ready for Pickup' || o.orderStatus === 'Ready').map(rOrd => (
                <TouchableOpacity
                  key={rOrd.id}
                  style={styles.quickReadyRow}
                  onPress={async () => {
                    await markOrderCompleted(rOrd.id);
                    setQrScanModalVisible(false);
                    Alert.alert('✅ Order Collected', `Token ${rOrd.tokenNumber} verified & handed over.`);
                  }}
                >
                  <Text style={styles.quickReadyToken}>#{rOrd.tokenNumber}</Text>
                  <Text style={styles.quickReadyBuyer} numberOfLines={1}>{rOrd.buyerName}</Text>
                  <Text style={styles.quickReadyAction}>Collect ➔</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800' },
  emptySub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginVertical: 8 },
  createFirstBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  createFirstBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },

  // — Seller Header —
  sellerHeader: {
    backgroundColor: 'rgba(20, 30, 50, 0.75)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sellerCampusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  sellerCampusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  sellerCampusText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  canteenSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 3,
    flexWrap: 'wrap',
  },
  shopTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  switchPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  switchPillText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '800',
  },
  shopLoc: {
    color: '#94a3b8',
    fontSize: 11,
  },
  newCanteenBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  newCanteenBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#11192e',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statBoxActive: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
  },
  statBoxRevenue: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
  },
  statBoxMenu: {
    borderColor: 'rgba(56, 189, 248, 0.3)',
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  statVal: {
    fontSize: 17,
    fontWeight: '900',
  },
  statLbl: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },

  // — Segmented Sub-Tab Bar —
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  subTabBtnActive: {
    backgroundColor: '#6366f1',
  },
  subTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  subTabBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.8)',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  subTabBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },

  // — Panel —
  panel: {
    backgroundColor: '#131d33',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },

  // — Filter Pills —
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#6366f1',
  },
  filterPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },

  // — No Orders —
  noOrdersBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noOrdersEmoji: { fontSize: 32, marginBottom: 6 },
  noOrdersText: { color: '#94a3b8', fontSize: 12 },
  addFirstDishBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 10,
  },
  addFirstDishText: { color: '#090d16', fontWeight: '800', fontSize: 12 },

  // ═══════════════════════════
  // KDS Order Cards
  // ═══════════════════════════
  kdsCard: {
    backgroundColor: '#111a2f',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  kdsReadyCard: {
    borderLeftColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  kdsCompletedCard: {
    borderLeftColor: '#475569',
    opacity: 0.7,
  },
  kdsCancelledCard: {
    borderLeftColor: '#f43f5e',
    opacity: 0.7,
  },
  kdsAbandonedCard: {
    borderLeftColor: '#f59e0b',
    opacity: 0.7,
  },
  kdsCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tokenPill: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  tokenPillReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  tokenText: {
    color: '#22d3ee',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tokenTextReady: {
    color: '#34d399',
  },
  urgencyTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  urgencyTagReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  urgencyText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '800',
  },
  urgencyTextReady: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '800',
  },
  orderStudentName: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  orderTotalAmount: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  paymentChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  paymentChipText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '700',
  },

  // Items in order
  itemsList: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  itemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemQtyBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 10,
  },
  itemQtyText: {
    color: '#c7d2fe',
    fontWeight: '900',
    fontSize: 11,
  },
  itemText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  itemPriceSub: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  notesBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  notesLabel: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  notesText: {
    color: '#fef08a',
    fontSize: 12,
    marginTop: 2,
  },
  depositNotice: {
    color: '#22d3ee',
    fontSize: 10,
    marginTop: 8,
    fontWeight: '700',
  },

  // KDS Action Buttons
  kdsActionsColumn: {
    gap: 8,
  },
  kdsActionBtnPrimary: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kdsActionBtnVerify: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kdsBtnTextPrimary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  kdsSecondaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kdsActionBtnCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#f43f5e',
  },
  kdsBtnTextCancel: {
    color: '#f43f5e',
    fontSize: 12,
    fontWeight: '800',
  },
  kdsActionBtnNoShow: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  kdsBtnTextNoShow: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800',
  },
  completedStatusChip: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  completedStatus: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },

  // ═══════════════════════════
  // Menu Management
  // ═══════════════════════════
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  panelSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  addDishBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addDishBtnText: {
    color: '#090d16',
    fontSize: 12,
    fontWeight: '900',
  },

  // Search
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    paddingVertical: 10,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },

  // Category Filter
  categoryScrollRow: {
    marginBottom: 10,
    maxHeight: 36,
  },
  categoryPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#6366f1',
  },
  categoryPillText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  // Inventory Health Stats
  inventoryStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  inventoryStatChip: {
    flex: 1,
    backgroundColor: '#0b1120',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  inventoryStatNum: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
  inventoryStatLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },

  // Menu Card
  menuCard: {
    backgroundColor: '#111a2f',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  menuCardSoldOut: {
    opacity: 0.6,
    borderColor: 'rgba(244, 63, 94, 0.2)',
  },
  menuCardTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  menuCardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  menuCardImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  menuCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  menuCardName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  dietTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  dietTagNonVeg: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  dietTagText: {
    color: '#e2e8f0',
    fontSize: 9,
    fontWeight: '700',
  },
  menuCardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  categoryChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryChipText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '700',
  },
  prepTimeText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
  },

  // Menu Card Middle — Price + Stock
  menuCardMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  priceEditWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceLabel: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
  },
  priceInput: {
    backgroundColor: '#090d16',
    color: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: '800',
    minWidth: 55,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stockSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '900',
  },

  // Menu Card Bottom — Actions
  menuCardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editDishBtn: {
    flex: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  editDishBtnText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteDishBtn: {
    flex: 1,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  deleteDishBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '800',
  },

  // ═══════════════════════════
  // Analytics
  // ═══════════════════════════
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  analyticsCard: {
    flexBasis: '48%',
    backgroundColor: '#1a233a',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  analyticsVal: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  analyticsLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  canteenInfoCard: {
    backgroundColor: '#1a233a',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
  },
  infoLine: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  deleteCanteenBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  deleteCanteenText: {
    color: '#f87171',
    fontWeight: '700',
    fontSize: 12,
  },

  // ═══════════════════════════
  // Modals
  // ═══════════════════════════
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
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  closeBtn: {
    color: '#94a3b8',
    fontSize: 16,
    padding: 4,
  },
  canteenChoice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  canteenChoiceActive: {
    borderColor: '#6366f1',
    borderWidth: 1,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  canteenChoiceName: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  canteenChoiceNameActive: {
    color: '#ffffff',
  },
  canteenChoiceLoc: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    color: '#6366f1',
    fontWeight: '900',
    fontSize: 16,
  },
  modalCreateBtn: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalCreateText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },

  // PIN Verify Modal
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '800',
  },
  verifyModalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  verifyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  verifyModalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  verifyModalSub: {
    color: '#06b6d4',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  verifyPinBox: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  verifyInstruction: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  pinInputField: {
    backgroundColor: '#0b1120',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#6366f1',
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: 180,
  },
  pinErrorText: {
    color: '#f43f5e',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  verifyBtnRow: {
    gap: 8,
  },
  verifyConfirmBtn: {
    backgroundColor: '#10b981',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyConfirmText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  bypassBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  bypassBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rushBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rushBtnHeaderActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#f59e0b',
  },
  rushBtnIcon: {
    fontSize: 12,
  },
  rushBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
  },
  rushBtnTextActive: {
    color: '#f59e0b',
  },
  batchBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: 12,
    marginBottom: 12,
  },
  batchBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batchIcon: {
    fontSize: 14,
  },
  batchTitle: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  batchCountBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  batchCountText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '800',
  },
  batchToggle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  batchPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(245, 158, 11, 0.2)',
  },
  batchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  batchPillQty: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '900',
  },
  batchPillName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  kdsBadgeTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  facultyOrderTag: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  facultyOrderTagText: {
    color: '#f3e8ff',
    fontSize: 10,
    fontWeight: '900',
  },
  orderSlotTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  orderSlotTagText: {
    color: '#e0f2fe',
    fontSize: 10,
    fontWeight: '800',
  },
  orderCollectorTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  orderCollectorTagText: {
    color: '#a7f3d0',
    fontSize: 10,
    fontWeight: '800',
  },
  facultyDeliveryBox: {
    backgroundColor: 'rgba(147, 51, 234, 0.15)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)',
  },
  facultyDeliveryText: {
    color: '#f3e8ff',
    fontSize: 11,
    fontWeight: '700',
  },
  verifyButtonPair: {
    flexDirection: 'row',
    gap: 8,
  },
  kdsActionBtnScan: {
    flex: 1,
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kdsBtnTextScan: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  qrModalContent: {
    backgroundColor: '#0c1222',
    borderRadius: 20,
    padding: 18,
    width: '92%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  viewfinderBox: {
    height: 160,
    backgroundColor: '#070b14',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 12,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38bdf8',
  },
  cornerTR: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38bdf8',
  },
  cornerBL: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#38bdf8',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#38bdf8',
  },
  laserScanLine: {
    position: 'absolute',
    width: '80%',
    height: 2,
    backgroundColor: '#38bdf8',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  viewfinderText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 60,
  },
  fastMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  fastMatchToken: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '900',
  },
  fastMatchBuyer: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  fastMatchPin: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  fastMatchBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fastMatchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  readyListHeader: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  quickReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  quickReadyToken: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 10,
  },
  quickReadyBuyer: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
  },
  quickReadyAction: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
});


