import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React from 'react';
import { Animated, Image, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function WelcomeScreen({ onStart, onMascotTap, mascotFloatY, mascotScale }) {
  const styles = useSellerStyles(baseStyles);
  const { light, toggle } = useSellerTheme();
  const { height, fontScale } = useWindowDimensions();
  const compact = height < 720 || fontScale > 1.2;
  const mascotSize = compact ? 120 : 170;
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle={light ? 'dark-content' : 'light-content'} backgroundColor={light ? '#f6f7f9' : '#090b0d'} />
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.logo}><Text style={styles.logoLetter}>S</Text></View>
          <View style={styles.brand}>
            <Text style={styles.brandName}>SkipQ</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={light ? 'Switch to dark mode' : 'Switch to light mode'} onPress={toggle} style={styles.modeButton}><InterfaceIcon name={light ? 'moon' : 'sun'} color={light ? '#172333' : '#f5f4f0'} size={20} /></TouchableOpacity>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, compact && styles.compactBody]} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={onMascotTap} accessibilityRole="button" accessibilityLabel="Say hello to Skip" style={styles.mascotTap}>
            <Animated.View style={{ transform: [{ translateY: mascotFloatY }, { scale: mascotScale }] }}>
              <Image source={require('../../assets/mascot.png')} resizeMode="contain" style={{ width: mascotSize, height: mascotSize }} />
            </Animated.View>
          </TouchableOpacity>
          <Text style={styles.hello}>Hi, I'm SkipQ. Let's eat!</Text>
          <View style={[styles.card, compact && styles.compactCard]}>
            <Text style={styles.eyebrow}>CAMPUS DINING, WITHOUT THE QUEUE</Text>
            <Text style={[styles.title, compact && styles.compactTitle]}>{'Skip Every\nLine.'}</Text>
            <Text style={styles.description}>Order ahead. Pick up fresh food between lectures.</Text>
            <View style={styles.features}>
              {[
                ['bolt', 'Order ahead', 'Choose from your campus canteens.'],
                ['orders', 'Collect with your PIN', 'Show your digital pickup pass.'],
                ['location', 'Made for campus', 'Order when you are nearby.']
              ].map(([icon, title, detail]) => (
                <View key={title} style={styles.feature}>
                  <View style={styles.featureIcon}><InterfaceIcon name={icon} color="#ffb313" size={21} /></View>
                  <View style={styles.featureCopy}>
                    <Text style={styles.featureTitle}>{title}</Text>
                    {!compact && <Text style={styles.featureDetail}>{detail}</Text>}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity onPress={onStart} accessibilityRole="button" accessibilityLabel="Get started or sign in" activeOpacity={0.85}>
            <LinearGradient colors={['#ffb313', '#ffb313']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.button}>
              <Text style={styles.buttonText}>Get Started / Sign In →</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.footerText}>Cash at pickup · UPI confirmed by your canteen</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  logoLetter: { color: '#090b0d', fontSize: 24, fontWeight: '900' },
  modeButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: '#090b0d', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 0 },
  frame: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: 42, height: 42 },
  brand: { flex: 1 }, brandName: { color: '#f5f4f0', fontWeight: '900', fontSize: 23 },
  body: { flex: 1 }, bodyContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  compactBody: { paddingTop: 4, paddingBottom: 4 }, mascotTap: { alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 100, padding: 8 },
  hello: { color: '#ffb313', fontSize: 13, fontWeight: '700', marginBottom: 14 },
  card: { width: '100%', paddingVertical: 12 },
  compactCard: { paddingVertical: 8 }, eyebrow: { color: '#ffb313', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  title: { color: '#f5f4f0', fontSize: 46, lineHeight: 48, letterSpacing: -1.5, fontWeight: '900', marginTop: 10 }, compactTitle: { fontSize: 36, lineHeight: 39, marginTop: 7 },
  description: { color: '#a5a9b2', fontSize: 14, lineHeight: 21, marginTop: 7 },
  features: { gap: 12, marginTop: 18 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#17191d', borderWidth: 1, borderColor: '#26292e', alignItems: 'center', justifyContent: 'center' }, featureCopy: { flex: 1 },
  featureTitle: { color: '#f5f4f0', fontSize: 14, fontWeight: '700' }, featureDetail: { color: '#a5a9b2', fontSize: 12, marginTop: 3 },
  footer: { flexShrink: 0, paddingTop: 10, paddingBottom: 12, backgroundColor: '#090b0d' },
  button: { minHeight: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 14 },
  buttonText: { color: '#090b0d', fontWeight: '800', fontSize: 16, textAlign: 'center' },
  footerText: { color: '#a5a9b2', fontSize: 10, textAlign: 'center', marginTop: 8 }
});
