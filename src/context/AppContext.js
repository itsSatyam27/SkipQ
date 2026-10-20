import React, { createContext, useState, useEffect, useRef } from 'react';
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useDeviceLocation from '../hooks/useDeviceLocation';
import useLocationTestAccess from '../hooks/useLocationTestAccess';
import { isUsableLocation } from '../services/locationPolicy.cjs';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import { getDistanceInMeters, isWithinOrderingPerimeter } from '../utils/distance';
import { playOrderPlacedSound, announceTokenReady } from '../utils/audio';
import { sendOrderReadyNotification, registerForPushNotificationsAsync, notifyOrderEvent, unregisterPushDevice } from '../utils/notifications';
import { auth, db, doc, getDoc, onSnapshot, updateDoc, serverTimestamp, isFirebaseConfigured } from '../services/firebase';
import { registerAccountProfile, syncUserProfileToFirestore, onAuthChange, signOutUser, subscribeToUserProfile } from '../services/authService';
import { subscribeToCanteens, createCanteen, provisionRegisteredCanteen, saveSellerSettingsInFirestore, updateCanteenInDb, deleteCanteenFromDb, updateMenuInDb } from '../services/canteenService';
import { subscribeToOrders, createOrderInDb, acknowledgeOrder, updateOrderStatusInDb, verifyOrderPinInDb, confirmUpiPaymentInFirestore, rateOrderInFirestore, cancelOrderInDb, abandonOrderInDb } from '../services/orderService';
import { requestSellerApproval } from '../services/sellerApprovalService';
import { isSellerApproved } from '../services/sellerAccess';
import { selectOwnedCanteen } from '../services/sellerCanteen.cjs';

export const AppContext = createContext();
const EMPTY_CART = { shopId: null, shopName: null, items: [], specialInstructions: '' };
const EMPTY_PROFILE = { name: '', rollNo: '', facultyId: '', roomNumber: '', phone: '', email: '' };
export function AppProvider({ children }) {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(null);
  const [university, setUniversityState] = useState('sou');
  const [role, setRoleState] = useState('buyer');
  const [sellerShopId, setSellerShopIdState] = useState(null);
  const [sellerApproved, setSellerApproved] = useState(false);
  const [sellerSetupStatus, setSellerSetupStatus] = useState('idle');
  const [sellerSetupError, setSellerSetupError] = useState('');
  const [sellerSetupAttempt, setSellerSetupAttempt] = useState(0);
  const [userProfile, setUserProfileState] = useState(EMPTY_PROFILE);
  const locationTesting = useLocationTestAccess(userProfile.uid);
  const [canteens, setCanteensState] = useState([]);
  const [orders, setOrdersState] = useState([]);
  const [activeOrderId, setActiveOrderIdState] = useState(null);
  const [cart, setCartState] = useState(EMPTY_CART);
  const { userLocation, requestUserLocation, locationPermissionGranted, locationStatus, locationError,
    openLocationSettings, resetLocation, getLocation } = useDeviceLocation(isOnboardingComplete === true);
  const [rushModeActive, setRushModeActive] = useState(false);
  const [firebaseConfigModalVisible, setFirebaseConfigModalVisible] = useState(false);
  const orderInFlight = useRef(false);
  const sessionVersion = useRef(0);
  const walletBalance = 0;
  const unclaimedOrderCount = Number(userProfile.unclaimedOrderCount || 0);
  const banStatus = userProfile.banStatus || 'active';
  const banUntil = userProfile.banUntil?.seconds ? new Date(userProfile.banUntil.seconds * 1000).toISOString() : userProfile.banUntil || null;
  const firebaseActive = isFirebaseConfigured;

  useEffect(() => {
    if (!isOnboardingComplete || !userProfile.uid) return;
    registerForPushNotificationsAsync();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') registerForPushNotificationsAsync(); });
    return () => listener.remove();
  }, [isOnboardingComplete, userProfile.uid]);
  useEffect(() => {
    if (!auth || !db) { setIsOnboardingComplete(false); return; }
    let mounted = true;
    const unsubscribe = onAuthChange(async user => {
      const version = ++sessionVersion.current;
      setOrdersState([]); setCartState(EMPTY_CART); setActiveOrderIdState(null);
      setUserProfileState(EMPTY_PROFILE); setSellerApproved(false); setSellerShopIdState(null); setRoleState('buyer');
      if (!user || user.isAnonymous) { setIsOnboardingComplete(false); return; }
      try {
        const token = await user.getIdTokenResult(true);
        const profile = await getDoc(doc(db, 'users', user.uid));
        const active = await AsyncStorage.getItem(`@skipq_active_pass_${user.uid}`);
        if (!mounted || version !== sessionVersion.current) return;
        if (token.claims.email_verified !== true || !user.email || (token.claims.firebase?.sign_in_provider !== 'google.com' && token.claims.googleVerified !== true)) { setIsOnboardingComplete(false); return; }
        const approved = await isSellerApproved();
        setSellerApproved(approved);
        if (profile.exists()) {
          const data = { ...profile.data(), uid: user.uid };
          if (data.banStatus === 'perm_ban' || (data.banStatus === 'temp_ban' && (data.banUntil?.toMillis?.() || 0) > Date.now())) {
            Alert.alert('Account blocked', 'This account is blocked from the platform. Contact support if you need help.');
            await signOutUser(); setIsOnboardingComplete(false); return;
          }
          setUserProfileState(data); setUniversityState(data.universityId || 'sou');
          setSellerShopIdState(approved ? data.sellerShopId || null : null);
          setRoleState(data.userType === 'seller' ? 'seller' : 'buyer');
          setActiveOrderIdState(active);
          setIsOnboardingComplete(Boolean(data.profileComplete && data.name && data.phone && data.email === user.email.toLowerCase()));
        } else setIsOnboardingComplete(false);
      } catch (error) {
        if (mounted && version === sessionVersion.current) setIsOnboardingComplete(false);
        console.warn('Session restore failed:', error.message);
      }
    });
    return () => { mounted = false; sessionVersion.current++; unsubscribe(); };
  }, []);
  useEffect(() => subscribeToCanteens(university, setCanteensState), [university]);
  useEffect(() => {
    if (!isOnboardingComplete || !sellerApproved || userProfile.userType !== 'seller' || !userProfile.uid || userProfile.sellerShopId) {
      setSellerSetupStatus('idle'); setSellerSetupError(''); return;
    }
    let cancelled = false;
    setSellerSetupStatus('loading'); setSellerSetupError('');
    const campus = DEFAULT_UNIVERSITIES.find(item => item.id === university);
    if (!campus) { setSellerSetupStatus('error'); setSellerSetupError('Campus setup is unavailable.'); return; }
    provisionRegisteredCanteen(campus).then(shop => {
      if (cancelled) return;
      setCanteensState(previous => previous.some(item => item.id === shop.id) ? previous : [...previous, shop]);
      setSellerShopIdState(shop.id); setSellerSetupStatus('ready');
      setUserProfileState(previous => ({ ...previous, sellerShopId: shop.id }));
    }).catch(error => { if (!cancelled) { setSellerSetupStatus('error'); setSellerSetupError(error.message); } });
    return () => { cancelled = true; };
  }, [isOnboardingComplete, sellerApproved, userProfile.uid, userProfile.userType, userProfile.sellerShopId, university, sellerSetupAttempt]);
  useEffect(() => {
    if (!sellerApproved || userProfile.userType !== 'seller') return;
    const shop = selectOwnedCanteen(canteens, userProfile.uid, university, sellerShopId, userProfile.sellerShopId);
    if (shop && shop.id !== sellerShopId) setSellerShopIdState(shop.id);
  }, [canteens, sellerApproved, userProfile.uid, userProfile.userType, userProfile.sellerShopId, university, sellerShopId]);
  useEffect(() => {
    if (!isOnboardingComplete || !userProfile.uid || !db) return;
    const recordActivity = () => updateDoc(doc(db, 'users', userProfile.uid), { lastActiveAt: serverTimestamp() }).catch(() => {});
    recordActivity();
    const timer = setInterval(recordActivity, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isOnboardingComplete, userProfile.uid]);
  useEffect(() => {
    if (!userProfile.uid) return;
    let mounted = true;
    let handlingBan = false;
    const unsubscribe = subscribeToUserProfile(userProfile.uid, profile => {
      if (!mounted) return;
      setUserProfileState(profile);
      const blocked = profile.banStatus === 'perm_ban' || (profile.banStatus === 'temp_ban' && (profile.banUntil?.toMillis?.() || 0) > Date.now());
      if (blocked && !handlingBan) {
        handlingBan = true; setIsOnboardingComplete(false);
        Alert.alert('Account restricted', profile.banStatus === 'perm_ban' ? 'Your account is permanently blocked. Contact support for help.' : 'Ordering is paused until ' + profile.banUntil.toDate().toLocaleString() + '. ' + (profile.banReason || 'Contact support for help.'));
        unregisterPushDevice().catch(() => {}).then(() => signOutUser()).catch(console.warn);
      }
    });
    return () => { mounted = false; unsubscribe(); };
  }, [userProfile.uid]);
  useEffect(() => {
    if (userProfile.userType !== 'seller' || !userProfile.uid || !db) return;
    setRoleState('seller');
    return onSnapshot(doc(db, 'sellerApprovals', userProfile.uid), snapshot => {
      setSellerApproved(snapshot.data()?.approved === true);
    }, () => setSellerApproved(false));
  }, [userProfile.uid, userProfile.userType]);
  useEffect(() => {
    let mounted = true;
    if (role === 'seller' && !sellerApproved) { setOrdersState([]); return; }
    const unsubscribe = subscribeToOrders({ role, uid: userProfile.uid }, list => {
      if (!mounted) return;
      setOrdersState(previous => {
        if (role === 'buyer') list.forEach(order => {
          const old = previous.find(item => item.id === order.id);
          if (old && old.orderStatus !== 'Ready for Pickup' && order.orderStatus === 'Ready for Pickup') sendOrderReadyNotification(order);
        });
        return list;
      });
    });
    return () => { mounted = false; unsubscribe(); setOrdersState([]); };
  }, [role, userProfile.uid, sellerApproved]);

  const setRole = async next => {
    if (next === 'seller') {
      try {
        const approved = await isSellerApproved();
        setSellerApproved(Boolean(approved));
        if (userProfile.userType !== 'seller') { Alert.alert('Seller account required', 'This account is not registered as a seller.'); return; }
      } catch (error) { Alert.alert('Could not check seller access', error.message); return; }
    }
    setRoleState(next === 'seller' ? 'seller' : 'buyer');
  };
  const setUniversity = id => { setUniversityState(id); setCartState(EMPTY_CART); };
  const setSellerShopId = id => {
    const shop = canteens.find(item => item.id === id);
    if (!sellerApproved || shop?.ownerId !== auth?.currentUser?.uid) throw new Error('Choose your own approved canteen.');
    setSellerShopIdState(id);
  };
  const completeOnboarding = async ({ chosenRole, chosenUniversity, profileData, vendorCanteenData }) => {
    if (!auth?.currentUser) throw new Error('Sign in with Google first.');
    const approved = await isSellerApproved();
    const profile = await registerAccountProfile({ ...profileData, universityId: chosenUniversity,
      userType: chosenRole === 'seller' ? 'seller' : profileData.userType || 'student' });
    if (chosenRole === 'seller' && vendorCanteenData) {
      if (!approved) {
        await requestSellerApproval({ stallName: vendorCanteenData.name, location: vendorCanteenData.location, upiId: vendorCanteenData.upiId, universityId: chosenUniversity });
      } else if (!profile.sellerShopId) {
        const campus = DEFAULT_UNIVERSITIES.find(item => item.id === chosenUniversity) || DEFAULT_UNIVERSITIES[0];
        const shop = await provisionRegisteredCanteen(campus);
        profile.sellerShopId = shop.id;
      }
    }
    setUserProfileState(profile); setUniversityState(chosenUniversity); setSellerApproved(approved);
    setRoleState(profile.userType === 'seller' ? 'seller' : 'buyer');
    setSellerShopIdState(approved ? profile.sellerShopId || null : null); setIsOnboardingComplete(true);
  };
  const restartOnboarding = () => setIsOnboardingComplete(false);
  const updateUserProfile = async changes => {
    await syncUserProfileToFirestore(changes);
    setUserProfileState(previous => ({ ...previous, ...changes, phone: previous.phone, email: previous.email, userType: previous.userType, uid: previous.uid }));
  };
  const ownShop = id => {
    if (!sellerApproved) throw new Error('Your seller approval is pending. Wait for approval before editing the menu.');
    const shop = id ? canteens.find(item => item.id === id)
      : selectOwnedCanteen(canteens, auth?.currentUser?.uid, university, sellerShopId, userProfile.sellerShopId);
    if (!shop) throw new Error('Create your canteen in the seller workspace before adding a dish.');
    if (shop.ownerId !== auth?.currentUser?.uid || shop.universityId !== university) throw new Error('Choose a canteen owned by your account on this campus.');
    return shop;
  };
  const addCanteen = async data => {
    const campus = DEFAULT_UNIVERSITIES.find(item => item.id === university) || DEFAULT_UNIVERSITIES[0];
    const shop = await createCanteen({ ...data, universityId: university, lat: data.lat ?? campus.lat, lng: data.lng ?? campus.lng, menu: data.menu || [], status: data.status || 'Open', currentQueue: 0, avgWaitMins: 5, tags: ['Campus Canteen'] });
    await updateUserProfile({ sellerShopId: shop.id }); setSellerShopIdState(shop.id); return shop;
  };
  const updateCanteen = async (id, changes) => { ownShop(id); await updateCanteenInDb(id, changes); };
  const saveSellerSettings = async (id, draft) => {
    ownShop(id);
    const changes = await saveSellerSettingsInFirestore(id, draft);
    setUserProfileState(previous => ({ ...previous, ...changes.profile }));
    setCanteensState(previous => previous.map(shop => shop.id === id ? { ...shop, ...changes.canteen } : shop));
    return changes;
  };
  const deleteCanteen = async id => { ownShop(id); await deleteCanteenFromDb(id); if (sellerShopId === id) setSellerShopIdState(null); };
  const menuChange = async (id, transform) => {
    const shop = ownShop(id || sellerShopId);
    const menu = transform(shop.menu || []);
    if (menu.some(item => !Number.isFinite(item.price) || item.price <= 0 || item.price > 100000 || !String(item.name || '').trim())) throw new Error('Each dish needs a name and a valid price greater than zero.');
    if (JSON.stringify(menu).length > 700000) throw new Error('Your menu photo storage is full. Remove a photo before adding another.');
    await updateMenuInDb(shop.id, menu);
    return menu;
  };
  const addMenuItem = async (id, item) => {
    const dish = { ...item, id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, name: String(item.name || '').trim(), price: Number(item.price), category: item.category || 'Snacks', prepTime: item.prepTime || '5 mins', isAvailable: true, isVeg: item.isVeg !== false };
    await menuChange(id, menu => [dish, ...menu]); return dish;
  };
  const updateMenuItem = (id, itemId, changes) => menuChange(id, menu => menu.map(item => item.id === itemId ? { ...item, ...changes, id: item.id, price: changes.price === undefined ? item.price : Number(changes.price) } : item));
  const deleteMenuItem = (id, itemId) => menuChange(id, menu => menu.filter(item => item.id !== itemId));
  const toggleItemStock = (id, itemId) => menuChange(id, menu => menu.map(item => item.id === itemId ? { ...item, isAvailable: !item.isAvailable } : item));
  const updateItemPrice = (id, itemId, price) => updateMenuItem(id, itemId, { price });
  const addToCart = (shop, item) => {
    const currentShop = canteens.find(canteen => canteen.id === shop.id);
    if (!currentShop || currentShop.status !== 'Open') {
      Alert.alert('Orders paused', 'This canteen is not accepting new orders right now.');
      return;
    }
    if (cart.shopId === shop.id && cart.items.length >= 5 && !cart.items.some(dish => dish.id === item.id)) {
      Alert.alert('Cart limit', 'Choose up to 5 different dishes per order. You can increase each dish quantity.');
      return;
    }
    setCartState(previous => {
    if (!item.isAvailable) return previous;
    const items = previous.shopId === shop.id ? previous.items : [];
    const existing = items.find(dish => dish.id === item.id);
    return { shopId: shop.id, shopName: shop.name, specialInstructions: previous.shopId === shop.id ? previous.specialInstructions : '',
      items: existing ? items.map(dish => dish.id === item.id ? { ...dish, qty: Math.min(20, dish.qty + 1) } : dish) : [...items, { ...item, qty: 1 }] };
    });
  };
  const updateCartQty = (id, change) => setCartState(previous => {
    const items = previous.items.map(item => item.id === id ? { ...item, qty: Math.min(20, item.qty + change) } : item).filter(item => item.qty > 0);
    return items.length ? { ...previous, items } : EMPTY_CART;
  });
  const setSpecialInstructions = value => setCartState(previous => ({ ...previous, specialInstructions: value }));
  const clearCart = () => setCartState(EMPTY_CART);
  const commitOrder = result => {
    if (!result.order?.id) throw new Error('The server did not confirm the order update.');
    setOrdersState(previous => [result.order, ...previous.filter(item => item.id !== result.order.id)]);
    return result.order;
  };
  const placeOrder = async data => {
    if (orderInFlight.current) throw new Error('Your order is already being submitted.');
    orderInFlight.current = true;
    try {
      const shop = canteens.find(item => item.id === data.shopId);
      const location = locationTesting ? null : isUsableLocation(getLocation()) ? getLocation() : await requestUserLocation();
      if (!shop || (!locationTesting && !isUsableLocation(location))) throw new Error('An accurate campus location is required. Please refresh GPS.');
      if (!locationTesting && !isWithinOrderingPerimeter(getDistanceInMeters(location.lat, location.lng, shop.lat, shop.lng), location.accuracy)) throw new Error('You must be on campus to order.');
      const order = await createOrderInDb({ ...data, location, testOrder: locationTesting });
      void notifyOrderEvent(order.id, 'created');
      commitOrder({ order }); setActiveOrderIdState(order.id); clearCart();
      await AsyncStorage.setItem(`@skipq_active_pass_${auth.currentUser.uid}`, order.id).catch(() => {});
      await acknowledgeOrder().catch(() => {});
      playOrderPlacedSound(); return order;
    } finally { orderInFlight.current = false; }
  };
  const markOrderReady = async id => { const order = commitOrder(await updateOrderStatusInDb(id, 'Ready for Pickup')); void notifyOrderEvent(id, 'ready'); announceTokenReady(order.tokenNumber, order.shopName); };
  const markOrderCompleted = async () => { throw new Error('Enter the customer pickup PIN to complete this order.'); };
  const verifyAndCompleteOrder = async (id, pin) => { commitOrder(await verifyOrderPinInDb(id, pin)); return true; };
  const confirmUpiPayment = async id => commitOrder(await confirmUpiPaymentInFirestore(id));
  const cancelOrder = async id => commitOrder(await cancelOrderInDb(id)).refundText;
  const markOrderAbandoned = async id => { commitOrder(await abandonOrderInDb(id)); return {}; };
  const reorderItems = id => {
    const order = orders.find(item => item.id === id);
    const shop = canteens.find(item => item.id === order?.shopId);
    if (!shop || shop.status !== 'Open') { Alert.alert('Canteen unavailable', 'This canteen is not accepting orders. Choose another canteen.'); return false; }
    const items = (order.items || []).map(item => { const dish = shop.menu?.find(dish => dish.id === item.id && dish.isAvailable); return dish ? { ...dish, qty: Math.min(20, item.qty) } : null; }).filter(Boolean);
    if (!items.length) { Alert.alert('Dishes unavailable', 'Choose dishes from the current menu.'); return false; }
    setCartState({ shopId: shop.id, shopName: shop.name, items, specialInstructions: '' });
    return true;
  };
  const rateOrder = async (id, rating, review, dishRatings) => { commitOrder(await rateOrderInFirestore(id, rating, review, dishRatings)); };
  const topUpWallet = async () => { throw new Error('Wallet payments and top-ups are unavailable. Pay in cash at pickup; UPI is coming soon.'); };
  const logoutUser = async () => {
    await unregisterPushDevice();
    resetLocation();
    await signOutUser(); setOrdersState([]); setCartState(EMPTY_CART); setUserProfileState(EMPTY_PROFILE);
    setActiveOrderIdState(null); setRoleState('buyer'); setSellerShopIdState(null); setSellerApproved(false); setIsOnboardingComplete(false);
  };
  const refreshFirebaseState = async () => ({ isConfigured: isFirebaseConfigured });
  return <AppContext.Provider value={{
    isOnboardingComplete, completeOnboarding, restartOnboarding, university, setUniversity, role, setRole,
    sellerShopId, setSellerShopId, sellerApproved, sellerSetupStatus, sellerSetupError,
    retrySellerSetup: () => setSellerSetupAttempt(value => value + 1), userProfile, updateUserProfile,
    canteens, addCanteen, updateCanteen, saveSellerSettings, deleteCanteen, addMenuItem, updateMenuItem, deleteMenuItem, toggleItemStock, updateItemPrice,
    cart, addToCart, updateCartQty, setSpecialInstructions, setCartSpecialInstructions: setSpecialInstructions, clearCart,
    orders, placeOrder, markOrderReady, markOrderCompleted, verifyAndCompleteOrder, confirmUpiPayment, cancelOrder, markOrderAbandoned, reorderItems, rateOrder,
    activeOrderId, setActiveOrderIdState, userLocation, locationTesting, requestUserLocation, locationPermissionGranted, locationStatus, locationError, openLocationSettings,
    walletBalance, topUpWallet, unclaimedOrderCount, banStatus, banUntil,
    rushModeActive, setRushModeActive, toggleRushMode: () => setRushModeActive(previous => !previous),
    logoutUser, firebaseActive, refreshFirebaseState, firebaseConfigModalVisible, setFirebaseConfigModalVisible
  }}>{children}</AppContext.Provider>;
}
