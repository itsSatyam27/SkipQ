import React, { useEffect, useRef } from 'react';
import { Animated, AccessibilityInfo } from 'react-native';
import Svg, { Path } from 'react-native-svg';
const outlined = ["M16,6l-0.44,0.55c-0.42,0.52-0.98,0.75-1.54,0.75C13,7.3,12,6.52,12,5.3V2c0,0-8,4-8,11c0,4.42,3.58,8,8,8s8-3.58,8-8 C20,10.04,18.39,7.38,16,6z M12,19c-1.1,0-2-0.87-2-1.94c0-0.51,0.2-0.99,0.58-1.36l1.42-1.4l1.43,1.4 C13.8,16.07,14,16.55,14,17.06C14,18.13,13.1,19,12,19z M15.96,17.5L15.96,17.5c0.04-0.36,0.22-1.89-1.13-3.22l0,0L12,11.5 l-2.83,2.78l0,0c-1.36,1.34-1.17,2.88-1.13,3.22C6.79,16.4,6,14.79,6,13c0-3.16,2.13-5.65,4.03-7.25c0.23,1.99,1.93,3.55,3.99,3.55 c0.78,0,1.54-0.23,2.18-0.66C17.34,9.78,18,11.35,18,13C18,14.79,17.21,16.4,15.96,17.5z"];
const filled = ["M12,12.9l-2.13,2.09C9.31,15.55,9,16.28,9,17.06C9,18.68,10.35,20,12,20s3-1.32,3-2.94c0-0.78-0.31-1.52-0.87-2.07 L12,12.9z","M16,6l-0.44,0.55C14.38,8.02,12,7.19,12,5.3V2c0,0-8,4-8,11c0,2.92,1.56,5.47,3.89,6.86C7.33,19.07,7,18.1,7,17.06 c0-1.32,0.52-2.56,1.47-3.5L12,10.1l3.53,3.47c0.95,0.93,1.47,2.17,1.47,3.5c0,1.02-0.31,1.96-0.85,2.75 c1.89-1.15,3.29-3.06,3.71-5.3C20.52,10.97,18.79,7.62,16,6z"];
export default function RushModeIcon({ active }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!mounted || reduced) return;
      Animated.sequence([Animated.timing(scale, { toValue: 1.18, duration: 150, useNativeDriver: true }), Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true })]).start();
    });
    return () => { mounted = false; scale.stopAnimation(); };
  }, [active, scale]);
  return <Animated.View style={{ transform: [{ scale }] }}><Svg width={32} height={32} viewBox="0 0 24 24">{(active ? filled : outlined).map((d, i) => <Path key={i} d={d} fill={active ? '#F5A524' : '#8a8a8a'} />)}</Svg></Animated.View>;
}
