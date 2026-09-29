import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { DEFAULT_UNIVERSITIES, INITIAL_CANTEENS } from '../data/mockData';
import { getDistanceInMeters, formatDistance, isWithinOrderingPerimeter, MAX_ORDER_DISTANCE_METERS } from '../utils/distance';
import { playOrderPlacedSound, playOrderReadyBuzzer, playNewTicketChime, announceTokenReady } from '../utils/audio';
import { registerForPushNotificationsAsync, sendOrderReadyNotification } from '../utils/notifications';
import { broadcastEvent, subscribeToRealtimeEvents, SYNC_EVENTS } from '../utils/sync';
import {
  isFirebaseConfigured,
  loadPersistedFirebaseConfig,
  getFirebaseStatus
} from '../services/firebase';
import {
  loginWithPhone,
  syncUserProfileToFirestore,
  onAuthChange,
  saveUserProfileToLocalRegistry
} from '../services/authService';
import {
  subscribeToCanteens,
  createCanteen,
  updateCanteenInDb,
  deleteCanteenFromDb,
  updateMenuInDb
} from '../services/canteenService';
import {
  subscribeToOrders,
  createOrderInDb,
  updateOrderStatusInDb,
  verifyOrderPinInDb,
  confirmUpiPaymentInFirestore,
  cancelOrderInDb,
  abandonOrderInDb
} from '../services/orderService';
import { requestSellerApproval } from '../services/sellerApprovalService';

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
  name: '',
  rollNo: '',
  facultyId: '',
  roomNumber: '',
  phone: '',
  email: ''
};

export const AppProvider = ({ children }) => {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(null); // null while loading
  const [university, setUniversityState] = useState('sou');
  const [role, setRoleState] = useState('buyer'); // 'buyer' or 'seller'
  const [sellerShopId, setSellerShopIdState] = useState(null);
  const [canteens, setCanteensState] = useState([]);
  const [orders, setOrdersState] = useState([]);
  const [activeOrderId, setActiveOrderIdState] = useState(null);
  const [userProfile, setUserProfileState] = useState(DEFAULT_PROFILE);

  // Firebase Realtime State & Connection Modal
  const [firebaseActive, setFirebaseActive] = useState(isFirebaseConfigured);
  const [firebaseConfigModalVisible, setFirebaseConfigModalVisible] = useState(false);

  // Cart State (for multi-item orders)
  const [cart, setCartState] = useState({ shopId: null, shopName: null, items: [], specialInstructions: '' });

  // Location & Wallet State — starts as null until real GPS is obtained
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0); // ₹0 starting balance
  const [unclaimedOrderCount, setUnclaimedOrderCount] = useState(0);
  const [banStatus, setBanStatus] = useState('active'); // 'active' | 'temp_ban' | 'perm_ban'
  const [banUntil, setBanUntil] = useState(null);

  const [rushModeActive, setRushModeActive] = useState(false);
  const toggleRushMode = () => setRushModeActive(prev => !prev);

  useEffect(() => {
    loadStoredData();
    requestUserLocation();
    registerForPushNotificationsAsync();

    // Check custom saved Firebase configuration
    loadPersistedFirebaseConfig().then(res => {
      setFirebaseActive(res.isConfigured);
    });

    // Cross-tab realtime event synchronization (fallback & local tab sync)
    const unsubscribeEvents = subscribeToRealtimeEvents((event) => {
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
          const targetOrd = orders.find(o => o.id === orderId);
          if (targetOrd) {
            sendOrderReadyNotification(targetOrd);
          }
        }
      } else if (event.type === SYNC_EVENTS.CANTEEN_UPDATED) {
        if (event.payload?.canteens) {
          setCanteensState(event.payload.canteens);
        }
      }
    });

    // Realtime Firestore listener for Canteens
    const unsubscribeCanteens = subscribeToCanteens(university, (remoteCanteens) => {
      const cleanList = Array.isArray(remoteCanteens)
        ? remoteCanteens.filter(c => !c.id.startsWith('shop-sou-10') && c.id !== 'shop-nirma-201')
        : [];
      setCanteensState(prev => {
        const merged = [...cleanList];
        (prev || []).forEach(p => {
          if (!merged.some(m => m.id === p.id)) {
            merged.push(p);
          }
        });
        const normalized = merged.map(shop => {
          const uni = DEFAULT_UNIVERSITIES.find(u => u.id === (shop.universityId || 'sou')) || DEFAULT_UNIVERSITIES[0];
          return {
            ...shop,
            lat: uni.lat,
            lng: uni.lng
          };
        });
        AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(normalized)).catch(() => {});
        return normalized;
      });
    });

    // Realtime Firestore listener for Orders (Student & Kitchen POS sync)
    // Filter scoped to user role & shop to comply with Firestore security rules
    const currentUid = userProfile?.uid;
    const filter = {
      role,
      uid: currentUid,
      shopId: role === 'seller' ? sellerShopId : null
    };

    const unsubscribeOrders = subscribeToOrders(filter, (remoteOrders) => {
      if (Array.isArray(remoteOrders)) {
        const cleanOrders = remoteOrders.filter(o => o.id !== 'SQ-2101');
        setOrdersState(prev => {
          const merged = [...cleanOrders];
          (prev || []).forEach(p => {
            if (!merged.some(m => m.id === p.id)) {
              merged.push(p);
            }
          });
          // Check if any order changed to Ready
          cleanOrders.forEach(rem => {
            const old = (prev || []).find(p => p.id === rem.id);
            if (old && old.orderStatus !== 'Ready for Pickup' && rem.orderStatus === 'Ready for Pickup') {
              playOrderReadyBuzzer();
              sendOrderReadyNotification(rem);
            }
          });
          return merged;
        });
        AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(cleanOrders)).catch(() => {});
      }
    });

    // Firebase Auth State Listener
    const unsubscribeAuth = onAuthChange(async (user) => {
      if (user) {
        setFirebaseActive(true);
        try {
          const tokenResult = await user.getIdTokenResult();
          if (tokenResult.claims.seller === true) {
            setRoleState('seller');
            await AsyncStorage.setItem(STORAGE_KEYS.ROLE, 'seller');
          }
        } catch (claimError) {
          console.log('Seller claim refresh note:', claimError.message);
        }
      }
    });

    return () => {
      if (unsubscribeEvents) unsubscribeEvents();
      if (unsubscribeCanteens) unsubscribeCanteens();
      if (unsubscribeOrders) unsubscribeOrders();
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [university, role, sellerShopId, userProfile?.uid]);


  const requestUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (loc && loc.coords) {
          setUserLocation({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracy: loc.coords.accuracy || 0
          });
        }

        try {
          await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 4000,
              distanceInterval: 5
            },
            (newLoc) => {
              if (newLoc && newLoc.coords) {
                setUserLocation({
                  lat: newLoc.coords.latitude,
                  lng: newLoc.coords.longitude,
                  accuracy: newLoc.coords.accuracy || 0
                });
              }
            }
          );
        } catch (watchErr) {
          console.log('Location watch note:', watchErr);
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
      if (s && !s.startsWith('shop-sou-10')) setSellerShopIdState(s);

      const c = await AsyncStorage.getItem(STORAGE_KEYS.CANTEENS);
      if (c) {
        try {
          const parsed = JSON.parse(c);
          const real = Array.isArray(parsed) ? parsed : [];
          const normalized = real.map(shop => {
            const uni = DEFAULT_UNIVERSITIES.find(u => u.id === (shop.universityId || 'sou')) || DEFAULT_UNIVERSITIES[0];
            return {
              ...shop,
              lat: uni.lat,
              lng: uni.lng
            };
          });
          setCanteensState(normalized);
        } catch (e) {
          setCanteensState([]);
        }
      } else {
        setCanteensState([]);
      }

      const o = await AsyncStorage.getItem(STORAGE_KEYS.ORDERS);
      if (o) {
        try {
          const parsed = JSON.parse(o);
          const cleanOrders = Array.isArray(parsed) ? parsed.filter(item => item.id !== 'SQ-2101') : [];
          setOrdersState(cleanOrders);
        } catch (e) {
          setOrdersState([]);
        }
      } else {
        setOrdersState([]);
      }

      const a = await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_PASS);
      if (a && a !== 'SQ-2101') {
        setActiveOrderIdState(a);
      } else {
        setActiveOrderIdState(null);
        await AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_PASS).catch(() => {});
      }

      const w = await AsyncStorage.getItem(STORAGE_KEYS.USER_WALLET);
      if (w !== null) {
        const parsedW = parseFloat(w);
        if (parsedW === 500) {
          setWalletBalance(0);
          await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, '0');
        } else {
          setWalletBalance(parsedW);
        }
      } else {
        setWalletBalance(0);
      }

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
    const isSeller = chosenRole === 'seller';
    const effectiveRole = isSeller ? 'seller' : 'buyer';
    setRoleState(effectiveRole);
    setUniversityState(chosenUniversity);

    let mergedProfile = userProfile;
    if (profileData) {
      mergedProfile = { ...userProfile, ...profileData, userType: isSeller ? 'seller' : (profileData.userType || 'student') };
      setUserProfileState(mergedProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(mergedProfile));
    }

    // Authenticate with Firebase and sync user profile
    try {
      await loginWithPhone({
        phone: mergedProfile.phone || '',
        name: mergedProfile.name || '',
        userType: isSeller ? 'seller' : (mergedProfile.userType || 'student'),
        universityId: chosenUniversity,
        rollNo: mergedProfile.rollNo || '',
        facultyId: mergedProfile.facultyId || '',
        roomNumber: mergedProfile.roomNumber || mergedProfile.facultyRoomNote || ''
      });
      setFirebaseActive(isFirebaseConfigured);
    } catch (authErr) {
      console.log('Firebase onboarding auth note:', authErr);
    }

    // If user is a real vendor registering their shop, create the real canteen!
    if (isSeller && vendorCanteenData) {
      mergedProfile.stallName = vendorCanteenData.name;
      mergedProfile.stallLocation = vendorCanteenData.location;
      mergedProfile.merchantUpi = vendorCanteenData.upiId;

      try {
        const createdShop = await addCanteen({
          name: vendorCanteenData.name,
          location: vendorCanteenData.location,
          openingHours: vendorCanteenData.openingHours || '08:00 AM - 08:00 PM',
          upiId: vendorCanteenData.upiId,
          phone: vendorCanteenData.phone || mergedProfile.phone || '',
          universityId: chosenUniversity,
          ownerId: mergedProfile.uid,
          menu: []
        });
        if (createdShop) {
          setSellerShopIdState(createdShop.id);
          mergedProfile.sellerShopId = createdShop.id;
          await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, createdShop.id);
        }
      } catch (err) {
        console.log('Error registering initial vendor canteen:', err);
      }
      setUserProfileState(mergedProfile);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(mergedProfile));
    }

    if (mergedProfile?.phone) {
      await saveUserProfileToLocalRegistry(mergedProfile.phone, mergedProfile);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.ROLE, effectiveRole);
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
    if (updated.phone) {
      await saveUserProfileToLocalRegistry(updated.phone, updated);
    }
    await syncUserProfileToFirestore(updated);
  };

  const setUniversity = async (uniId) => {
    setUniversityState(uniId);
    await AsyncStorage.setItem(STORAGE_KEYS.UNIVERSITY, uniId);
    // Note: we do NOT override userLocation here — it must always reflect real device GPS.
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
    const campusUni = DEFAULT_UNIVERSITIES.find(u => u.id === (canteenData.universityId || university)) || DEFAULT_UNIVERSITIES[0];
    const newId = canteenData.id || ('shop-' + Date.now().toString().slice(-4));
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
      ownerId: userProfile?.uid || 'vendor_' + Date.now(),
      ...canteenData,
      // Campus stalls are physically on campus grounds (Silver Oak University)
      lat: campusUni.lat,
      lng: campusUni.lng
    };

    const updated = [newCanteen, ...canteens.filter(c => c.id !== newId)];
    setCanteensState(updated);
    setSellerShopIdState(newId);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, newId);
    await createCanteen(newCanteen);
    broadcastEvent(SYNC_EVENTS.CANTEEN_UPDATED, { canteens: updated });
    return newCanteen;
  };

  const updateCanteen = async (shopId, updatedFields) => {
    const updated = canteens.map(shop => (shop.id === shopId ? { ...shop, ...updatedFields } : shop));
    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    await updateCanteenInDb(shopId, updatedFields);
  };

  const deleteCanteen = async (shopId) => {
    const updated = canteens.filter(shop => shop.id !== shopId);
    setCanteensState(updated);
    if (sellerShopId === shopId && updated.length > 0) {
      setSellerShopIdState(updated[0].id);
      await AsyncStorage.setItem(STORAGE_KEYS.SELLER_SHOP_ID, updated[0].id);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    await deleteCanteenFromDb(shopId);
  };

  // --- Real Menu Management ---
  const addMenuItem = async (shopId, newItem) => {
    const effectiveShopId = shopId || sellerShopId || (canteens.find(c => c.universityId === university)?.id) || (canteens[0]?.id);
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

    let shopFound = false;
    let updated = canteens.map(shop => {
      if (shop.id === effectiveShopId) {
        shopFound = true;
        return { ...shop, menu: [itemToAdd, ...(shop.menu || [])] };
      }
      return shop;
    });

    if (!shopFound) {
      const campusUni = DEFAULT_UNIVERSITIES.find(u => u.id === university) || DEFAULT_UNIVERSITIES[0];
      const newStall = {
        id: effectiveShopId || `stall-${Date.now().toString().slice(-4)}`,
        name: userProfile?.stallName || 'Demo stall',
        location: userProfile?.stallLocation || 'Silver Oak University Campus',
        universityId: university,
        openingHours: '08:00 AM - 08:00 PM',
        upiId: userProfile?.merchantUpi || 'canteen@upi',
        phone: userProfile?.phone || '+91 98765 43210',
        status: 'Open',
        rating: 5.0,
        currentQueue: 0,
        avgWaitMins: 5,
        menu: [itemToAdd],
        tags: ['Campus Canteen'],
        lat: campusUni.lat,
        lng: campusUni.lng,
        ownerId: userProfile?.uid
      };
      updated = [newStall, ...canteens];
      createCanteen(newStall);
    }

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    const targetShop = updated.find(s => s.id === effectiveShopId);
    if (targetShop) {
      await updateMenuInDb(effectiveShopId, targetShop.menu || []);
    }
    broadcastEvent(SYNC_EVENTS.CANTEEN_UPDATED, { canteens: updated });
    return itemToAdd;
  };

  const updateMenuItem = async (shopId, itemId, updatedItem) => {
    const effectiveShopId = shopId || sellerShopId || (canteens.find(c => c.universityId === university)?.id) || (canteens[0]?.id);
    const updated = canteens.map(shop => {
      if (shop.id === effectiveShopId) {
        const updatedMenu = (shop.menu || []).map(item => {
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
    const targetShop = updated.find(s => s.id === effectiveShopId);
    if (targetShop) {
      await updateMenuInDb(effectiveShopId, targetShop.menu || []);
    }
    broadcastEvent(SYNC_EVENTS.CANTEEN_UPDATED, { canteens: updated });
  };

  const deleteMenuItem = async (shopId, itemId) => {
    const effectiveShopId = shopId || sellerShopId || (canteens.find(c => c.universityId === university)?.id) || (canteens[0]?.id);
    const updated = canteens.map(shop => {
      if (shop.id === effectiveShopId) {
        return { ...shop, menu: (shop.menu || []).filter(item => item.id !== itemId) };
      }
      return shop;
    });

    setCanteensState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.CANTEENS, JSON.stringify(updated));
    const targetShop = updated.find(s => s.id === effectiveShopId);
    if (targetShop) {
      await updateMenuInDb(effectiveShopId, targetShop.menu || []);
    }
    broadcastEvent(SYNC_EVENTS.CANTEEN_UPDATED, { canteens: updated });
  };

  const toggleItemStock = async (shopId, itemId) => {
    const effectiveShopId = shopId || sellerShopId || (canteens.find(c => c.universityId === university)?.id) || (canteens[0]?.id);
    const updated = canteens.map(shop => {
      if (shop.id === effectiveShopId) {
        const updatedMenu = (shop.menu || []).map(item => {
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
    const targetShop = updated.find(s => s.id === effectiveShopId);
    if (targetShop) {
      await updateMenuInDb(effectiveShopId, targetShop.menu || []);
    }
    broadcastEvent(SYNC_EVENTS.CANTEEN_UPDATED, { canteens: updated });
  };

  const updateItemPrice = async (shopId, itemId, newPrice) => {
    const numPrice = parseFloat(newPrice);
    if (isNaN(numPrice) || numPrice < 0) return;
    return updateMenuItem(shopId, itemId, { price: numPrice });
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

    // 1b. Check Wallet Balance if paying with Wallet
    if (orderData.paymentMethod === 'Wallet') {
      const orderTotal = Number(orderData.totalAmount || 0);
      if (walletBalance < orderTotal) {
        throw new Error(`Insufficient wallet balance. You have ₹${walletBalance.toFixed(0)}, but your order total is ₹${orderTotal}.`);
      }
    }

    // 2. Real Hardware GPS Geofence Verification with drift tolerance
    const campusUni = DEFAULT_UNIVERSITIES.find(u => u.id === university) || DEFAULT_UNIVERSITIES[0];
    const targetShop = canteens.find(c => c.id === orderData.shopId);
    const shopLat = targetShop?.lat || campusUni.lat;
    const shopLng = targetShop?.lng || campusUni.lng;

    if (!userLocation || userLocation.lat == null || userLocation.lng == null) {
      throw new Error(
        'GPS LOCATION REQUIRED: Please enable device location permissions. Orders can only be placed while physically on campus grounds (<500m).'
      );
    }

    const distMeters = getDistanceInMeters(userLocation.lat, userLocation.lng, shopLat, shopLng);
    if (!isWithinOrderingPerimeter(distMeters, userLocation.accuracy || 0)) {
      const formattedDist = formatDistance(distMeters);
      throw new Error(
        `ORDER BLOCKED: Hardware GPS detects you are ${formattedDist} away from ${targetShop?.name || 'Silver Oak University'} (>500m campus limit). SkipQ orders can only be placed when physically on campus grounds.`
      );
    }

    // 3. The server validates prices, wallet balance, bans, and cash deposits.
    const maxItemPrep = (orderData.items || []).reduce((max, it) => {
      const match = (it.prepTime || '').match(/\d+/);
      const mins = match ? parseInt(match[0], 10) : 5;
      return Math.max(max, mins);
    }, 5);

    // If kitchen is in rush mode, add +10 mins to estimated prep
    const effectivePrepMins = rushModeActive ? maxItemPrep + 10 : maxItemPrep;
    const isFacultyOrder = Boolean(orderData.isFacultyExpress || userProfile?.userType === 'faculty');

    const tokenNum = (isFacultyOrder ? 'FAC-' : 'SQ-') + Math.floor(10 + Math.random() * 90);
    const pickupPin = String(Math.floor(1000 + Math.random() * 9000));
    const newOrder = {
      id: 'SQ-' + Date.now().toString().slice(-4),
      tokenNumber: tokenNum,
      pickupPin,
      estimatedPrepMins: effectivePrepMins,
      timestamp: new Date().toISOString(),
      orderStatus: 'Preparing',
      buyerName: userProfile.name || (isFacultyOrder ? 'University Faculty' : 'Campus Student'),
      buyerPhone: userProfile.phone || '',
      buyerRollNo: userProfile.rollNo || '',
      heldDepositAmount: 0,
      pickupSlot: orderData.pickupSlot || 'ASAP',
      isFacultyExpress: isFacultyOrder,
      facultyRoomNote: orderData.facultyRoomNote || userProfile?.facultyRoomNote || '',
      groupCollectorName: orderData.groupCollectorName || '',
      ...orderData
    };

    // Persist to Cloud Firestore for kitchen POS and multi-device sync
    let confirmedOrder = newOrder;
    try {
      const serverOrder = await createOrderInDb(newOrder);
      if (serverOrder) {
        confirmedOrder = { ...newOrder, ...serverOrder };
      }
    } catch (fsErr) {
      console.log('Order sync note, using local confirmation:', fsErr.message);
    }

    const confirmedOrders = [confirmedOrder, ...orders.filter(o => o.id !== confirmedOrder.id)];
    setOrdersState(confirmedOrders);
    setActiveOrderIdState(confirmedOrder.id);
    setWalletBalance(prev => {
      let deduction = 0;
      if (confirmedOrder.paymentMethod === 'Wallet') {
        deduction = Number(confirmedOrder.totalAmount || 0);
      } else if (confirmedOrder.heldDepositAmount) {
        deduction = Number(confirmedOrder.heldDepositAmount || 0);
      }
      const nextBalance = Math.max(0, prev - deduction);
      AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(nextBalance)).catch(() => {});
      return nextBalance;
    });
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(confirmedOrders));
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_PASS, confirmedOrder.id);
    clearCart();
    playOrderPlacedSound();
    broadcastEvent(SYNC_EVENTS.ORDER_CREATED, confirmedOrder);
    return confirmedOrder;
  };

  const markOrderReady = async (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Ready for Pickup' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    try {
      await updateOrderStatusInDb(orderId, 'Ready for Pickup');
    } catch (e) {
      console.log('Order ready DB sync note:', e.message);
    }

    if (targetOrder) {
      announceTokenReady(targetOrder.tokenNumber, targetOrder.shopName);
    } else {
      playOrderReadyBuzzer();
    }
    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, { orderId, orderStatus: 'Ready for Pickup' });
  };

  const markOrderCompleted = async (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Completed' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    try {
      await updateOrderStatusInDb(orderId, 'Completed');
      if (targetOrder.heldDepositAmount > 0) {
        setWalletBalance(prev => {
          const nextBalance = prev + Number(targetOrder.heldDepositAmount);
          AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(nextBalance)).catch(() => {});
          return nextBalance;
        });
      }
    } catch (e) {
      console.log('Order completed DB sync note:', e.message);
    }

    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, { orderId, orderStatus: 'Completed' });
  };

  const verifyAndCompleteOrder = async (orderId, enteredPin) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) throw new Error('Order not found');

    if (targetOrder.pickupPin && enteredPin && enteredPin.trim() !== targetOrder.pickupPin) {
      throw new Error(`Incorrect PIN! Entered "${enteredPin}", but student pass requires "${targetOrder.pickupPin}".`);
    }

    await verifyOrderPinInDb(orderId, enteredPin);

    await markOrderCompleted(orderId);
    return true;
  };

  const confirmUpiPayment = async (orderId) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) throw new Error('Order not found');
    await confirmUpiPaymentInFirestore(orderId);
    const updated = orders.map(o => o.id === orderId ? { ...o, paymentStatus: 'CONFIRMED_BY_MERCHANT' } : o);
    setOrdersState(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
  };

  // Re-order past order: populate cart with exact items & shop
  const reorderItems = (orderId) => {
    const pastOrder = orders.find(o => o.id === orderId);
    if (!pastOrder || !pastOrder.items || pastOrder.items.length === 0) return;

    const matchedCanteen = canteens.find(c => c.id === pastOrder.shopId || c.name === pastOrder.shopName) || {
      id: pastOrder.shopId || 'shop-sou-101',
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

    const refundAmount = targetOrder.upfrontPaid !== undefined
      ? Number(targetOrder.upfrontPaid)
      : (targetOrder.paymentMethod === 'Cash'
          ? Number(targetOrder.heldDepositAmount || Math.ceil(targetOrder.totalAmount * 0.10))
          : Number(targetOrder.totalAmount));

    let refundText = targetOrder.paymentMethod === 'Cash'
      ? `10% Pre-order commitment token (₹${refundAmount}) refunded to your UPI account.`
      : targetOrder.paymentMethod === 'Wallet'
      ? `Full amount (₹${refundAmount}) refunded back to your SkipQ Wallet balance.`
      : `Full amount (₹${refundAmount}) refunded immediately to your ${targetOrder.paymentMethod || 'UPI'} account.`;

    const updatedOrders = orders.map(o => (o.id === orderId ? {
      ...o,
      orderStatus: 'Cancelled',
      cancelledBy,
      refundStatus: 'REFUND_COMPLETED_UPI',
      refundAmount,
      refundText
    } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));

    try {
      await cancelOrderInDb(orderId, cancelledBy, {
        refundText,
        refundAmount,
        refundStatus: 'REFUND_COMPLETED_UPI'
      });
      if (targetOrder.paymentMethod === 'Wallet') {
        setWalletBalance(prev => {
          const nextBalance = prev + Number(targetOrder.totalAmount || refundAmount || 0);
          AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(nextBalance)).catch(() => {});
          return nextBalance;
        });
      } else if (targetOrder.heldDepositAmount > 0) {
        setWalletBalance(prev => {
          const nextBalance = prev + Number(targetOrder.heldDepositAmount);
          AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(nextBalance)).catch(() => {});
          return nextBalance;
        });
      }
    } catch (e) {
      console.log('Cancel order DB sync note:', e.message);
    }

    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, {
      orderId,
      orderStatus: 'Cancelled',
      refundAmount,
      refundStatus: 'REFUND_COMPLETED_UPI'
    });
    return refundText;
  };

  const markOrderAbandoned = async (orderId) => {
    let penalty = {
      newUnclaimedCount: unclaimedOrderCount + 1,
      newBanStatus: 'temp_ban',
      newBanUntil: new Date(Date.now() + 86400000).toISOString()
    };

    try {
      const serverPenalty = await abandonOrderInDb(orderId);
      if (serverPenalty?.penalty) {
        penalty = serverPenalty.penalty;
      }
    } catch (e) {
      console.log('Abandon order DB sync note:', e.message);
    }

    const { newUnclaimedCount, newBanStatus, newBanUntil } = penalty;
    setUnclaimedOrderCount(newUnclaimedCount);
    setBanStatus(newBanStatus);
    setBanUntil(newBanUntil);
    await AsyncStorage.setItem(STORAGE_KEYS.UNCLAIMED_COUNT, String(newUnclaimedCount));
    await AsyncStorage.setItem(STORAGE_KEYS.BAN_STATUS, newBanStatus);
    if (newBanUntil) await AsyncStorage.setItem(STORAGE_KEYS.BAN_UNTIL, newBanUntil);

    const updatedOrders = orders.map(o => (o.id === orderId ? { ...o, orderStatus: 'Abandoned' } : o));
    setOrdersState(updatedOrders);
    await AsyncStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
    broadcastEvent(SYNC_EVENTS.ORDER_STATUS_CHANGED, { orderId, orderStatus: 'Abandoned' });
    return { newUnclaimedCount, newBanStatus, newBanUntil };
  };

  const topUpWallet = async (amount = 200) => {
    const newBal = walletBalance + amount;
    setWalletBalance(newBal);
    await AsyncStorage.setItem(STORAGE_KEYS.USER_WALLET, String(newBal));
  };

  const refreshFirebaseState = async () => {
    const res = await loadPersistedFirebaseConfig();
    setFirebaseActive(res.isConfigured);
    return res;
  };

  const logoutUser = async () => {
    // Clear user-specific session data from local storage, but preserve campus canteens
    const userSessionKeys = [
      STORAGE_KEYS.ROLE,
      STORAGE_KEYS.SELLER_SHOP_ID,
      STORAGE_KEYS.ACTIVE_PASS,
      STORAGE_KEYS.USER_WALLET,
      STORAGE_KEYS.USER_PROFILE,
      STORAGE_KEYS.UNCLAIMED_COUNT,
      STORAGE_KEYS.BAN_STATUS,
      STORAGE_KEYS.BAN_UNTIL,
      STORAGE_KEYS.ONBOARDING_DONE
    ];
    await AsyncStorage.multiRemove(userSessionKeys);

    // Reset user state
    setUserProfileState(DEFAULT_PROFILE);
    setActiveOrderIdState(null);
    setWalletBalance(0);
    setUnclaimedOrderCount(0);
    setBanStatus('active');
    setBanUntil(null);
    setRoleState('buyer');
    setSellerShopIdState(null);
    clearCart();

    // Return to onboarding
    setIsOnboardingComplete(false);
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
        addMenuItem, updateMenuItem, deleteMenuItem, toggleItemStock, updateItemPrice,
        cart, addToCart, updateCartQty, setSpecialInstructions, clearCart,
        orders, placeOrder, markOrderReady, markOrderCompleted, verifyAndCompleteOrder, confirmUpiPayment, cancelOrder, markOrderAbandoned,
        reorderItems, rateOrder,
        activeOrderId, setActiveOrderIdState,
        userLocation, setUserLocation, requestUserLocation, locationPermissionGranted,

        walletBalance, topUpWallet, unclaimedOrderCount, banStatus, banUntil,
        rushModeActive, setRushModeActive, toggleRushMode,
        logoutUser,
        firebaseActive, refreshFirebaseState,
        firebaseConfigModalVisible, setFirebaseConfigModalVisible
      }}
    >
      {children}
    </AppContext.Provider>
  );

};

