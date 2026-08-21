import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { DEFAULT_UNIVERSITIES, INITIAL_CANTEENS, SAMPLE_ORDERS } from '../data/mockData';
import { getDistanceInMeters, MAX_ORDER_DISTANCE_METERS } from '../utils/distance';
import { playOrderPlacedSound, playOrderReadyBuzzer, playNewTicketChime } from '../utils/audio';
import { broadcastEvent, subscribeToRealtimeEvents, SYNC_EVENTS } from '../utils/sync';

export const AppContext = createContext();

const STORAGE_KEYS = {
  UNIVERSITY: '@skipq_uni',
  ROLE: '@skipq_role',
  SELLER_SHOP_ID: '@skipq_seller_shop',
  CANTEENS: '@skipq_canteens_v2',
  ORDERS: '@skipq_orders_v2',
  ACTIVE_PASS: '@skipq_active_pass_v2',
  USER_WALLET: '@skipq_wallet_bal_v2',
  USER_PROFILE: '@skipq_user_profile_v2',
  UNCLAIMED_COUNT: '@skipq_unclaimed_cnt_v2',
  BAN_STATUS: '@skipq_ban_status_v2',
  BAN_UNTIL: '@skipq_ban_until_v2',
  ONBOARDING_DONE: '@skipq_onboarding_done_v3'
};

const DEFAULT_PROFILE = {
  name: 'Campus Student',
  rollNo: '',
  phone: '',
  email: ''
};

export const AppProvider = ({ children }) => {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(null); // null while loading
  const [university, setUniversityState] = useState('iitb');
  const [role, setRoleState] = useState('buyer'); // 'buyer' or 'seller'
  const [sellerShopId, setSellerShopIdState] = useState('shop-101');
  const [canteens, setCanteensState] = useState(INITIAL_CANTEENS);
  const [orders, setOrdersState] = useState(SAMPLE_ORDERS);
  const [activeOrderId, setActiveOrderIdState] = useState('SQ-1042');
  const [userProfile, setUserProfileState] = useState(DEFAULT_PROFILE);

  // Cart State (for multi-item orders)
  const [cart, setCartState] = useState({ shopId: null, shopName: null, items: [], specialInstructions: '' });

  // Location & Wallet State
  const [userLocation, setUserLocation] = useState({ lat: 19.1334, lng: 72.9133 }); // default near IITB center
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [walletBalance, setWalletBalance] = useState(500); // ₹500 starting balance
  const [unclaimedOrderCount, setUnclaimedOrderCount] = useState(0);
  const [banStatus, setBanStatus] = useState('active'); // 'active' | 'temp_ban' | 'perm_ban'
  const [banUntil, setBanUntil] = useState(null);

  useEffect(() => {
    loadStoredData();
    requestUserLocation();

    // Cross-tab realtime event synchronization
    const unsubscribe = subscribeToRealtimeEvents((event) => {
      if (!event || !event.type) return;

      if (event.type === SYNC_EVENTS.ORDER_CREATED) {
        const newOrd = event.payload;
        setOrdersState(prev => {
          if (prev.some(o => o.id === newOrd.id)) return prev;
          return [newOrd, ...prev];
        });
        playNewTicketChime();
      } else if (event.type === SYNC_EVENTS.ORDER_STATUS_CHANGED) {
        const { orderId, orderStatus } = event.payload;
        setOrdersState(prev => prev.map(o => (o.id === orderId ? { ...o, orderStatus } : o)));

        if (orderStatus === 'Ready' || orderStatus === 'Ready for Pickup') {
          playOrderReadyBuzzer();
        }
      } else if (event.type === SYNC_EVENTS.CANTEEN_UPDATED) {
        if (event.payload?.canteens) {
          setCanteensState(event.payload.canteens);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const requestUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc && loc.coords) {
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude
          });
        }
      }
    } catch (e) {
      console.log('Location request note:', e);
    }
  };

  const loadStoredData = async () => {
    try {
      const onboarded = await AsyncStorage.getItem(STORAGE_KEYS.ONBOARDING_DONE);
      setIsOnboardingComplete(onboarded === 'true');

      const u = await AsyncStorage.getItem(STORAGE_KEYS.UNIVERSITY);
      if (u) setUniversityState(u);

      const r = await AsyncStorage.getItem(STORAGE_KEYS.ROLE);
      if (r) setRoleState(r);

      const s = await AsyncStorage.getItem(STORAGE_KEYS.SELLER_SHOP_ID);
      if (s) setSellerShopIdState(s);

      const c = await AsyncStorage.getItem(STORAGE_KEYS.CANTEENS);
      if (c) setCanteensState(JSON.parse(c));

      const o = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
      if (o) setOrdersState(JSON.parse(o));

      const a = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PASS);
      if (a) setActiveOrderIdState(a);

      const w = await AsyncStorage.getItem(STORAGE_KEYS.USER_WALLET);
      if (w) setWalletBalance(parseFloat(w));

      const p = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      if (p) setUserProfileState(JSON.parse(p));

      const uc = await AsyncStorage.getItem(STORAGE_KEYS.UNCLAIMED_COUNT);
      if (uc) setUnclaimedOrderCount(parseInt(uc, 10));

      const bs = await AsyncStorage.getItem(STORAGE_KEYS.BAN_STATUS);
      if (bs) setBanStatus(bs);

      const bu = await AsyncStorage.getItem(STORAGE_KEYS.BAN_UNTIL);
      if (bu) setBanUntil(bu);
    } catch (e) {
      console.log('Error loading AsyncStorage:', e);
      setIsOnboardingComplete(false);
    }
  };

  const completeOnboarding = async ({ chosenRole, chosenUniversity, profileData, vendorCanteenData }) => {
    setRoleState(chosenRole);
    setUniversityState(chosenUniversity);

    if (profileData) {
      const mergedProfile = { ...userProfile, ...profileData };
      setUserProfileState(mergedProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(mergedProfile));
    }

    if (chosenRole === 'seller' && vendorCanteenData) {
      const newId = 'shop-' + Date.now().toString().slice(-4);
      const newCanteen = {
        id: newId,
        universityId: chosenUniversity,
        name: vendorCanteenData.name || 'My Campus Canteen',
        location: vendorCanteenData.location || 'Campus Counter #1',
        openingHours: vendorCanteenData.openingHours || '08:00 AM - 10:00 PM',
        upiId: vendorCanteenData.upiId || 'merchant.canteen@upi',
        phone: vendorCanteenData.phone || '+91 98765 00000',
        rating: 5.0,
        reviewsCount: 1,
        status: 'Open',
        currentQueue: 0,
        avgWaitMins: 5,
        lat: userLocation.lat,
        lng: userLocation.lng,
        banner: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
        tags: vendorCanteenData.tags || ['Campus Canteen'],
        menu: vendorCanteenData.initialMenu || []
      };

      const updatedCanteens = [newCanteen, ...canteens];
      setCanteensState(updatedCanteens);
      setSellerShopIdState(newId);
      await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updatedCanteens));
      await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, newId);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ROLE, chosenRole);
    await AsyncStorage.setItem(STORAGE_KEYS.UNIVERSITY, chosenUniversity);
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDING_DONE, 'true');
    setIsOnboardingComplete(true);
  };

  const restartOnboarding = async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.ONBOARDING_DONE);
    setIsOnboardingComplete(false);
  };

  const updateUserProfile = async (newProfile) => {
    const updated = { ...userProfile, ...newProfile };
    setUserProfileState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updated));
  };

  const setUniversity = async (uniId) => {
    setUniversityState(uniId);
    await AsyncStorage.setItem(STORAGE_KEYS.UNIVERSITY, uniId);

    // Auto sync location with campus coordinates for smooth interactive demo
    const targetUni = DEFAULT_UNIVERSITIES.find(u => u.id === uniId);
    if (targetUni) {
      setUserLocation({ lat: targetUni.lat, lng: targetUni.lng });
    }
  };

  const setRole = async (r) => {
    setRoleState(r);
    await AsyncStorage.setItem(STORAGE_KEYS.ROLE, r);
  };

  const setSellerShopId = async (shopId) => {
    setSellerShopIdState(shopId);
    await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, shopId);
  };

  // --- Real Canteen Management ---
  const addCanteen = async (canteenData) => {
    const newId = 'shop-' + Date.now().toString().slice(-4);
    const newCanteen = {
      id: newId,
      universityId: university,
      rating: 5.0,
      reviewsCount: 1,
      status: 'Open',
      currentQueue: 0,
      avgWaitMins: 5,
      menu: [],
      tags: ['Campus Canteen'],
      lat: userLocation.lat,
      lng: userLocation.lng,
      ...canteenData
    };

    const updated = [newCanteen, ...canteens];
    setCanteensState(updated);
    setSellerShopIdState(newId);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, newId);
    return newCanteen;
  };

  const updateCanteen = async (shopId, updatedFields) => {
    const updated = canteens.map(shop => (shop.id === shopId ? { ...shop, ...updatedFields } : shop));
    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
  };

  const deleteCanteen = async (shopId) => {
    const updated = canteens.filter(shop => shop.id !== shopId);
    setCanteensState(updated);
    if (sellerShopId === shopId && updated.length > 0) {
      setSellerShopIdState(updated[0].id);
      await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, updated[0].id);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
  };

  // --- Real Menu Management ---
  const addMenuItem = async (shopId, newItem) => {
    const id = 'item-' + Date.now().toString().slice(-4);
    const itemToAdd = {
      id,
      name: newItem.name.trim(),
      category: newItem.category || 'Snacks',
      price: parseFloat(newItem.price) || 50,
      prepTime: newItem.prepTime || '5 mins',
      isAvailable: true,
      isVeg: newItem.isVeg !== undefined ? newItem.isVeg : true,
      description: newItem.description || 'Freshly prepared at counter.'
    };

    const updated = canteens.map(shop => {
      if (shop.id === shopId) {
        return { ...shop, menu: [itemToAdd, ...(shop.menu || [])] };
      }
      return shop;
    });

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    return itemToAdd;
  };

  const updateMenuItem = async (shopId, itemId, updatedItem) => {
    const updated = canteens.map(shop => {
      if (shop.id === shopId) {
        const updatedMenu = shop.menu.map(item => {
          if (item.id === itemId) {
            return {
              ...item,
              ...updatedItem,
              price: updatedItem.price !== undefined ? parseFloat(updatedItem.price) : item.price
            };
          }
          return item;
        });
        return { ...shop, menu: updatedMenu };
      }
      return shop;
    });

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
  };

  const deleteMenuItem = async (shopId, itemId) => {
    const updated = canteens.map(shop => {
      if (shop.id === shopId) {
        return { ...shop, menu: shop.menu.filter(item => item.id !== itemId) };
      }
      return shop;
    });

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
  };

  const toggleItemStock = async (shopId, itemId) => {
    const updated = canteens.map(shop => {
      if (shop.id === shopId) {
        const updatedMenu = shop.menu.map(item => {
          if (item.id === itemId) {
            return { ...item, isAvailable: !item.isAvailable };
          }
          return item;
        });
        return { ...shop, menu: updatedMenu };
      }
      return shop;
    });

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
  };

  // --- Cart System ---
  const addToCart = (shop, item) => {
    if (cart.shopId && cart.shopId !== shop.id) {
      // Switching shops -> replace cart with new shop item
      setCartState({
        shopId: shop.id,
        shopName: shop.name,
        specialInstructions: '',
        items: [{ ...item, qty: 1 }]
      });
      return;
    }

    const existingIndex = cart.items.findIndex(i => i.id === item.id);
    let newItems = [];
    if (existingIndex > -1) {
      newItems = cart.items.map((it, idx) => (idx === existingIndex ? { ...it, qty: it.qty + 1 } : it));
    } else {
      newItems = [...cart.items, { ...item, qty: 1 }];
    }

    setCartState({
      shopId: shop.id,
      shopName: shop.name,
      specialInstructions: cart.specialInstructions,
      items: newItems
    });
  };

  const updateCartQty = (itemId, change) => {
    let newItems = cart.items
      .map(it => {
        if (it.id === itemId) {
          const newQty = it.qty + change;
          return newQty > 0 ? { ...it, qty: newQty } : null;
        }
        return it;
      })
      .filter(Boolean);

    if (newItems.length === 0) {
      setCartState({ shopId: null, shopName: null, items: [], specialInstructions: '' });
    } else {
      setCartState({ ...cart, items: newItems });
    }
  };

  const setSpecialInstructions = (notes) => {
    setCartState(prev => ({ ...prev, specialInstructions: notes }));
  };

  const clearCart = () => {
    setCartState({ shopId: null, shopName: null, items: [], specialInstructions: '' });
  };

  // --- Place Order (Real Flow with Geofencing + 10% Cash Deposit) ---
  const placeOrder = async (orderData) => {
    // 1. Check Ban Status
    if (banStatus === 'perm_ban') {
      throw new Error('YOUR ACCOUNT IS PERMANENTLY BANNED due to repeated uncollected/unclaimed orders.');
    }
    if (banStatus === 'temp_ban') {
      if (banUntil && new Date().getTime() < new Date(banUntil).getTime()) {
        const remainingDays = Math.ceil((new Date(banUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        throw new Error(`ACCOUNT TEMPORARILY BANNED for ${remainingDays} days due to an uncollected order.`);
      } else {
        setBanStatus('active');
        await AsyncStorage.setItem(STORAGE_KEYS.BAN_STATUS, 'active');
      }
    }

    // 2. Distance Rule Verification (300m threshold)
    const targetShop = canteens.find(c => c.id === orderData.shopId);
    if (targetShop && targetShop.lat && targetShop.lng) {
      const distMeters = getDistanceInMeters(userLocation.lat, userLocation.lng, targetShop.lat, targetShop.lng);
      if (distMeters > MAX_ORDER_DISTANCE_METERS) {
        throw new Error(`ORDER BLOCKED: You are ${distMeters}m away from ${targetShop.name} (>300m limit). You must be near the canteen to order.`);
      }
    }

    // 3. Pay After Takeout (Cash) -> Hold 10% Security Deposit from Wallet
    let heldDepositAmount = 0;
    if (orderData.paymentMethod === 'Cash') {
      heldDepositAmount = Math.ceil(orderData.totalAmount * 0.10);
      if (walletBalance < heldDepositAmount) {
        throw new Error(`INSUFFICIENT WALLET BALANCE: Cash orders require a ₹${heldDepositAmount} (10%) refundable security deposit. Your wallet balance is ₹${walletBalance}. Please top up wallet or pay via UPI.`);
      }

      const newBal = walletBalance - heldDepositAmount;
      setWalletBalance(newBal);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(newBal));
    }

    const tokenNum = 'SQ-' + Math.floor(10 + Math.random() * 90);
    const newOrder = {
      id: 'SQ-' + Date.now().toString().slice(-4),
      tokenNumber: tokenNum,
      timestamp: new Date().toISOString(),
      orderStatus: 'Preparing',
      buyerName: userProfile.name || 'Campus Student',
      buyerPhone: userProfile.phone || '',
      buyerRollNo: userProfile.rollNo || '',
      heldDepositAmount,
      ...orderData
    };

    const updatedOrders = [newOrder, ...orders];
    setOrdersState(updatedOrders);
    setActiveOrderIdState(newOrder.id);
    clearCart();

    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PASS, newOrder.id);

    // Trigger order placed sound and broadcast
    playOrderPlacedSound();
    broadcastEvent(SYNC_EVENTS.ORDER_CREATED, newOrder);

    return newOrder;
  };

  const markOrderReady = async (orderId) => {
    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Ready for Pickup' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    playOrderReadyBuzzer();
    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, { orderId, orderStatus: 'Ready for Pickup' });
  };

  const markOrderCompleted = async (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    let newWalletBal = walletBalance;
    if (targetOrder.heldDepositAmount > 0) {
      newWalletBal = walletBalance + targetOrder.heldDepositAmount;
      setWalletBalance(newWalletBal);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(newWalletBal));
    }

    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Completed' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, { orderId, orderStatus: 'Completed' });
  };

  // Re-order past order: populate cart with exact items & shop
  const reorderItems = (orderId) => {
    const pastOrder = orders.find(o => o.id === orderId);
    if (!pastOrder || !pastOrder.items || pastOrder.items.length === 0) return;

    const matchedCanteen = canteens.find(c => c.id === pastOrder.shopId || c.name === pastOrder.shopName) || {
      id: pastOrder.shopId || 'shop-101',
      name: pastOrder.canteenName || pastOrder.shopName || 'Campus Canteen'
    };

    setCartState({
      shopId: matchedCanteen.id,
      shopName: matchedCanteen.name,
      specialInstructions: pastOrder.specialInstructions || '',
      items: pastOrder.items.map(it => ({ ...it, qty: it.qty || 1 }))
    });
  };

  // Rate an order & canteen
  const rateOrder = async (orderId, ratingVal, reviewText = '') => {
    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, rating: ratingVal, review: reviewText } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
  };

  const cancelOrder = async (orderId, cancelledBy = 'buyer') => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    let refundText = '';
    let newWalletBal = walletBalance;

    if (targetOrder.paymentMethod === 'Cash' && targetOrder.heldDepositAmount > 0) {
      newWalletBal = walletBalance + targetOrder.heldDepositAmount;
      setWalletBalance(newWalletBal);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(newWalletBal));
      refundText = `10% Security Deposit (₹${targetOrder.heldDepositAmount}) refunded to SkipQ Wallet.`;
    } else if (targetOrder.paymentMethod !== 'Cash') {
      refundText = `Full amount (₹${targetOrder.totalAmount}) refunded immediately to ${targetOrder.paymentMethod}.`;
    }

    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Cancelled', cancelledBy } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
    return refundText;
  };

  const markOrderAbandoned = async (orderId) => {
    const newUnclaimedCount = unclaimedOrderCount + 1;
    setUnclaimedOrderCount(newUnclaimedCount);
    await AsyncStorage.setItem(STORAGE_KEYS.UNCLAIMED_COUNT, String(newUnclaimedCount));

    let newBanStatus = banStatus;
    let newBanUntil = null;

    if (newUnclaimedCount === 1) {
      newBanStatus = 'temp_ban';
      const banDate = new Date();
      banDate.setDate(banDate.getDate() + 3);
      newBanUntil = banDate.toISOString();
      setBanStatus(newBanStatus);
      setBanUntil(newBanUntil);
      await AsyncStorage.setItem(STORAGE_KEYS.BAN_STATUS, newBanStatus);
      await AsyncStorage.setItem(STORAGE_KEYS.BAN_UNTIL, newBanUntil);
    } else if (newUnclaimedCount >= 2) {
      newBanStatus = 'perm_ban';
      setBanStatus(newBanStatus);
      await AsyncStorage.setItem(STORAGE_KEYS.BAN_STATUS, newBanStatus);
    }

    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Abandoned' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    return { newUnclaimedCount, newBanStatus, newBanUntil };
  };

  const topUpWallet = async (amount = 200) => {
    const newBal = walletBalance + amount;
    setWalletBalance(newBal);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(newBal));
  };

  const resetToSampleData = async () => {
    setCanteensState(INITIAL_CANTEENS);
    setOrdersState(SAMPLE_ORDERS);
    setUserProfileState(DEFAULT_PROFILE);
    setWalletBalance(500);
    setUnclaimedOrderCount(0);
    setBanStatus('active');
    setBanUntil(null);
    clearCart();

    await AsyncStorage.multiRemove([
      STORAGE_KEYS.CANTEENS,
      STORAGE_KEYS.ORDERS,
      STORAGE_KEYS.ACTIVE_PASS,
      STORAGE_KEYS.USER_WALLET,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.UNCLAIMED_COUNT,
      STORAGE_KEYS.BAN_STATUS,
      STORAGE_KEYS.BAN_UNTIL
    ]);
  };

  return (
    <AppContext.Provider
      value={{
        isOnboardingComplete, completeOnboarding, restartOnboarding,
        university, setUniversity,
        role, setRole,
        sellerShopId, setSellerShopId,
        userProfile, updateUserProfile,
        canteens, addCanteen, updateCanteen, deleteCanteen,
        addMenuItem, updateMenuItem, deleteMenuItem, toggleItemStock,
        cart, addToCart, updateCartQty, setSpecialInstructions, clearCart,
        orders, placeOrder, markOrderReady, markOrderCompleted, cancelOrder, markOrderAbandoned,
        reorderItems, rateOrder,
        activeOrderId, setActiveOrderIdState,
        userLocation, setUserLocation, requestUserLocation, locationPermissionGranted,
        walletBalance, topUpWallet, unclaimedOrderCount, banStatus, banUntil,
        resetToSampleData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

