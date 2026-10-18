import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSellerTheme } from '../context/SellerTheme';
import useReducedMotion from '../hooks/useReducedMotion';
import NavigationIcon from './NavigationIcon';

export default function SmoothTabBar({ state, descriptors, navigation }) {
  const { light } = useSellerTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const previousWidth = useRef(0);
  const cell = Math.max(0, width - 14) / state.routes.length;
  useEffect(() => {
    const target = state.index * cell;
    if (reduced || previousWidth.current !== width) { x.setValue(target); previousWidth.current = width; return; }
    const motion = Animated.spring(x, { toValue: target, damping: 24, stiffness: 260, mass: 0.8, useNativeDriver: true });
    motion.start(); return () => motion.stop();
  }, [state.index, cell, reduced, width, x]);
  return <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={[s.bar, { left: Math.max(20,insets.left), right: Math.max(20,insets.right), bottom: Math.max(12,insets.bottom), backgroundColor:light?'#fff':'#17191d', borderColor:light?'#dce0e7':'#26292e' }]}>
    {width > 0 && <Animated.View pointerEvents="none" style={[s.selection,{width:cell,transform:[{translateX:x}]}]} />}
    {state.routes.map((route,index) => {
      const focused = state.index === index;
      const { options } = descriptors[route.key];
      const color = focused ? '#090b0d' : light ? '#596579' : '#a5a9b2';
      return <Pressable key={route.key} role="tab" accessibilityRole="tab" accessibilityLabel={options.tabBarAccessibilityLabel || route.name} accessibilityState={{selected:focused}} testID={options.tabBarButtonTestID} android_ripple={null} style={s.tab}
        onPress={() => { const event = navigation.emit({type:'tabPress',target:route.key,canPreventDefault:true}); if(!focused && !event.defaultPrevented) navigation.navigate(route.name,route.params); }}
        onLongPress={() => navigation.emit({type:'tabLongPress',target:route.key})}>
        <View><NavigationIcon name={route.name} color={color} focused={focused} highlight={false} />{options.tabBarBadge != null && <View style={s.badge}><Text style={s.badgeText}>{Number(options.tabBarBadge)>99?'99+':options.tabBarBadge}</Text></View>}</View>
        <Text style={[s.label,{color}]}>{options.title || route.name}</Text>
      </Pressable>;
    })}
  </View>;
}
const s=StyleSheet.create({bar:{position:'absolute',height:70,borderRadius:24,borderWidth:1,paddingHorizontal:6,flexDirection:'row',alignItems:'center'},selection:{position:'absolute',left:6,top:5,bottom:5,borderRadius:19,backgroundColor:'#ffb313'},tab:{flex:1,height:60,justifyContent:'center',alignItems:'center',borderRadius:19},label:{fontSize:11,lineHeight:15,fontWeight:'600',marginTop:1},badge:{position:'absolute',right:0,top:-2,minWidth:17,height:17,borderRadius:9,paddingHorizontal:4,backgroundColor:'#ffb313',borderWidth:1,borderColor:'#fff',alignItems:'center',justifyContent:'center'},badgeText:{fontSize:10,fontWeight:'700',color:'#090b0d'}});

