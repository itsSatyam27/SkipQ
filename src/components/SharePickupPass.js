import React, { useRef, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { pickupShareData } from '../utils/pickupShare.cjs';

export default function SharePickupPass({ order, shop, onClose }) {
  const ref = useRef(null), lock = useRef(false);
  const [busy, setBusy] = useState(false), [laidOut, setLaidOut] = useState(false), [logoReady, setLogoReady] = useState(false);
  const insets = useSafeAreaInsets();
  let pass, error;
  try { pass = pickupShareData(order, shop); } catch (e) { error = e.message; }
  const share = async () => {
    if (lock.current || !pass || !laidOut || !logoReady) return;
    lock.current = true; setBusy(true); let uri;
    try {
      uri = await captureRef(ref, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' });
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const file = new File([blob], 'SkipQ-pickup-pass.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'SkipQ pickup pass', text: 'Please collect my order 🙌' });
        else { const a = document.createElement('a'); a.href = uri; a.download = file.name; a.click(); }
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('Image sharing is unavailable on this device.');
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share SkipQ pickup pass' });
      }
    } catch (e) { if (e.name !== 'AbortError') Alert.alert('Could not share pass', 'Please try again. ' + (e.message || '')); }
    finally { if (uri && Platform.OS !== 'web') releaseCapture(uri); lock.current = false; setBusy(false); }
  };
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <View style={[s.screen, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={s.toolbar}><Text style={s.heading}>Share pickup pass</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Close share preview" onPress={onClose} style={s.close}><Text style={s.closeText}>Close</Text></Pressable></View>
      <ScrollView contentContainerStyle={s.scroll}>
        {error ? <Text style={s.note}>{error}</Text> : <View ref={ref} collapsable={false} onLayout={() => setLaidOut(true)} style={s.card}>
          <View style={s.brand}><Image source={require('../../assets/icon.png')} onLoad={() => setLogoReady(true)} onError={() => setLogoReady(true)} style={s.logo}/><View><Text style={s.wordmark}>SkipQ</Text><Text style={s.tagline}>Skip every line.</Text></View><Text style={s.passType}>{pass.title.toUpperCase()}</Text></View>
          <View style={s.body}><Text style={s.eyebrow}>YOUR CAMPUS, YOUR FOOD</Text><Text style={s.shop}>{pass.shop}</Text>
            <View style={s.tokenRow}><Text style={s.muted}>ORDER TOKEN</Text><Text style={s.token}>{pass.token}</Text></View>
            <View style={s.pinBox}><Text style={s.pinLabel}>HANDOVER PIN</Text><Text style={s.pin}>{pass.pin}</Text><Text style={s.instruction}>{pass.instruction}</Text></View>
            <Text style={s.label}>{pass.locationLabel}</Text><Text style={s.location}>{pass.location}</Text>
            <View style={s.items}>{pass.items.map((item, i) => <View key={i} style={s.item}><Text style={s.itemName}>{item.name}</Text><Text style={s.qty}>×{item.qty}</Text></View>)}</View>
            <View style={s.payment}><Text style={s.label}>PAYMENT AT TIME OF SHARING</Text><Text style={s.paymentText}>{pass.payment}</Text></View>
            <Text style={s.foot}>{pass.note}</Text>
          </View><View style={s.bottom}><Text style={s.bottomText}>Good food. Less waiting.</Text></View>
        </View>}
        <Text style={s.note}>Share only with the friend collecting your order. This pass contains your handover PIN.</Text>
      </ScrollView>
      <Pressable accessibilityRole="button" accessibilityLabel="Share pass image" disabled={busy || !pass || !laidOut || !logoReady} onPress={share} style={[s.button, (busy || !pass || !laidOut || !logoReady) && { opacity: 0.5 }]}><Text style={s.buttonText}>{busy ? 'Preparing image…' : Platform.OS === 'web' ? 'Share / download image' : 'Share pass image'}</Text></Pressable>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#090b0d',paddingHorizontal:18},toolbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:14},heading:{color:'#fff',fontSize:19,fontWeight:'700'},close:{padding:12},closeText:{color:'#ffb313'},scroll:{alignItems:'center',paddingBottom:16},
  card:{width:'100%',maxWidth:420,backgroundColor:'#fffaf0',borderRadius:24,overflow:'hidden'},brand:{backgroundColor:'#ffb313',padding:20,flexDirection:'row',alignItems:'center',gap:10},logo:{width:44,height:44,borderRadius:12},wordmark:{fontSize:26,fontWeight:'900',color:'#131517'},tagline:{fontSize:10,color:'#3a2a08'},passType:{flex:1,textAlign:'right',fontSize:9,fontWeight:'800',letterSpacing:1,color:'#131517'},body:{padding:22},eyebrow:{fontSize:9,fontWeight:'800',letterSpacing:1.4,color:'#806011'},shop:{fontSize:25,fontWeight:'800',color:'#131517',marginTop:8},tokenRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12,marginVertical:18},muted:{fontSize:9,color:'#666',letterSpacing:1},token:{fontSize:14,fontWeight:'700',color:'#25282c',flexShrink:1},pinBox:{backgroundColor:'#131517',borderRadius:18,padding:18,alignItems:'center'},pinLabel:{color:'#ffbd31',fontSize:10,letterSpacing:2,fontWeight:'700'},pin:{color:'#ffbd31',fontSize:52,fontWeight:'900',letterSpacing:10,marginVertical:7},instruction:{color:'#eee',fontSize:11,lineHeight:17,textAlign:'center'},label:{fontSize:9,fontWeight:'800',letterSpacing:1,color:'#806011',marginTop:18},location:{color:'#25282c',fontSize:14,lineHeight:20,marginTop:6},items:{borderTopWidth:1,borderColor:'#e4ddcf',marginTop:18,paddingTop:12,gap:9},item:{flexDirection:'row',gap:12},itemName:{flex:1,fontSize:14,lineHeight:21,color:'#25282c'},qty:{fontSize:14,color:'#25282c',fontWeight:'800'},payment:{marginTop:8},paymentText:{fontSize:16,fontWeight:'700',color:'#25282c',marginTop:6,lineHeight:23},foot:{color:'#686156',fontSize:10,lineHeight:16,marginTop:18},bottom:{backgroundColor:'#ffb313',padding:12,alignItems:'center'},bottomText:{fontSize:11,fontWeight:'700',color:'#131517'},note:{color:'#a5a9b2',fontSize:12,lineHeight:18,marginTop:15,textAlign:'center',maxWidth:420},button:{backgroundColor:'#ffb313',borderRadius:15,padding:16,alignItems:'center',marginTop:8},buttonText:{color:'#131517',fontSize:15,fontWeight:'800'}
});
