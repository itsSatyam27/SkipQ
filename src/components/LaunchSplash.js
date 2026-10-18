import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useReducedMotion from '../hooks/useReducedMotion';

const fill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };

// Native equivalent of the supplied skipq-splash.js, without DOM or remote fonts.
export default function LaunchSplash({ ready, onFinished }) {
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [laidOut, setLaidOut] = useState(false);
  const tile = useRef(new Animated.Value(0)).current;
  const base = useRef(new Animated.Value(0)).current;
  const dome = useRef(new Animated.Value(0)).current;
  const bolt = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const tag = useRef(new Animated.Value(0)).current;
  const loader = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!laidOut) return;
    const entries = [[tile,100,700],[base,500,400],[dome,600,650],[bolt,1200,500],[word,1500,500],[tag,1800,500],[loader,2200,400]];
    const animations = entries.map(([value, delay, duration]) => Animated.timing(value, { toValue: 1, delay: reduced ? 0 : delay, duration: reduced ? 0 : duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }));
    animations.forEach(a => a.start());
    const loop = Animated.loop(Animated.sequence([Animated.delay(2400), Animated.timing(hop,{toValue:1,duration:1100,easing:Easing.inOut(Easing.cubic),useNativeDriver:true}),Animated.delay(700),Animated.timing(hop,{toValue:0,duration:0,useNativeDriver:true})]));
    if (!reduced) loop.start();
    const timer = setTimeout(() => setMinimumElapsed(true), reduced ? 500 : 2800);
    return () => { clearTimeout(timer); animations.forEach(a => a.stop()); loop.stop(); };
  }, [laidOut, reduced]);
  useEffect(() => {
    if (!ready || !minimumElapsed) return;
    const fade = Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 350, useNativeDriver: true });
    fade.start(({finished}) => { if (finished) onFinished(); });
    return () => fade.stop();
  }, [ready, minimumElapsed, reduced, onFinished]);
  const layer = (value, transform, children) => <Animated.View style={[fill,{opacity:value,transform}]}><Svg width={148} height={148} viewBox="0 0 1024 1024">{children}</Svg></Animated.View>;
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Loading SkipQ" style={[s.screen,{opacity}]} onLayout={() => { setLaidOut(true); if (Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {}); }}>
    <StatusBar barStyle="light-content" backgroundColor="#0B0C0E" />
    <View style={s.center}><View style={s.mark}>
      {layer(tile,[{scale:tile.interpolate({inputRange:[0,1],outputRange:[0.6,1]})}],<Rect width="1024" height="1024" rx="230" fill="#FFB020" />)}
      {layer(base,[{scaleX:base}],<Rect x="182" y="640" width="660" height="72" rx="36" fill="#0B0C0E" />)}
      {layer(dome,[{translateY:dome.interpolate({inputRange:[0,1],outputRange:[-32,0]})}],<><Path d="M232 640 A280 280 0 0 1 792 640 Z" fill="#0B0C0E" /><Circle cx="512" cy="322" r="46" fill="#0B0C0E" /></>)}
      {layer(bolt,[{scale:bolt.interpolate({inputRange:[0,1],outputRange:[0.3,1]})}],<Polygon points="552,400 440,548 508,548 474,628 592,478 524,478" fill="#FFB020" stroke="#FFB020" strokeWidth="14" strokeLinejoin="round" />)}
    </View><Animated.Text style={[s.word,{opacity:word,transform:[{translateY:word.interpolate({inputRange:[0,1],outputRange:[16,0]})}]}]}>SkipQ</Animated.Text><Animated.Text style={[s.tag,{opacity:tag}]}>Skip every line.</Animated.Text></View>
    <Animated.View style={[s.loader,{bottom:88+insets.bottom,opacity:loader}]}>{[0,36,72].map(left=><View key={left} style={[s.dot,{left}]} />)}<Animated.View style={[s.amber,{transform:[{translateX:hop.interpolate({inputRange:[0,1],outputRange:[0,-108]})},{translateY:hop.interpolate({inputRange:[0,0.5,1],outputRange:[0,-22,0]})}]}]} /></Animated.View>
  </Animated.View>;
}
const s=StyleSheet.create({screen:{...fill,backgroundColor:'#0B0C0E',zIndex:1000,alignItems:'center',justifyContent:'center'},center:{alignItems:'center'},mark:{width:148,height:148},word:{color:'#F3F1EC',fontSize:46,lineHeight:52,fontWeight:'800',letterSpacing:-0.46,marginTop:28},tag:{color:'#A5A8AF',fontSize:15,marginTop:12},loader:{position:'absolute',width:124,height:20},dot:{position:'absolute',top:4,width:12,height:12,borderRadius:6,backgroundColor:'#33363D'},amber:{position:'absolute',top:2,left:108,width:16,height:16,borderRadius:8,backgroundColor:'#FFB020'}});

