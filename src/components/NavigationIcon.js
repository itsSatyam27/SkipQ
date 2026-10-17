import React, { useEffect, useRef } from 'react';
import { View, Animated, Platform } from 'react-native';
import useReducedMotion from '../hooks/useReducedMotion';
import Svg, { Path, Circle } from 'react-native-svg';

export default function NavigationIcon({ name, color = '#64748b', focused = false, size = 23, highlight = true }) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: focused ? 1 : 0, duration: reduced ? 0 : 160, useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [focused, reduced, progress]);
  const paths = {
    Explore: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
    Cart: 'M3 3h2l2.4 12h11.9L22 7H6M8 19h.01M18 19h.01',
    Profile: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    Account: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    Orders: 'M9 4H5v17h14V4h-4M9 2h6v5H9ZM8 11h8m-8 4h6',
    Menu: 'M4 3h16v18H4ZM8 7h8m-8 5h8m-8 5h5',
    Stats: 'M4 20V10m6 10V4m6 16v-7m5 8H2',
  };
  return <View style={{ width: 48, height: 30, alignItems: 'center', justifyContent: 'center' }}>
    {highlight && <Animated.View style={{ position: 'absolute', width: 48, height: 30, borderRadius: 15, backgroundColor: '#e7f2ff', opacity: progress, transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] }} />}
    <View style={{ zIndex: 1 }}><Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path d={paths[name] || paths.Explore} fill="none" stroke={color} strokeWidth={focused ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
      {name === 'Cart' && <><Circle cx={9} cy={20} r={1.25} fill={color} /><Circle cx={18} cy={20} r={1.25} fill={color} /></>}
    </Svg></View>
  </View>;
}
