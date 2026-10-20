import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import useReducedMotion from '../hooks/useReducedMotion';
import { prepLabel } from '../utils/orderDisplay.cjs';
import InterfaceIcon from './InterfaceIcon';
import DishRating from './DishRating';

export default function DishPreview({ shop, item, visible, onClose, onAdd, quantity = 0 }) {
  const s = useSellerStyles(styles);
  const { light } = useSellerTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const available = shop?.status === 'Open' && item?.isAvailable !== false;
  return <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
    <View style={s.overlay}><Pressable accessibilityRole="button" accessibilityLabel="Dismiss dish preview" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[s.sheet,{height:height*0.55,paddingBottom:Math.max(insets.bottom,16),backgroundColor:light?'#fff':'#121417'}]}>
        <View style={s.handle}/><View style={s.heading}><Text style={s.kicker}>DISH PREVIEW</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dish preview" onPress={onClose} hitSlop={10} style={s.close}><InterfaceIcon name="close" color={light?'#172333':'#f5f4f0'} size={20}/></Pressable></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
          <View style={s.heroRow}>
            {item?.image ? <Image source={{uri:item.image}} accessibilityLabel={item.name} resizeMode="cover" style={s.image}/> : null}
            <View style={s.heroInfo}>
              <View style={s.titleRow}><View style={[s.diet,{borderColor:item?.isVeg === false?'#ef4444':'#10b981'}]}><View style={[s.dot,{backgroundColor:item?.isVeg === false?'#ef4444':'#10b981'}]}/></View><Text style={s.title}>{item?.name || 'Dish unavailable'}</Text></View>
              <Text style={s.meta}>{shop?.name || 'Canteen unavailable'} · {prepLabel(item?.prepTime)}</Text>
              <DishRating value={shop?.dishRatings?.[item?.id]} />
            </View>
          </View>
          <Text style={s.description}>{item?.description?.trim() || 'The seller has not added a description for this dish yet.'}</Text>
        </ScrollView>
        <View style={s.footer}><View><Text style={s.price}>{'\u20B9'}{item?.price ?? '--'}</Text><Text style={s.meta}>{quantity ? `${quantity} in cart` : 'Per serving'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Add previewed dish to cart" disabled={!available} onPress={() => onAdd(shop,item)} style={[s.add,!available && {opacity:0.5}]}><Text style={s.addText}>{!shop || shop.status !== 'Open' ? 'Orders paused' : !available ? 'Sold out' : quantity ? '+ Add another' : '+ Add to cart'}</Text></Pressable></View>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({overlay:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.45)'},sheet:{width:'100%',maxWidth:640,alignSelf:'center',borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:22},handle:{width:35,height:4,borderRadius:2,backgroundColor:'#797e89',alignSelf:'center',marginTop:10},heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10},kicker:{fontSize:10,fontWeight:'700',letterSpacing:1.5,color:'#ffb313'},close:{padding:7},content:{paddingBottom:16},heroRow:{flexDirection:'row',alignItems:'center',gap:16},heroInfo:{flex:1,minWidth:0},image:{width:'40%',height:140,borderRadius:17},titleRow:{flexDirection:'row',alignItems:'center',gap:8},title:{flex:1,color:'#f5f4f0',fontSize:21,fontWeight:'700'},diet:{width:14,height:14,borderWidth:1,borderRadius:3,justifyContent:'center',alignItems:'center'},dot:{width:6,height:6,borderRadius:3},meta:{fontSize:11,lineHeight:17,color:'#a5a9b2',marginTop:5},description:{color:'#b6bac2',fontSize:13,lineHeight:21,marginTop:14},footer:{borderTopWidth:1,borderColor:'#26292e',paddingTop:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:16},price:{fontSize:20,fontWeight:'700',color:'#f5f4f0'},add:{backgroundColor:'#ffb313',paddingHorizontal:20,paddingVertical:14,borderRadius:14},addText:{fontSize:13,fontWeight:'700',color:'#090b0d'}});
