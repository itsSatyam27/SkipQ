import { useSellerStyles, useSellerTheme } from '../context/SellerTheme';
import InterfaceIcon from './InterfaceIcon';
import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, BackHandler, Alert, ActivityIndicator, Image, Animated, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { AppContext } from '../context/AppContext';
import WelcomeScreen from './WelcomeScreen';
import CampusRoleSelect from './CampusRoleSelect';
import CampusSelectionScreen from './CampusSelectionScreen';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import { signInWithGoogle, googleSignInErrorMessage } from '../services/googleSignIn';
import { auth } from '../services/firebase';
import { getUserProfile, registerAccountProfile, signOutUser } from '../services/authService';

const mascotCharacter = require('../../assets/mascot.png');
const mascotIcon = require('../../assets/icon.png');

function SetupProgress({ current, total, label }) {
  const styles = useSellerStyles(baseStyles);
  return <View style={styles.progressContainer}>
    <View style={styles.progressBarsRow}>
      {Array.from({ length: total }, (_, index) => <View key={index} style={[styles.progressBarSegment,
        index + 1 < current && styles.progressBarCompleted, index + 1 === current && styles.progressBarActive]} />)}
    </View>
    <Text style={styles.progressLabel}>STEP {current} OF {total} · {label}</Text>
  </View>;
}

export default function OnboardingFlow() {
  const styles = useSellerStyles(baseStyles);
  const { light, toggle } = useSellerTheme();
  const {
    requestUserLocation,
    completeOnboarding,
  } = useContext(AppContext);

  // 0: Welcome, 1: Google login, 2: Campus, 3: Profile, 4: Location, 5: Seller setup
  const [step, setStep] = useState(0);

  // Step 1: Google sign-in
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(auth?.currentUser?.email || '');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const googleController = useRef(null);
  const [name, setName] = useState('');
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [existingUserName, setExistingUserName] = useState('');

  // Step 3: User Type ('student', 'faculty', 'seller')
  const [userType, setUserType] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  // Step 4: Location Permission
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // University is fixed to Silver Oak for Phase 1
  const [selectedUniversity, setSelectedUniversity] = useState('sou');
  const selectedCampusObj = DEFAULT_UNIVERSITIES.find(u => u.id === selectedUniversity) || DEFAULT_UNIVERSITIES[0];

  // Vendor Fields (if userType === 'seller')
  const [stallName, setStallName] = useState('');
  const [stallLocation, setStallLocation] = useState('');
  const [merchantUpi, setMerchantUpi] = useState('');


  // Animation values for the colorful mascot
  const mascotFloatY = useRef(new Animated.Value(0)).current;
  const mascotScale = useRef(new Animated.Value(1)).current;
  const auraScale = useRef(new Animated.Value(0.9)).current;
  const auraOpacity = useRef(new Animated.Value(0.5)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  // Start continuous floating & breathing animations for the mascot
  useEffect(() => {
    // 1. Gentle floating bob
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(mascotFloatY, {
          toValue: -14,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(mascotFloatY, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Synchronized ground shadow scale
    const shadowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shadowScale, {
          toValue: 0.75,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(shadowScale, {
          toValue: 1.05,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Radiant glowing aura pulse
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 1.18,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.85,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(auraScale, {
            toValue: 0.9,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.45,
            duration: 1800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    floatLoop.start();
    shadowLoop.start();
    auraLoop.start();

    return () => {
      floatLoop.stop();
      shadowLoop.stop();
      auraLoop.stop();
    };
  }, []);

  // Playful tap hop on the mascot
  const handleMascotTap = () => {
    Animated.sequence([
      Animated.spring(mascotFloatY, {
        toValue: -28,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(mascotFloatY, {
        toValue: 0,
        friction: 5,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  useEffect(() => () => googleController.current?.abort(), []);

  const fillProfile = profile => {
    setPhone(profile?.phone || ''); setName(profile?.name || auth?.currentUser?.displayName || '');
    setEmail(auth?.currentUser?.email || profile?.email || ''); setUserType(profile?.userType || 'student');
    setIsExistingUser(Boolean(profile?.profileComplete));
    setRollNo(profile?.rollNo || ''); setFacultyId(profile?.facultyId || ''); setRoomNumber(profile?.roomNumber || '');
    setStallName(profile?.stallName || ''); setStallLocation(profile?.stallLocation || ''); setMerchantUpi(profile?.merchantUpi || '');
  };
  useEffect(() => {
    let active = true;
    if (auth?.currentUser?.emailVerified) getUserProfile().then(profile => {
      if (active) { fillProfile(profile); setStep(profile?.profileComplete ? 3 : 2); }
    }).catch(error => { if (active) Alert.alert('Account unavailable', error.message); });
    return () => { active = false; };
  }, []);
  const handleGoogleSignIn = async () => {
    if (isGoogleSigningIn) return;
    const controller = new AbortController(); googleController.current = controller; setIsGoogleSigningIn(true);
    try {
      await signInWithGoogle({ signal: controller.signal });
      const profile = await getUserProfile();
      fillProfile(profile);
      if (profile?.profileComplete) {
        await completeOnboarding({ chosenRole: profile.userType === 'seller' ? 'seller' : 'buyer', chosenUniversity: profile.universityId || 'sou', profileData: profile });
      } else setStep(2);
    } catch (error) {
      if (error.code === 'ACCOUNT_BLOCKED') await signOutUser();
      if (error.name !== 'AbortError' && error.code !== 'auth/popup-closed-by-user') Alert.alert('Could not sign in', googleSignInErrorMessage(error));
    } finally { setIsGoogleSigningIn(false); googleController.current = null; }
  };
  const handleProfileContinue = async () => {
    if (isSavingProfile) return;
    if (!name.trim() || !/^[6-9]\d{9}$/.test(phone)) { Alert.alert('Complete your profile', 'Enter your name and a valid 10-digit Indian mobile number.'); return; }
    setIsSavingProfile(true);
    try {
      const profile = await registerAccountProfile({ name: name.trim(), phone, userType, rollNo, facultyId, roomNumber, facultyRoomNote: roomNumber, universityId: selectedUniversity });
      fillProfile(profile); setStep(4);
    } catch (error) {
      Alert.alert(error.code === 'PHONE_ALREADY_LINKED' ? 'Phone number already used' : 'Could not save profile', error.message);
    } finally { setIsSavingProfile(false); }
  };

  const setupScroll = useRef(null);
  useEffect(() => { setupScroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => {
    const back = () => {
      if (isGoogleSigningIn) { googleController.current?.abort(); return true; }
      if (isSavingProfile) return true;
      if (step > 0) { setStep(value => value - 1); return true; }
      return false;
    };
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [step, isGoogleSigningIn, isSavingProfile]);

  // Step 4 Handlers (Location)
  const handleGrantLocation = async () => {
    setIsRequestingLocation(true);
    try {
      await requestUserLocation();
      if (userType === 'seller') {
        setStep(5);
      } else {
        await handleFinishOnboarding();
      }
    } catch (error) {
      Alert.alert('Location unavailable', error.message || 'Enable device location and retry. You can also browse without location.');
    } finally { setIsRequestingLocation(false); }
  };

  const handleSkipLocation = async () => {
    if (userType === 'seller') {
      setStep(5);
    } else {
      await handleFinishOnboarding();
    }
  };

  // Step 5 Handlers (Finish & Enter Campus)
  const handleFinishOnboarding = async () => {
    if (isSavingProfile) return;
    const chosenRole = userType === 'seller' ? 'seller' : 'buyer';

    let vendorCanteenData = null;
    if (chosenRole === 'seller') {
      if (!stallName.trim()) {
        Alert.alert('Stall Name Required', 'Please enter your canteen or food counter name.');
        return;
      }
      vendorCanteenData = {
        name: stallName.trim(),
        location: stallLocation.trim() || 'Central Campus Food Court',
        openingHours: '08:00 AM - 08:00 PM',
        upiId: merchantUpi.trim(),
        phone: `+91 ${phone}`,
        initialMenu: []
      };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const profileToSave = {
      name: name.trim(),
      phone: cleanPhone,
      email,
      userType,
      rollNo: userType === 'student' ? (rollNo.trim() || '') : '',
      facultyId: userType === 'faculty' ? (facultyId.trim() || '') : '',
      roomNumber: userType === 'faculty' ? (roomNumber.trim() || '') : '',
      facultyRoomNote: userType === 'faculty' ? (roomNumber.trim() || '') : '',
      stallName: chosenRole === 'seller' ? stallName.trim() : undefined,
      stallLocation: chosenRole === 'seller' ? (stallLocation.trim() || 'Central Campus Food Court') : undefined,
      merchantUpi: chosenRole === 'seller' ? merchantUpi.trim() : undefined,
      universityId: selectedUniversity || 'sou'
    };

    setIsSavingProfile(true);
    try {
      await completeOnboarding({ chosenRole, chosenUniversity: selectedUniversity || 'sou', profileData: profileToSave, vendorCanteenData });

    } catch (error) { Alert.alert('Setup failed', error.message || 'Please retry.'); }
    finally { setIsSavingProfile(false); }
  };

  if (step === 0) {
    return <WelcomeScreen onStart={() => setStep(1)} onMascotTap={handleMascotTap} mascotFloatY={mascotFloatY} mascotScale={mascotScale} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={light ? 'dark-content' : 'light-content'} backgroundColor={light ? '#f6f7f9' : '#090b0d'} translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={setupScroll}
          contentContainerStyle={[styles.scrollContent, step === 1 && styles.loginScroll, step === 2 && { flexGrow: 1, paddingBottom: 12 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Header Bar Matching App Brand */}
          <View style={styles.topHeaderBar}>
            <View style={styles.topHeaderLeft}>
              <View style={styles.setupLogo}><Text style={styles.setupLogoLetter}>S</Text></View>
              <View>
                <Text style={styles.headerBrandTitle}>SkipQ</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={light ? 'Switch to dark mode' : 'Switch to light mode'} onPress={toggle} style={styles.modeButton}><InterfaceIcon name={light ? 'moon' : 'sun'} size={20} color={light ? '#172333' : '#f5f4f0'} /></TouchableOpacity>
          </View>

          {/* ========================================================================= */}
          {/* STEP 1: GOOGLE SIGN-IN */}
          {/* ========================================================================= */}
          {step === 1 && (
            <View style={styles.loginSection}>
            <View style={styles.loginCard}>
              <View style={styles.loginIcon} accessible accessibilityRole="image" accessibilityLabel="Secure verification">
                  <Svg width={28} height={28} viewBox="0 0 24 24" aria-hidden>
                    <Path d="M12 3 4.5 6v5.5c0 4.4 3 7.7 7.5 9.5 4.5-1.8 7.5-5.1 7.5-9.5V6L12 3Z" fill="none" stroke="#ffb313" strokeWidth={1.7} strokeLinejoin="round" />
                    <Path d="m8.5 12 2.3 2.3 4.7-4.8" fill="none" stroke="#ffb313" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
              </View>
              <Text style={styles.loginEyebrow}>YOUR NEXT BREAK, SORTED</Text>
              <Text style={styles.loginTitle}>Sign in to SkipQ</Text>
              <Text style={styles.loginCopy}>Good food. Less waiting.{ '\n' }Your campus favourites are one sign-in away.</Text>
              <TouchableOpacity style={[styles.googleButton, isGoogleSigningIn && { opacity: 0.65 }]} onPress={handleGoogleSignIn} disabled={isGoogleSigningIn} accessibilityRole="button" accessibilityLabel="Continue with Google" accessibilityState={{ busy: isGoogleSigningIn, disabled: isGoogleSigningIn }}>
                {isGoogleSigningIn ? <ActivityIndicator color="#0747a6" /> : <>
                  <Svg width={22} height={22} viewBox="0 0 48 48" aria-hidden>
                    <Path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5h6.5c3.8-3.5 6.1-8.6 6.1-14.7Z" />
                    <Path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.5-5c-1.8 1.2-4 1.9-6.7 1.9-5.2 0-9.6-3.5-11.2-8.2H6.1v5.2C9.4 39.6 16.2 44 24 44Z" />
                    <Path fill="#FBBC05" d="M12.8 27.9a12 12 0 0 1 0-7.8v-5.2H6.1a20 20 0 0 0 0 18.2l6.7-5.2Z" />
                    <Path fill="#EA4335" d="M24 11.9c2.9 0 5.4 1 7.4 2.9l5.6-5.6A19.2 19.2 0 0 0 24 4C16.2 4 9.4 8.4 6.1 14.9l6.7 5.2c1.6-4.7 6-8.2 11.2-8.2Z" />
                  </Svg>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>}
              </TouchableOpacity>
              {isGoogleSigningIn && <>
                <Text style={styles.extraFieldHint}>Choose your Google account to continue.</Text>
                <TouchableOpacity style={styles.backBtnFullWidth} onPress={() => googleController.current?.abort()}><Text style={styles.backBtnFullWidthText}>Cancel sign-in</Text></TouchableOpacity>
              </>}
              <Text style={styles.loginHint}>New here? Your account is created automatically.</Text>
              <View style={styles.loginFooter}>
                <Text style={styles.loginFooterTitle}>One account. Your campus.</Text>
                <Text style={styles.loginFooterCopy}>For students, faculty and sellers. Add your profile details after signing in.</Text>
              </View>
            </View>
              <TouchableOpacity style={styles.backBtnFullWidth} onPress={() => { googleController.current?.abort(); setStep(0); }}><Text style={styles.backBtnFullWidthText}>← Back to Welcome</Text></TouchableOpacity>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: COMPLETE YOUR PROFILE (NEW USERS)                                */}
          {/* ========================================================================= */}
          {step === 2 && (
            <View style={[styles.profileSection, { flex: 1 }]}>
              <SetupProgress current={2} total={userType === 'seller' ? 5 : 4} label="YOUR CAMPUS" />
              <CampusSelectionScreen selectedId={selectedUniversity} onSelect={id => { if (id === 'sou') setSelectedUniversity(id); }}
                onContinue={() => setStep(3)} onBack={() => setStep(1)} />
            </View>
          )}

          {step === 3 && (
            <View style={styles.profileSection}>
              {/* Progress Tracker */}
              <SetupProgress current={3} total={userType === 'seller' ? 5 : 4} label="PROFILE & ROLE" />

              <View style={[styles.contentCard, styles.profileCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden><Path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2" fill="none" stroke="#ffb313" strokeWidth={1.8} strokeLinecap="round" /></Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Complete your profile</Text>
                    <Text style={styles.cardSubtitle}>
                      A few details to make SkipQ yours.
                    </Text>
                  </View>
                </View>

                {/* Full Name Input */}
                <Text style={styles.profileLabel}>YOUR FULL NAME *</Text>
                <View style={styles.profileNameBox}>
                  <TextInput
                    style={styles.profileInputText} accessibilityLabel="Full name"
                    placeholder="e.g. Satyam Pandey"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>

                    <Text style={styles.profileLabel}>GOOGLE EMAIL · LINKED</Text>
                <TextInput style={styles.profileInput} value={email} editable={false} accessibilityLabel="Linked Google email" />
                <Text style={styles.profileLabel}>PHONE NUMBER *</Text>
                <View style={styles.profilePhoneBox}>
                  <Text style={styles.profileCountryCode}>+91</Text>
                  <TextInput style={styles.profilePhoneInput} value={phone} onChangeText={value => setPhone(value.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" maxLength={10} placeholder="10-digit mobile number" placeholderTextColor="#94a3b8" editable={!isExistingUser} accessibilityLabel="Phone number" />
                </View>
                <Text style={styles.extraFieldHint}>One number per account. Your email and phone are fixed after saving.</Text>

                <Text style={styles.profileLabel}>SELECT YOUR CAMPUS ROLE</Text>

                <CampusRoleSelect value={userType} onChange={setUserType} disabled={isExistingUser || isSavingProfile} />

                {/* Dynamic Student Fields */}
                {userType === 'student' && (
                  <View style={styles.profileRoleDetails}>
                <Text style={styles.profileLabel}>ENROLLMENT NUMBER · OPTIONAL</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="Your enrollment number"
                      placeholderTextColor="#94a3b8"
                      value={rollNo}
                      onChangeText={setRollNo}
                      autoCapitalize="characters"
                    />
                    <Text style={styles.extraFieldHint}>You can add this later.</Text>
                  </View>
                )}

                {/* Dynamic Faculty Fields */}
                {userType === 'faculty' && (
                  <View style={styles.profileRoleDetails}>
                    <Text style={styles.profileLabel}>FACULTY / STAFF ID (OPTIONAL)</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="e.g. FAC-CS-104 or Employee ID"
                      placeholderTextColor="#94a3b8"
                      value={facultyId}
                      onChangeText={setFacultyId}
                      autoCapitalize="characters"
                    />

                    <Text style={styles.profileLabel}>ROOM / CABIN NUMBER *</Text>
                    <TextInput
                      style={styles.profileInput}
                      placeholder="e.g. Block B, Staff Room 204 or Cabin 12"
                      placeholderTextColor="#94a3b8"
                      value={roomNumber}
                      onChangeText={setRoomNumber}
                    />

                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.profileActions}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setStep(2)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dualBtnPrimaryWrapper, (!name.trim() || phone.length !== 10 || isSavingProfile) && styles.btnDisabled]}
                    disabled={!name.trim() || phone.length !== 10 || isSavingProfile}
                    onPress={handleProfileContinue}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={name.trim() ? ['#ffb313', '#ffb313', '#ffb313'] : ['#cbd5e1', '#cbd5e1']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGradientBtn}
                    >
                      {isSavingProfile ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Continue →</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: LOCATION PERMISSIONS & RADAR                                      */}
          {/* ========================================================================= */}
          {step === 4 && (
            <View>
              {/* Progress Tracker */}
              <SetupProgress current={4} total={userType === 'seller' ? 5 : 4} label="LOCATION" />

              <View style={styles.contentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <InterfaceIcon name="location" size={24} color="#ffb313" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Campus Radar Geofence</Text>
                    <Text style={styles.cardSubtitle}>
                      Allow location access to check whether you are within 500m of the canteen.
                    </Text>
                  </View>
                </View>

                {/* Modern Radar Graphic Container */}
                <View style={styles.radarVisualContainer}>
                  <View style={styles.radarOuterCircle}>
                    <View style={styles.radarMiddleCircle}>
                      <View style={styles.radarInnerCircle}>
                        <InterfaceIcon name="location" size={30} color="#090b0d" />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.radarStatusText}>SILVER OAK UNIVERSITY</Text>
                </View>

                {/* Feature Benefit Highlights */}
                <View style={styles.featureHighlightsList}>
                  <View style={styles.highlightRow}>
                    <View style={styles.highlightIconBadge}>
                      <InterfaceIcon name="location" size={21} color="#ffb313" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>Campus Auto-Discovery</Text>
                      <Text style={styles.highlightDesc}>
                        Instantly links your session to Silver Oak University's central food court.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightRow}>
                    <View style={styles.highlightIconBadge}>
                      <InterfaceIcon name="lock" size={21} color="#ffb313" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>500m Zero-Queue Proximity Lock</Text>
                      <Text style={styles.highlightDesc}>
                        Ordering is available within 500m of the canteen. Allow location access to order.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightRow}>
                    <View style={styles.highlightIconBadge}>
                      <InterfaceIcon name="bolt" size={21} color="#ffb313" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>Zero-Wait Digital Pickup Pass</Text>
                      <Text style={styles.highlightDesc}>
                        Generates your scannable QR and 4-digit token the moment food is ready.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Primary GPS Permission Button */}
                <TouchableOpacity
                  style={styles.primaryGradientBtnWrapper}
                  onPress={handleGrantLocation}
                  disabled={isRequestingLocation}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#ffb313', '#ffb313']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGradientBtn}
                  >
                    {isRequestingLocation ? (
                      <View style={styles.btnLoadingRow}>
                        <ActivityIndicator color="#ffffff" size="small" />
                        <Text style={styles.btnText}>  Detecting GPS Telemetry...</Text>
                      </View>
                    ) : (
                      <Text style={styles.btnText}>Grant GPS & Enter Campus</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Skip Option */}
                <TouchableOpacity style={styles.skipBtnContainer} onPress={handleSkipLocation}>
                  <Text style={styles.skipBtnLinkText}>
                    Browse without location (ordering needs GPS)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backBtnFullWidth}
                  onPress={() => setStep(3)}
                >
                  <Text style={styles.backBtnFullWidthText}>
                    ← Back to Profile Details
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 5: CANTEEN STALL SETUP (SELLERS ONLY)                                */}
          {/* ========================================================================= */}
          {step === 5 && (
            <View style={styles.profileSection}>
              <SetupProgress current={5} total={5} label="CANTEEN SETUP" />
              <View style={[styles.contentCard, styles.sellerSetupCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" aria-hidden>
                      <Path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0M9 20v-6h6v6" fill="none" stroke="#0c52a3" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Set up your canteen</Text>
                    <Text style={styles.cardSubtitle}>A few details to create your seller workspace.</Text>
                  </View>
                </View>
                <View style={styles.sellerCampus}>
                  <Text style={styles.sellerLabel}>SELECTED CAMPUS</Text>
                  <Text style={styles.sellerCampusName}>{selectedCampusObj?.name || 'Silver Oak University'}</Text>
                </View>
                <Text style={styles.sellerLabel}>CANTEEN NAME *</Text>
                <TextInput accessibilityLabel="Canteen name" style={styles.sellerInput} placeholder="Your canteen or stall name" placeholderTextColor="#94a3b8" value={stallName} onChangeText={setStallName} maxLength={100} />
                <Text style={styles.sellerLabel}>LOCATION ON CAMPUS</Text>
                <TextInput accessibilityLabel="Location on campus" style={styles.sellerInput} placeholder="e.g. Block A, ground floor" placeholderTextColor="#94a3b8" value={stallLocation} onChangeText={setStallLocation} maxLength={150} />
                <Text style={styles.sellerLabel}>UPI ID ? OPTIONAL</Text>
                <TextInput accessibilityLabel="Merchant UPI ID" style={styles.sellerInput} placeholder="canteen@upi" placeholderTextColor="#94a3b8" value={merchantUpi} onChangeText={setMerchantUpi} autoCapitalize="none" autoCorrect={false} />
                <Text style={styles.sellerHint}>Customers pay you directly. Leave this empty to accept cash only.</Text>
                <View style={styles.sellerNotice}>
                  <Text style={styles.sellerNoticeTitle}>What happens next?</Text>
                  <Text style={styles.sellerNoticeCopy}>Open your seller workspace after submitting. Orders and menu publishing unlock once the platform owner approves your canteen.</Text>
                </View>
                <TouchableOpacity accessibilityRole="button" disabled={isSavingProfile} style={[styles.sellerSubmit, isSavingProfile && styles.btnDisabled]} onPress={handleFinishOnboarding} activeOpacity={0.85}>
                  {isSavingProfile ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>Create seller workspace</Text>}
                </TouchableOpacity>
                <TouchableOpacity accessibilityRole="button" style={styles.backBtnFullWidth} onPress={() => setStep(4)}>
                  <Text style={styles.backBtnFullWidthText}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const baseStyles = StyleSheet.create({
  setupLogo: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center' },
  setupLogoLetter: { color: '#090b0d', fontSize: 24, fontWeight: '900' },
  modeButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center' },
  sellerSetupCard: { padding: 20, borderWidth: 1, borderRadius: 24 },
  sellerCampus: { backgroundColor: '#f0f7ff', padding: 14, borderRadius: 12, marginBottom: 22 },
  sellerLabel: { color: '#b6bac2', fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 8 },
  sellerCampusName: { color: '#ffb313', fontSize: 14, fontWeight: '700' },
  sellerInput: { backgroundColor: '#121417', borderColor: '#26292e', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 14, color: '#f5f4f0', marginBottom: 18 },
  sellerHint: { color: '#a5a9b2', fontSize: 11, lineHeight: 17, marginTop: -10, marginBottom: 20 },
  sellerNotice: { backgroundColor: '#f7f9fc', borderRadius: 12, padding: 14, marginBottom: 20 },
  sellerNoticeTitle: { color: '#f5f4f0', fontSize: 12, fontWeight: '700', marginBottom: 5 },
  sellerNoticeCopy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19 },
  sellerSubmit: { minHeight: 50, borderRadius: 14, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center', padding: 12 },
  profileSection: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  profileCard: { padding: 20, borderRadius: 24, borderWidth: 1 },
  profileLabel: { color: '#b6bac2', fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 7 },
  profileInput: { minHeight: 50, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#f5f4f0', fontSize: 15, lineHeight: 22 },
  profileNameBox: { minHeight: 50, backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  profileInputText: { fontSize: 15, lineHeight: 22, paddingVertical: 12, color: '#f5f4f0' },
  profilePhoneBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 12, paddingHorizontal: 14 },
  profileCountryCode: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#f5f4f0', paddingRight: 12, marginRight: 12, borderRightWidth: 1, borderRightColor: '#26292e' },
  profilePhoneInput: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, paddingVertical: 12, color: '#f5f4f0' },
  profileRoleDetails: { marginTop: 2 },
  profileActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  loginScroll: { flexGrow: 1, paddingBottom: 24 },
  loginSection: { width: '100%', maxWidth: 440, alignSelf: 'center', marginVertical: 'auto', paddingVertical: 20 },
  loginCard: { backgroundColor: '#121417', borderRadius: 28, paddingHorizontal: 24, paddingVertical: 30, borderWidth: 1, borderColor: '#26292e', alignItems: 'center', shadowColor: '#17395c', shadowOpacity: 0.06, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 2 },
  loginIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#17191d', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  loginEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#ffb313', textAlign: 'center', marginBottom: 10 },
  loginTitle: { fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: -0.8, color: '#f5f4f0', textAlign: 'center' },
  loginCopy: { fontSize: 14, lineHeight: 22, color: '#a5a9b2', textAlign: 'center', marginTop: 12, marginBottom: 28 },
  googleButton: { width: '100%', minHeight: 54, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, backgroundColor: '#121417', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 14 },
  googleButtonText: { fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#f5f4f0', flexShrink: 1 },
  loginHint: { color: '#a5a9b2', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 14 },
  loginFooter: { width: '100%', borderTopWidth: 1, borderTopColor: '#26292e', paddingTop: 22, marginTop: 26 },
  loginFooterTitle: { color: '#f5f4f0', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  loginFooterCopy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  container: {
    flex: 1,
    backgroundColor: '#090b0d',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 28) : 6,
  },
  scrollContent: {
    width: '100%', maxWidth: 380, alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
  },

  /* Top Minimal Header */
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 10,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogoContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 4,
  },
  headerLogoImage: {
    width: 44,
    height: 44,
  },
  headerBrandTitle: {
    color: '#f5f4f0',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headerCampusSubtitle: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  campusPillBadge: {
    backgroundColor: '#17191d',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  campusPillText: {
    color: '#ffb313',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  /* ========================================================================= */
  /* STEP 0: ANIMATED MASCOT WELCOME STYLES                                   */
  /* ========================================================================= */
  welcomeContainer: {
    paddingBottom: 16,
  },
  mascotStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginBottom: 8,
    position: 'relative',
  },
  mascotAuraRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(0, 163, 196, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(12, 82, 163, 0.25)',
  },
  mascotMover: {
    zIndex: 10,
  },
  mascotHeroImage: {
    width: 170,
    height: 170,
  },
  mascotGroundShadow: {
    width: 110,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(12, 82, 163, 0.18)',
    marginTop: -8,
  },
  mascotSpeechPill: {
    marginTop: 12,
    backgroundColor: '#121417',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#b9d9f5',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  mascotSpeechText: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  welcomeHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#17191d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 8,
  },
  welcomeHeaderBadgeText: {
    color: '#ffb313',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  welcomeHeroHeading: {
    color: '#f5f4f0',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  welcomeHeroSub: {
    color: '#a5a9b2',
    fontSize: 13,
    lineHeight: 18.5,
    fontWeight: '500',
    marginBottom: 16,
  },

  /* Mini Mascot Greeting on Step 1 */
  miniMascotGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#26292e',
    gap: 12,
  },
  miniMascotImage: {
    width: 48,
    height: 48,
  },
  miniMascotTitle: {
    color: '#f5f4f0',
    fontSize: 14.5,
    fontWeight: '900',
  },
  miniMascotSub: {
    color: '#a5a9b2',
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '500',
  },

  /* Step Progress Tracker */
  progressContainer: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  progressBarsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressBarSegment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  progressBarActive: {
    backgroundColor: '#ffb313',
  },
  progressBarCompleted: {
    backgroundColor: '#00a3c4',
  },
  progressLabel: {
    color: '#ffb313',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Main Floating Content Card */
  contentCard: {
    backgroundColor: '#121417',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#26292e',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e6f2fb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#b9d9f5',
  },
  cardIconText: {
    fontSize: 20,
  },
  cardTitle: {
    color: '#f5f4f0',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: '#a5a9b2',
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Form Labels & Text Inputs */
  inputSectionLabel: {
    color: '#b6bac2',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 7,
    marginTop: 8,
  },
  inputSectionLabelNoMargin: {
    color: '#b6bac2',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121417',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#26292e',
    paddingHorizontal: 14,
    height: 54,
  },
  phoneInputContainerLocked: {
    borderColor: '#0c52a3',
    backgroundColor: '#e6f2fb',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryFlag: {
    fontSize: 17,
  },
  countryCodeText: {
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '800',
  },
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 12,
  },
  phoneInputField: {
    flex: 1,
    color: '#f5f4f0',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingVertical: 0,
  },
  editPhoneBtn: {
    backgroundColor: '#121417',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b9d9f5',
  },
  editPhoneBtnText: {
    color: '#ffb313',
    fontSize: 11,
    fontWeight: '800',
  },

  /* Primary Gradient Buttons */
  primaryGradientBtnWrapper: {
    borderRadius: 16,
    marginTop: 14,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryGradientBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnText: {
    color: '#090b0d',
    fontSize: 14.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Dual Action Buttons Row */
  dualBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    alignItems: 'center',
  },
  secondaryBtn: {
    backgroundColor: '#17191d',
    height: 52,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#26292e',
  },
  secondaryBtnText: {
    color: '#b6bac2',
    fontSize: 14,
    fontWeight: '800',
  },
  dualBtnPrimaryWrapper: {
    flex: 1,
    borderRadius: 16,
    height: 52,
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  /* OTP Verification Elements */
  otpSection: {
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#26292e',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resendLink: {
    color: '#ffb313',
    fontSize: 12,
    fontWeight: '800',
  },
  resendLinkDisabled: {
    color: '#94a3b8',
  },
  demoFillPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#eff6ff',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  demoFillPillIcon: {
    fontSize: 13,
  },
  demoFillPillText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '800',
  },
  digitBoxesContainer: {
    position: 'relative',
    marginVertical: 4,
  },
  digitBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  digitBox: {
    flex: 1,
    height: 52,
    backgroundColor: '#121417',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#26292e',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digitBoxActive: {
    borderColor: '#0c52a3',
    backgroundColor: '#121417',
    borderWidth: 2,
  },
  digitBoxFilled: {
    borderColor: '#0c52a3',
    backgroundColor: '#e6f2fb',
  },
  digitBoxChar: {
    color: '#f5f4f0',
    fontSize: 22,
    fontWeight: '900',
  },
  digitCursorBar: {
    position: 'absolute',
    bottom: 8,
    width: 14,
    height: 2,
    backgroundColor: '#ffb313',
    borderRadius: 1,
  },
  digitHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
  },

  /* Text Inputs */
  textInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121417',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#26292e',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  inputLeadingIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  textInputField: {
    flex: 1,
    color: '#f5f4f0',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },
  borderedInput: {
    backgroundColor: '#121417',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f5f4f0',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: '#26292e',
    marginBottom: 8,
  },

  /* Role Selection Cards */
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#26292e',
    gap: 12,
  },
  roleCardActive: {
    borderColor: '#0c52a3',
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#0c52a3',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  roleIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  roleEmoji: {
    fontSize: 20,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  roleTitle: {
    color: '#f5f4f0',
    fontSize: 14.5,
    fontWeight: '900',
  },
  badgeStudent: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  badgeStudentText: {
    color: '#b45309',
    fontSize: 8.5,
    fontWeight: '900',
  },
  badgeFaculty: {
    backgroundColor: '#17191d',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  badgeFacultyText: {
    color: '#ffb313',
    fontSize: 8.5,
    fontWeight: '900',
  },
  badgeMerchant: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  badgeMerchantText: {
    color: '#15803d',
    fontSize: 8.5,
    fontWeight: '900',
  },
  roleDescription: {
    color: '#a5a9b2',
    fontSize: 11.5,
    lineHeight: 16.5,
    fontWeight: '500',
  },
  roleCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffb313',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckMark: {
    color: '#090b0d',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Extra Role Details Boxes */
  extraRoleDetailsCard: {
    backgroundColor: '#121417',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#26292e',
  },
  extraFieldHint: {
    color: '#a5a9b2',
    fontSize: 11,
    marginTop: -2,
    marginBottom: 4,
  },
  featureCalloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
    gap: 10,
  },
  featureCalloutEmoji: {
    fontSize: 20,
  },
  featureCalloutTitle: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800',
  },
  featureCalloutDesc: {
    color: '#374151',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },

  /* Radar Geofencing Step Visuals */
  radarVisualContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 12,
  },
  radarOuterCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#17191d',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#bae6fd',
  },
  radarMiddleCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#b9e6fe',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#7dd3fc',
  },
  radarInnerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#121417',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0c52a3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  radarPinEmoji: {
    fontSize: 22,
  },
  radarStatusText: {
    color: '#ffb313',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 12,
  },

  /* Feature Highlight Rows */
  featureHighlightsList: {
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#26292e',
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  highlightIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#121417',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#26292e',
  },
  highlightIcon: {
    fontSize: 17,
  },
  highlightTitle: {
    color: '#f5f4f0',
    fontSize: 13,
    fontWeight: '800',
  },
  highlightDesc: {
    color: '#a5a9b2',
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  skipBtnContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBtnLinkText: {
    color: '#a5a9b2',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  backBtnFullWidth: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  backBtnFullWidthText: {
    color: '#ffb313',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Canteen Stall Registry */
  institutionBanner: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  institutionBannerLabel: {
    color: '#15803d',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  institutionBannerTitle: {
    color: '#14532d',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  vendorFormContainer: {
    backgroundColor: '#121417',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#26292e',
  },
  loginCard: { backgroundColor: 'transparent', paddingVertical: 28, alignItems: 'flex-start' },
  loginEyebrow: { color: '#ffb313', fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 14 },
  loginTitle: { color: '#f5f4f0', fontSize: 42, lineHeight: 46, letterSpacing: -1.2, fontWeight: '900' },
  loginCopy: { color: '#a5a9b2', fontSize: 14, lineHeight: 23, marginTop: 16, marginBottom: 25 },
  googleButton: { width: '100%', minHeight: 54, backgroundColor: '#f5f4f0', borderRadius: 17, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 12 },
  googleButtonText: { color: '#090b0d', fontSize: 15, fontWeight: '700' },
  loginFooter: { backgroundColor: '#121417', borderWidth: 1, borderColor: '#26292e', borderRadius: 20, padding: 18, marginTop: 24, width: '100%' },
  loginFooterTitle: { color: '#f5f4f0', fontSize: 14, fontWeight: '700' },
  loginFooterCopy: { color: '#a5a9b2', fontSize: 12, lineHeight: 19, marginTop: 7 },
  contentCard: { backgroundColor: 'transparent', padding: 0, borderWidth: 0 },
  profileCard: { padding: 0, borderWidth: 0 },
  progressBarCompleted: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ffb313' },
  progressBarActive: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#ffb313' },

  radarOuterCircle: { width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: '#26292e', backgroundColor: '#121417', alignItems: 'center', justifyContent: 'center' },
  radarMiddleCircle: { width: 126, height: 126, borderRadius: 63, borderWidth: 1, borderColor: '#69500e', backgroundColor: '#211a07', alignItems: 'center', justifyContent: 'center' },
  radarInnerCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#ffb313', alignItems: 'center', justifyContent: 'center' },

  cardTitle: { color: '#f5f4f0', fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.7 },

  progressBarSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#26292e' },
  progressLabel: { color: '#ffb313', fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginTop: 10 },
  headerBrandTitle: { color: '#f5f4f0', fontSize: 21, fontWeight: '700', letterSpacing: -0.5 },

});
