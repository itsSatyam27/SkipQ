import SmoothTabBar from './src/components/SmoothTabBar';
import { SellerThemeProvider, useSellerTheme } from './src/context/SellerTheme';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import LaunchSplash from './src/components/LaunchSplash';
import { Platform, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlatformPressable } from '@react-navigation/elements';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppProvider, AppContext } from './src/context/AppContext';
import Header from './src/components/Header';
import NavigationIcon from './src/components/NavigationIcon';
import useReducedMotion from './src/hooks/useReducedMotion';
import StudentRadarView from './src/components/StudentRadarView';
import StudentCartScreen from './src/components/StudentCartScreen';
import StudentProfileScreen from './src/components/StudentProfileScreen';
import SellerPosView from './src/components/SellerPosView';
import SellerPendingScreen from './src/components/SellerPendingScreen';
import DigitalPickupPassModal from './src/components/DigitalPickupPassModal';
import AddMenuItemModal from './src/components/AddMenuItemModal';
import CreateCanteenModal from './src/components/CreateCanteenModal';
import OnboardingFlow from './src/components/OnboardingFlow';
import DynamicActiveBookingPill from './src/components/DynamicActiveBookingPill';
import CustomAlertModal from './src/components/CustomAlertModal';
import VendorProfileModal from './src/components/VendorProfileModal';
import { registerAlertListener, unregisterAlertListener } from './src/utils/customAlert';

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({ duration: 250, fade: true });
}
const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: '#0747a6', background: '#edf3f8', card: '#ffffff', text: '#0f172a', border: '#e2e8f0' } };
const tabOptions = { headerShown: false, tabBarButton: TabButton, tabBarActiveTintColor: '#0747a6', tabBarInactiveTintColor: '#64748b',
  tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  tabBarIconStyle: { height: 28 },
  tabBarStyle: { backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderWidth: 1, borderTopWidth: 1,
    borderRadius: 32, paddingTop: 4, paddingHorizontal: 8, marginTop: 8,
    ...Platform.select({ web: { boxShadow: '0px 5px 20px rgba(23, 57, 92, 0.07)' },
      default: { shadowColor: '#17395c', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 } }) },
  sceneStyle: { backgroundColor: '#edf3f8' } };
const tabIcon = (name, seller = false) => ({ color, focused }) => <NavigationIcon name={name} color={color} focused={focused} highlight={!seller} />;

function ExploreScreen({ navigation }) {
  const { addToCart } = useContext(AppContext);
  return <StudentRadarView onSelectOrderItem={(shop, item) => { addToCart(shop, item); navigation.navigate('Cart'); }}
    onOpenCartCheckout={() => navigation.navigate('Cart')} onOpenPassModal={() => navigation.navigate('PickupPass')} />;
}
function CartScreen({ navigation }) {
  return <View style={{ flex: 1 }}>
    <StudentCartScreen onOpenHistory={() => navigation.navigate('PastOrders')} onNavigateToExplore={() => navigation.navigate('Explore')}
    onOpenPassModal={() => navigation.navigate('PickupPass')} onOrderPlaced={() => navigation.navigate('PickupPass')} /></View>;
}
function PastOrdersScreen({ navigation }) {
  const { light } = useSellerTheme();
  const insets = useSafeAreaInsets();
  return <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: light ? '#f6f7f9' : '#090b0d' }}><StudentCartScreen historyOnly onBack={() => navigation.goBack()} onReordered={() => navigation.goBack()} onNavigateToExplore={() => navigation.navigate('Home', { screen: 'Explore' })} /></View>;
}
function ProfileScreen({ navigation }) { return <View style={{ flex: 1 }}><StudentProfileScreen onNavigateToExplore={() => navigation.navigate('Explore')} /></View>; }
function KitchenScreen({ navigation, route }) {
  const { sellerApproved } = useContext(AppContext);
  if (!sellerApproved) return <SellerPendingScreen />;
  const selectedTab = { Orders: 'orders', Menu: 'menu', Stats: 'analytics' }[route.name];
  return <View style={{ flex: 1 }}>
    <SellerPosView selectedTab={selectedTab} onTabChange={tab => navigation.navigate({ orders: 'Orders', menu: 'Menu', analytics: 'Stats' }[tab])}
    onOpenAddItemModal={shopId => navigation.navigate('AddDish', { shopId })} onOpenEditItemModal={(item, shopId) => navigation.navigate('EditDish', { item, shopId })}
    onOpenCreateCanteenModal={() => navigation.navigate('CreateCanteen')} onOpenSettings={section => navigation.navigate('Account', { section, settingsRequest: Date.now() })} /></View>;
}
function SellerAccountScreen({ route }) {
  return <VendorProfileModal visible embedded requestedSection={route.params?.section} settingsRequest={route.params?.settingsRequest} />;
}
function TabButton(props) {
  return <PlatformPressable {...props} pressColor="transparent" pressOpacity={0.78}
    android_ripple={{ color: 'transparent', borderless: false }}
    style={[props.style, { borderRadius: 18 }]} />;
}
function HomeScreen({ navigation }) {
  const { light } = useSellerTheme();
  const { role, cart, activeOrderId, orders } = useContext(AppContext);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [pillVisible, setPillVisible] = useState(false);
  const count = cart.items.reduce((sum, item) => sum + item.qty, 0);
  const order = orders.find(item => item.id === activeOrderId);
  return <View style={{ flex: 1, backgroundColor: light ? '#f6f7f9' : '#090b0d' }}>
    <Header onOpenPassModal={() => navigation.navigate('PickupPass')}
      onOpenProfileModal={() => navigation.navigate('Home', { screen: role === 'seller' ? 'Account' : 'Profile' })}
      isPillVisible={pillVisible} onToggleActivePill={() => setPillVisible(value => !value)} />
    <DynamicActiveBookingPill visible={pillVisible} activeOrder={order} onClose={() => setPillVisible(false)}
      onOpenPassModal={() => { setPillVisible(false); navigation.navigate('PickupPass'); }} />
    <Tabs.Navigator key={role} tabBar={props => <SmoothTabBar {...props} />} screenOptions={({ route }) => ({ ...tabOptions, lazy: false, animation: reducedMotion ? 'none' : 'fade', transitionSpec: { animation: 'timing', config: { duration: 220 } }, tabBarAccessibilityLabel: route.name,
      ...({ tabBarActiveTintColor: '#090b0d', tabBarInactiveTintColor: light ? '#596579' : '#a5a9b2', tabBarActiveBackgroundColor: '#ffb313', tabBarItemStyle: { borderRadius: 18, marginVertical: 2 }, tabBarLabelStyle: { fontSize: 11, lineHeight: 15, fontWeight: '600', marginBottom: 0 }, sceneStyle: { backgroundColor: light ? '#f6f7f9' : '#090b0d' } }),
      tabBarStyle: { ...tabOptions.tabBarStyle, ...({ backgroundColor: light ? '#fff' : '#17191d', borderColor: light ? '#dce0e7' : '#26292e', borderRadius: 24, paddingHorizontal: 7, paddingTop: 3, elevation: 0, shadowOpacity: 0 }), position: 'absolute', height: 70, paddingBottom: 4,
        left: Math.max(20, insets.left), right: Math.max(20, insets.right),
        bottom: Math.max(12, insets.bottom), marginTop: 0 } })} backBehavior="history">
      {role === 'seller' ? <>
        <Tabs.Screen name="Orders" component={KitchenScreen} options={{ title: 'Orders', tabBarIcon: tabIcon('Orders', true) }} />
        <Tabs.Screen name="Menu" component={KitchenScreen} options={{ title: 'Menu', tabBarIcon: tabIcon('Menu', true) }} />
        <Tabs.Screen name="Stats" component={KitchenScreen} options={{ title: 'Stats', tabBarIcon: tabIcon('Stats', true) }} />
        <Tabs.Screen name="Account" component={SellerAccountScreen} options={{ title: 'Account', tabBarIcon: tabIcon('Account', true) }} />
      </> : <>
        <Tabs.Screen name="Explore" component={ExploreScreen} options={{ tabBarIcon: tabIcon('Explore', true) }} />
        <Tabs.Screen name="Cart" component={CartScreen} options={{ tabBarIcon: tabIcon('Cart', true), tabBarBadge: count || undefined }} />
        <Tabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('Profile', true) }} />
      </>}
    </Tabs.Navigator>
  </View>;
}
function PickupScreen({ navigation }) {
  const { activeOrderId, orders } = useContext(AppContext);
  if (!orders.some(order => order.id === activeOrderId)) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#edf3f8' }}>
    <Text style={{ fontSize: 20, fontWeight: '800', color: '#0f172a' }}>No active pickup pass</Text>
    <Text style={{ marginVertical: 12, color: '#64748b' }}>Place an order to get a pickup pass.</Text>
    <TouchableOpacity accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={{ color: '#0747a6', fontWeight: '700', paddingVertical: 12 }}>← Back</Text></TouchableOpacity>
  </View>;
  return <DigitalPickupPassModal visible onClose={() => navigation.goBack()} />;
}
function DishScreen({ navigation, route }) { return <AddMenuItemModal visible shopId={route.params?.shopId} editItem={route.params?.item} onClose={() => navigation.goBack()} />; }
function CanteenScreen({ navigation }) { return <CreateCanteenModal visible onClose={() => navigation.goBack()} />; }
function VendorScreen({ navigation }) { return <VendorProfileModal visible onClose={() => navigation.goBack()} />; }

export function AppNavigator() { return <SellerThemeProvider><ThemedAppNavigator /></SellerThemeProvider>; }
function ThemedAppNavigator() {
  const { light } = useSellerTheme();
  const { isOnboardingComplete, userProfile, role } = useContext(AppContext);
  const [globalAlert, setGlobalAlert] = useState(null);
  useEffect(() => { registerAlertListener(setGlobalAlert); return unregisterAlertListener; }, []);
  if (isOnboardingComplete === null && Platform.OS !== 'web') return null;
  return <View style={{ flex: 1, backgroundColor: '#edf3f8' }} onLayout={() => {
    if (Platform.OS !== 'web' && isOnboardingComplete !== null) SplashScreen.hideAsync().catch(() => {});
  }}>
    <StatusBar barStyle={!light ? 'light-content' : 'dark-content'} backgroundColor={light ? '#f6f7f9' : '#090b0d'} />
    <NavigationContainer theme={theme}>
      <Stack.Navigator key={`${userProfile.uid || 'guest'}:${isOnboardingComplete ? role : 'setup'}`} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#edf3f8' } }}>
        {isOnboardingComplete ? <>
          <Stack.Screen name="Home" component={HomeScreen} />
          {role !== 'seller' && <Stack.Screen name="PastOrders" component={PastOrdersScreen} options={{ animation: 'slide_from_right' }} />}
          <Stack.Group screenOptions={{ presentation: 'transparentModal', animation: 'none' }}>
            <Stack.Screen name="PickupPass" component={PickupScreen} />
            {role === 'seller' && <>
              <Stack.Screen name="AddDish" component={DishScreen} />
              <Stack.Screen name="EditDish" component={DishScreen} />
              <Stack.Screen name="CreateCanteen" component={CanteenScreen} />
              <Stack.Screen name="VendorSettings" component={VendorScreen} />
            </>}
          </Stack.Group>
        </> : <Stack.Screen name="Setup" component={OnboardingFlow} />}
      </Stack.Navigator>
    </NavigationContainer>
    <CustomAlertModal alertData={globalAlert} onClose={() => setGlobalAlert(null)} />
  </View>;
}
export default function App() {
  return <SafeAreaProvider><AppProvider><AppLaunch /></AppProvider></SafeAreaProvider>;
}
function AppLaunch() {
  const { isOnboardingComplete } = useContext(AppContext);
  const [launching, setLaunching] = useState(true);
  const finish = useCallback(() => setLaunching(false), []);
  return <View style={{ flex: 1, backgroundColor: '#0B0C0E' }}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={launching} importantForAccessibility={launching ? 'no-hide-descendants' : 'auto'}><AppNavigator /></View>
    {launching && <LaunchSplash ready={isOnboardingComplete !== null} onFinished={finish} />}
  </View>;
}
