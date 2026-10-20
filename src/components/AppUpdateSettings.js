import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Updates from 'expo-updates';
import { useSellerStyles } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';

export default function AppUpdateSettings() {
  const s = useSellerStyles(styles);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('App improvements download on launch and apply the next time you open SkipQ.');
  const supported = Platform.OS !== 'web' && Updates.isEnabled;
  const check = async () => {
    if (busy || !supported) return;
    setBusy(true); setMessage('Checking for updates...');
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) { setMessage('Your app is up to date.'); return; }
      setMessage('Downloading the latest update...');
      const download = await Updates.fetchUpdateAsync();
      if (!download.isNew && !download.isRollBackToEmbedded) { setMessage('Your app is up to date.'); return; }
      setMessage('Update ready. It will apply next time you open the app.');
      Alert.alert('Update ready', 'Restart SkipQ now? Finish any checkout or unsaved edits first.', [{text:'Later',style:'cancel'}, {text:'Restart',onPress:() => Updates.reloadAsync().catch(() => setMessage('Close and reopen SkipQ to apply the update.'))}]);
    } catch { setMessage('Could not check for updates. Check your connection and retry.'); }
    finally { setBusy(false); }
  };
  return <View style={s.card}><View style={s.heading}><InterfaceIcon name="info" size={20} color="#ffb313" /><Text style={s.title}>App updates</Text></View>
    <Text style={s.copy} accessibilityLiveRegion="polite">{supported ? message : Platform.OS === 'web' ? 'Refresh this page to load the latest website version.' : 'OTA updates require an updated production APK. They are unavailable in this build.'}</Text>
    {supported && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={check} style={s.button}>{busy ? <ActivityIndicator color="#090b0d" /> : <Text style={s.buttonText}>Check for updates</Text>}</TouchableOpacity>}
  </View>;
}
const styles=StyleSheet.create({card:{padding:18,borderWidth:1,borderColor:'#26292e',borderRadius:18,backgroundColor:'#121417',marginBottom:16},heading:{flexDirection:'row',alignItems:'center',gap:9},title:{color:'#f5f4f0',fontWeight:'700',fontSize:15},copy:{color:'#a5a9b2',fontSize:12,lineHeight:19,marginTop:10},button:{alignSelf:'flex-start',backgroundColor:'#ffb313',borderRadius:12,padding:13,marginTop:14},buttonText:{color:'#090b0d',fontWeight:'700',fontSize:12}});
