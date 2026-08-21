import React, { useContext, useState } from 'react';
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
  FlatList
} from 'react-native';
import { AppContext } from '../context/AppContext';

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
    cancelOrder,
    markOrderAbandoned,
    university
  } = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'menu', 'analytics'
  const [orderFilter, setOrderFilter] = useState('active'); // 'active', 'completed'
  const [canteenPickerVisible, setCanteenPickerVisible] = useState(false);

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

  // Analytics Calculation
  const totalRevenue = shopOrders
    .filter(o => o.orderStatus === 'Completed')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

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
            <Text style={styles.shopMetaLabel}>LIVE CANTEEN DASHBOARD</Text>
            <TouchableOpacity
              style={styles.canteenSelectorBtn}
              onPress={() => setCanteenPickerVisible(true)}
            >
              <Text style={styles.shopTitle} numberOfLines={1}>
                🏪 {currentShop.name}
              </Text>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.shopLoc}>📍 {currentShop.location}</Text>
          </View>

          <TouchableOpacity style={styles.newCanteenBtn} onPress={onOpenCreateCanteenModal}>
            <Text style={styles.newCanteenBtnText}>+ New Stall</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{activeOrders.length}</Text>
            <Text style={styles.statLbl}>Active Kitchen</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#10b981' }]}>₹{totalRevenue.toFixed(0)}</Text>
            <Text style={styles.statLbl}>Revenue Today</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statVal, { color: '#06b6d4' }]}>{(currentShop.menu || []).length}</Text>
            <Text style={styles.statLbl}>Menu Dishes</Text>
          </View>
        </View>
      </View>

      {/* POS Sub-Navigation Tabs */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'orders' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.subTabText, activeTab === 'orders' && styles.subTabTextActive]}>
            🍳 Orders ({activeOrders.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'menu' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('menu')}
        >
          <Text style={[styles.subTabText, activeTab === 'menu' && styles.subTabTextActive]}>
            📋 Menu Management
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, activeTab === 'analytics' && styles.subTabBtnActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <Text style={[styles.subTabText, activeTab === 'analytics' && styles.subTabTextActive]}>
            📊 Analytics & Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* TAB 1: KITCHEN DISPLAY / ORDERS */}
      {activeTab === 'orders' && (
        <View style={styles.panel}>
          {/* Active / Completed Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[styles.filterPill, orderFilter === 'active' && styles.filterPillActive]}
              onPress={() => setOrderFilter('active')}
            >
              <Text style={[styles.filterPillText, orderFilter === 'active' && styles.filterPillTextActive]}>
                🔥 Live Kitchen ({activeOrders.length})
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

          {(orderFilter === 'active' ? activeOrders : completedOrders).length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>☕</Text>
              <Text style={styles.noOrdersText}>
                {orderFilter === 'active' ? 'No incoming orders right now.' : 'No past orders yet.'}
              </Text>
            </View>
          ) : (
            (orderFilter === 'active' ? activeOrders : completedOrders).map(order => {
              const isPreparing = order.orderStatus === 'Preparing';
              const isReady = order.orderStatus === 'Ready';
              const isCompleted = order.orderStatus === 'Completed';
              const isCancelled = order.orderStatus === 'Cancelled';
              const isAbandoned = order.orderStatus === 'Abandoned';

              return (
                <View
                  key={order.id}
                  style={[
                    styles.kdsCard,
                    isReady && styles.kdsReadyCard,
                    isCompleted && styles.kdsCompletedCard
                  ]}
                >
                  <View style={styles.kdsCardHeader}>
                    <View>
                      <Text style={styles.tokenText}>{order.tokenNumber}</Text>
                      <Text style={styles.orderStudentName}>
                        👤 {order.buyerName || 'Campus Student'}{' '}
                        {order.buyerRollNo ? `(${order.buyerRollNo})` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.orderTotalAmount}>₹{order.totalAmount}</Text>
                      <Text style={styles.paymentMethodTag}>
                        {order.paymentMethod === 'Cash' ? '💵 Cash / Takeout' : `📱 ${order.paymentMethod}`}
                      </Text>
                    </View>
                  </View>

                  {/* Items list */}
                  <View style={styles.itemsList}>
                    {(order.items || []).map((i, idx) => (
                      <View key={idx} style={styles.itemLine}>
                        <Text style={styles.itemQtyBadge}>x{i.qty}</Text>
                        <Text style={styles.itemText}>{i.name}</Text>
                        <Text style={styles.itemPriceSub}>₹{i.price * i.qty}</Text>
                      </View>
                    ))}

                    {/* Special Instructions */}
                    {order.specialInstructions ? (
                      <View style={styles.notesBox}>
                        <Text style={styles.notesLabel}>📝 NOTE:</Text>
                        <Text style={styles.notesText}>{order.specialInstructions}</Text>
                      </View>
                    ) : null}

                    {order.heldDepositAmount > 0 && isPreparing && (
                      <Text style={styles.depositNotice}>
                        🔒 10% Cash Security Deposit Held: ₹{order.heldDepositAmount}
                      </Text>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.kdsActionsRow}>
                    {isPreparing && (
                      <TouchableOpacity
                        style={[styles.kdsActionBtn, { backgroundColor: '#10b981' }]}
                        onPress={() => markOrderReady(order.id)}
                      >
                        <Text style={styles.kdsBtnText}>🔔 Mark Ready</Text>
                      </TouchableOpacity>
                    )}

                    {isReady && (
                      <TouchableOpacity
                        style={[styles.kdsActionBtn, { backgroundColor: '#6366f1' }]}
                        onPress={() => markOrderCompleted(order.id)}
                      >
                        <Text style={styles.kdsBtnText}>✅ Complete Handoff</Text>
                      </TouchableOpacity>
                    )}

                    {!isCompleted && !isCancelled && !isAbandoned && (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.kdsActionBtn,
                            {
                              backgroundColor: 'rgba(244, 63, 94, 0.15)',
                              borderWidth: 1,
                              borderColor: '#f43f5e'
                            }
                          ]}
                          onPress={() => handleSellerCancel(order.id)}
                        >
                          <Text style={[styles.kdsBtnText, { color: '#f43f5e' }]}>Cancel (Refund)</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.kdsActionBtn,
                            {
                              backgroundColor: 'rgba(245, 158, 11, 0.15)',
                              borderWidth: 1,
                              borderColor: '#f59e0b'
                            }
                          ]}
                          onPress={() => handleMarkAbandoned(order.id, order.buyerName)}
                        >
                          <Text style={[styles.kdsBtnText, { color: '#f59e0b' }]}>No-Show</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {(isCompleted || isCancelled || isAbandoned) && (
                      <Text style={styles.completedStatus}>
                        {isCompleted
                          ? '✅ Completed & Picked Up'
                          : isCancelled
                          ? '❌ Cancelled & Refunded'
                          : '🚨 Abandoned (No-Show Penalty)'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* TAB 2: MENU INVENTORY MANAGEMENT */}
      {activeTab === 'menu' && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>📋 Live Canteen Menu</Text>
              <Text style={styles.panelSub}>Toggle stock or tap edit to modify dish details</Text>
            </View>
            <TouchableOpacity style={styles.addItemBtn} onPress={onOpenAddItemModal}>
              <Text style={styles.addItemBtnText}>+ Add Dish</Text>
            </TouchableOpacity>
          </View>

          {(currentShop.menu || []).length === 0 ? (
            <View style={styles.noOrdersBox}>
              <Text style={styles.noOrdersEmoji}>🍳</Text>
              <Text style={styles.noOrdersText}>No dishes in menu yet.</Text>
              <TouchableOpacity style={styles.addFirstDishBtn} onPress={onOpenAddItemModal}>
                <Text style={styles.addFirstDishText}>+ Add Your First Dish</Text>
              </TouchableOpacity>
            </View>
          ) : (
            (currentShop.menu || []).map(item => (
              <View key={item.id} style={styles.inventoryRow}>
                <View style={styles.itemMeta}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.dietBadge}>{item.isVeg ? '🟢 Veg' : '🔴 Non-Veg'}</Text>
                  </View>

                  <View style={styles.priceEditRow}>
                    <Text style={styles.priceLabel}>Price (₹):</Text>
                    <TextInput
                      style={styles.priceInput}
                      keyboardType="numeric"
                      defaultValue={String(item.price)}
                      onEndEditing={e => updateItemPrice(currentShop.id, item.id, e.nativeEvent.text)}
                    />
                    <Text style={styles.prepText}>• ⏳ {item.prepTime || '5 mins'}</Text>
                    <Text style={styles.categoryBadge}>{item.category || 'Snacks'}</Text>
                  </View>
                </View>

                <View style={styles.itemActionsRight}>
                  <View style={styles.switchBox}>
                    <Text
                      style={[styles.stockLabel, { color: item.isAvailable ? '#10b981' : '#f43f5e' }]}
                    >
                      {item.isAvailable ? 'IN STOCK' : 'OUT'}
                    </Text>
                    <Switch
                      value={item.isAvailable}
                      onValueChange={() => toggleItemStock(currentShop.id, item.id)}
                      trackColor={{ false: '#f43f5e', true: '#10b981' }}
                      thumbColor="#ffffff"
                    />
                  </View>

                  <View style={styles.dishBtnRow}>
                    <TouchableOpacity
                      style={styles.editDishBtn}
                      onPress={() => onOpenEditItemModal(item)}
                    >
                      <Text style={styles.editDishBtnText}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteDishBtn}
                      onPress={() => handleDeleteDish(item.id, item.name)}
                    >
                      <Text style={styles.deleteDishBtnText}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* TAB 3: ANALYTICS & SETTINGS */}
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
  sellerHeader: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  shopMetaLabel: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  canteenSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  shopTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  dropdownIcon: {
    color: '#94a3b8',
    fontSize: 10,
  },
  shopLoc: {
    color: '#94a3b8',
    fontSize: 11,
  },
  newCanteenBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  newCanteenBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#131d33',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  statVal: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '900',
  },
  statLbl: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  subTabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 9,
    alignItems: 'center',
  },
  subTabBtnActive: {
    backgroundColor: '#6366f1',
  },
  subTabText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  subTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  panel: {
    backgroundColor: '#131d33',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  panelSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  addItemBtn: {
    backgroundColor: '#06b6d4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addItemBtnText: {
    color: '#090d16',
    fontSize: 11,
    fontWeight: '900',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: '#6366f1',
  },
  filterPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
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
  kdsCard: {
    backgroundColor: '#1a233a',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  kdsReadyCard: {
    borderLeftColor: '#10b981',
  },
  kdsCompletedCard: {
    borderLeftColor: '#64748b',
    opacity: 0.8,
  },
  kdsCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tokenText: {
    color: '#06b6d4',
    fontSize: 16,
    fontWeight: '900',
  },
  orderStudentName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  orderTotalAmount: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  paymentMethodTag: {
    color: '#94a3b8',
    fontSize: 10,
  },
  itemsList: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  itemLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  itemQtyBadge: {
    backgroundColor: '#6366f1',
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginRight: 6,
  },
  itemText: {
    color: '#f8fafc',
    fontSize: 12,
    flex: 1,
  },
  itemPriceSub: {
    color: '#94a3b8',
    fontSize: 11,
  },
  notesBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderLeftWidth: 2,
    borderLeftColor: '#f59e0b',
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
  },
  notesLabel: {
    color: '#f59e0b',
    fontSize: 9,
    fontWeight: '800',
  },
  notesText: {
    color: '#f8fafc',
    fontSize: 11,
  },
  depositNotice: {
    color: '#06b6d4',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  kdsActionsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  kdsActionBtn: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kdsBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  completedStatus: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
  },
  inventoryRow: {
    backgroundColor: '#1a233a',
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemMeta: {
    flex: 1,
  },
  itemName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
  },
  dietBadge: {
    fontSize: 9,
    color: '#94a3b8',
  },
  priceEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  priceLabel: {
    color: '#94a3b8',
    fontSize: 10,
  },
  priceInput: {
    backgroundColor: '#090d16',
    color: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 11,
    fontWeight: '800',
    minWidth: 45,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  prepText: {
    color: '#64748b',
    fontSize: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#a5b4fc',
    fontSize: 9,
    fontWeight: '700',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  itemActionsRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  switchBox: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 8,
    fontWeight: '900',
  },
  dishBtnRow: {
    flexDirection: 'row',
    gap: 6,
  },
  editDishBtn: {
    padding: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  editDishBtnText: {
    fontSize: 12,
  },
  deleteDishBtn: {
    padding: 4,
    backgroundColor: '#1e293b',
    borderRadius: 6,
  },
  deleteDishBtnText: {
    fontSize: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  analyticsCard: {
    flexBasis: '48%',
    backgroundColor: '#1a233a',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  analyticsVal: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  analyticsLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  canteenInfoCard: {
    backgroundColor: '#1a233a',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 6,
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
});
