import React, { useContext } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSellerTheme } from '../context/SellerTheme';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import InterfaceIcon from './InterfaceIcon';

export default function Header({ onOpenPassModal }) {
  const { university, activeOrderId, orders } = useContext(AppContext);
  const { light, toggle } = useSellerTheme();
  const insets = useSafeAreaInsets();
  const campus = DEFAULT_UNIVERSITIES.find(u => u.id === university) || DEFAULT_UNIVERSITIES[0];
  const order = orders.find(o => o.id === activeOrderId);
  const hasPass = order && !['Completed', 'Cancelled'].includes(order.orderStatus);
  const ink = light ? '#172333' : '#f5f4f0';
  const muted = light ? '#657184' : '#9b9fa9';
  const border = light ? '#e2e5eb' : '#26292e';
  return <View style={[s.outer,{paddingTop: Math.max(insets.top,12), backgroundColor:light?'#f6f7f9':'#090b0d'}]}>
    <View style={s.row}>
      <Image accessibilityLabel="SkipQ logo" source={require('../../assets/icon.png')} style={s.logo} />
      <View style={s.brand}><Text style={[s.name,{color:ink}]}>SkipQ</Text><View style={s.campusRow}><InterfaceIcon name="location" size={11} color={muted}/><Text numberOfLines={1} style={[s.campus,{color:muted}]}>{campus.name}</Text></View></View>
      {hasPass && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open active pickup pass" onPress={onOpenPassModal} style={[s.action,{backgroundColor:'#ffb313',borderColor:'#ffb313'}]}><InterfaceIcon name="orders" size={19} color="#090b0d" /></TouchableOpacity>}
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={light?'Switch to dark mode':'Switch to light mode'} onPress={toggle} style={[s.action,{backgroundColor:light?'#fff':'#17191d',borderColor:border}]}><InterfaceIcon name={light?'moon':'sun'} size={19} color={ink}/></TouchableOpacity>
    </View>
  </View>;
}
const s=StyleSheet.create({outer:{paddingHorizontal:20,paddingBottom:15},row:{width:'100%',maxWidth:728,alignSelf:'center',flexDirection:'row',alignItems:'center',gap:10,paddingTop:10},logo:{width:42,height:42,borderRadius:13},brand:{flex:1,minWidth:0},name:{fontSize:21,fontWeight:'700',letterSpacing:-0.7,lineHeight:25},campusRow:{flexDirection:'row',gap:4,alignItems:'center',marginTop:3},campus:{fontSize:10,lineHeight:14,flexShrink:1},action:{width:40,height:40,borderWidth:1,borderRadius:14,alignItems:'center',justifyContent:'center'}});
