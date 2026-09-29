import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView,
  StatusBar, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, Animated, Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import { sendSmsOtp, verifySmsOtp } from '../services/smsService';
import { signInWithVerifiedOtp, getUserProfileByPhone, saveUserProfileToLocalRegistry } from '../services/authService';

const mascotCharacter = require('../../assets/mascot.png');
const mascotIcon = require('../../assets/icon.png');

export default function OnboardingFlow() {
  const {
    requestUserLocation,
    completeOnboarding,
  } = useContext(AppContext);

  // 0: Animated Mascot Welcome Screen, 1: Phone & OTP, 2: Name & Role, 3: Location Permissions, 4: Canteen Setup (Seller)
  const [step, setStep] = useState(0);

  // Step 1: Phone Login & Verification
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [existingUserName, setExistingUserName] = useState('');
  const otpInputRef = useRef(null);

  // Step 2: User Type ('student', 'faculty', 'seller')
  const [userType, setUserType] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  // Step 3: Location Permission
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // University is fixed to Silver Oak for Phase 1
  const selectedUniversity = 'sou';
  const selectedCampusObj = DEFAULT_UNIVERSITIES.find(u => u.id === selectedUniversity) || DEFAULT_UNIVERSITIES[0];

  // Vendor Fields (if userType === 'seller')
  const [stallName, setStallName] = useState('');
  const [stallLocation, setStallLocation] = useState('');
  const [merchantUpi, setMerchantUpi] = useState('');

  const [resendTimer, setResendTimer] = useState(0);
  const [isSendingSms, setIsSendingSms] = useState(false);

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

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Step 1 Handlers
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSendingSms(true);
    try {
      const res = await sendSmsOtp(cleanPhone);
      setOtpSent(true);
      if (res?.isDemo) {
        setOtpCode('123456');
        Alert.alert('Verification Code Sent', 'Demo / local mode active. Code: 123456 (pre-filled for fast testing)');
      } else {
        setOtpCode('');
      }
      setResendTimer(30);
    } catch (e) {
      Alert.alert('Could not send code', e.message || 'Please try again in a moment.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleVerifyAndContinueStep1 = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpSent) {
      Alert.alert('Verification Required', 'Please tap "Send Verification Code" first.');
      return;
    }
    if (otpCode.trim().length !== 6) {
      Alert.alert('6-Digit Code Required', 'Please enter the complete 6-digit verification code.');
      return;
    }
    setIsCheckingProfile(true);

    try {
      const result = await verifySmsOtp(cleanPhone, otpCode.trim());
      await signInWithVerifiedOtp(result.customToken);
      setIsOtpVerified(true);

      // Check if this phone number already registered previously
      const existingProfile = await getUserProfileByPhone(cleanPhone);
      if (existingProfile && existingProfile.name) {
        setIsExistingUser(true);
        setExistingUserName(existingProfile.name);
        setName(existingProfile.name);
        setUserType(existingProfile.userType || 'student');
        if (existingProfile.rollNo) setRollNo(existingProfile.rollNo);
        if (existingProfile.facultyId) setFacultyId(existingProfile.facultyId);
        if (existingProfile.roomNumber) setRoomNumber(existingProfile.roomNumber);
        if (existingProfile.stallName) setStallName(existingProfile.stallName);
        if (existingProfile.stallLocation) setStallLocation(existingProfile.stallLocation);
        if (existingProfile.merchantUpi) setMerchantUpi(existingProfile.merchantUpi);

        const chosenRole = existingProfile.userType === 'seller' ? 'seller' : 'buyer';
        let vendorCanteenData = null;
        if (chosenRole === 'seller' && existingProfile.stallName) {
          vendorCanteenData = {
            id: existingProfile.sellerShopId,
            name: existingProfile.stallName,
            location: existingProfile.stallLocation || 'Central Campus Food Court',
            openingHours: existingProfile.openingHours || '08:00 AM - 08:00 PM',
            upiId: existingProfile.merchantUpi || `${existingProfile.stallName.toLowerCase().replace(/\s+/g, '')}@upi`,
            phone: `+91 ${cleanPhone}`,
            initialMenu: []
          };
        }

        await completeOnboarding({
          chosenRole,
          chosenUniversity: existingProfile.universityId || selectedUniversity || 'sou',
          profileData: {
            ...existingProfile,
            phone: cleanPhone,
            name: existingProfile.name,
            userType: existingProfile.userType
          },
          vendorCanteenData
        });

        Alert.alert(
          '👋 Welcome Back!',
          `Signed in as ${existingProfile.name} (${chosenRole === 'seller' ? 'Kitchen Merchant' : 'Student'}).`
        );
        return;
      }

      // New user registration -> proceed to profile creation
      setStep(2);
    } catch (e) {
      Alert.alert('Verification failed', e.message || 'The code is invalid or has expired.');
    } finally {
      setIsCheckingProfile(false);
    }
  };

  // Step 3 Handlers (Location)
  const handleGrantLocation = async () => {
    setIsRequestingLocation(true);
    try {
      await requestUserLocation();
    } catch (e) {
      console.log('Location grant note:', e);
    } finally {
      setIsRequestingLocation(false);
      if (userType === 'seller') {
        setStep(4);
      } else {
        await handleFinishOnboarding();
      }
    }
  };

  const handleSkipLocation = async () => {
    if (userType === 'seller') {
      setStep(4);
    } else {
      await handleFinishOnboarding();
    }
  };

  // Step 4 Handlers (Finish & Enter Campus)
  const handleFinishOnboarding = async () => {
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
        upiId: merchantUpi.trim() || `${stallName.toLowerCase().replace(/\s+/g, '')}@upi`,
        phone: `+91 ${phone}`,
        initialMenu: []
      };
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const profileToSave = {
      name: name.trim(),
      phone: cleanPhone,
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
    await saveUserProfileToLocalRegistry(cleanPhone, profileToSave);

    await completeOnboarding({
      chosenRole,
      chosenUniversity: selectedUniversity || 'sou',
      profileData: profileToSave,
      vendorCanteenData
    });

    if (chosenRole === 'seller') {
      Alert.alert(
        '🎉 Canteen Registered!',
        `Your food counter "${stallName}" is now registered and live on the Silver Oak campus radar. Welcome to your Kitchen POS!`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#edf3f8" translucent={false} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Header Bar Matching App Brand */}
          <View style={styles.topHeaderBar}>
            <View style={styles.topHeaderLeft}>
              <LinearGradient
                colors={['#0747a6', '#0097a7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerLogoContainer}
              >
                <Image source={mascotIcon} style={styles.headerLogoImage} resizeMode="contain" />
              </LinearGradient>
              <View>
                <Text style={styles.headerBrandTitle}>SkipQ</Text>
                <Text style={styles.headerCampusSubtitle}>Silver Oak University</Text>
              </View>
            </View>
            <View style={styles.campusPillBadge}>
              <Text style={styles.campusPillText}>SOU</Text>
            </View>
          </View>

          {/* ========================================================================= */}
          {/* STEP 0: ANIMATED COLORFUL MASCOT WELCOME SCREEN                          */}
          {/* ========================================================================= */}
          {step === 0 && (
            <View style={styles.welcomeContainer}>
              {/* Mascot Animated Hero Stage */}
              <View style={styles.mascotStage}>
                {/* Glowing Radiant Aura Ring */}
                <Animated.View
                  style={[
                    styles.mascotAuraRing,
                    {
                      transform: [{ scale: auraScale }],
                      opacity: auraOpacity,
                    }
                  ]}
                />

                {/* Floating Bobbing Mascot */}
                <TouchableOpacity activeOpacity={0.9} onPress={handleMascotTap}>
                  <Animated.View
                    style={[
                      styles.mascotMover,
                      {
                        transform: [
                          { translateY: mascotFloatY },
                          { scale: mascotScale },
                        ]
                      }
                    ]}
                  >
                    <Image
                      source={mascotCharacter}
                      style={styles.mascotHeroImage}
                      resizeMode="contain"
                    />
                  </Animated.View>
                </TouchableOpacity>

                {/* Interactive Dynamic Ground Shadow */}
                <Animated.View
                  style={[
                    styles.mascotGroundShadow,
                    {
                      transform: [{ scaleX: shadowScale }, { scaleY: shadowScale }]
                    }
                  ]}
                />

                {/* Mascot Cheerful Speech Pill */}
                <View style={styles.mascotSpeechPill}>
                  <Text style={styles.mascotSpeechText}>👋 Hi, I'm Skip! Tap me & let's eat!</Text>
                </View>
              </View>

              {/* Welcome Ocean Breeze Card */}
              <View style={styles.contentCard}>
                <View style={styles.welcomeHeaderBadge}>
                  <Text style={styles.welcomeHeaderBadgeText}>⚡ ZERO-QUEUE CAMPUS DINING</Text>
                </View>

                <Text style={styles.welcomeHeroHeading}>Skip Every Line.</Text>
                <Text style={styles.welcomeHeroSub}>
                  Never waste lunch breaks waiting in long canteen lines at Silver Oak University. Order ahead and pick up fresh food in seconds!
                </Text>

                {/* 3 Value Pillars */}
                <View style={styles.featureHighlightsList}>
                  <View style={styles.highlightRow}>
                    <View style={[styles.highlightIconBadge, { backgroundColor: '#e0f2fe' }]}>
                      <Text style={styles.highlightIcon}>⚡</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>Instant Counter Pickup</Text>
                      <Text style={styles.highlightDesc}>
                        Order hot food ahead of time and grab your meal between lectures with zero line waiting.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightRow}>
                    <View style={[styles.highlightIconBadge, { backgroundColor: '#fef3c7' }]}>
                      <Text style={styles.highlightIcon}>🎫</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>Digital Pass & 4-Digit PIN</Text>
                      <Text style={styles.highlightDesc}>
                        Show your scannable digital token or quote your 4-digit PIN for 3-second handovers.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightRow}>
                    <View style={[styles.highlightIconBadge, { backgroundColor: '#dcfce7' }]}>
                      <Text style={styles.highlightIcon}>🛡️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>300m Fresh-Prep Guarantee</Text>
                      <Text style={styles.highlightDesc}>
                        Campus GPS ensures chefs start cooking when you approach, so your food is always piping hot.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Big Vibrant Get Started Button */}
                <TouchableOpacity
                  style={styles.primaryGradientBtnWrapper}
                  onPress={() => setStep(1)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#0747a6', '#0070d2', '#00a3c4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryGradientBtn}
                  >
                    <Text style={styles.btnText}>Get Started / Sign In ➔</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 1: PHONE LOGIN & SMS VERIFICATION                                    */}
          {/* ========================================================================= */}
          {step === 1 && (
            <View>
              {/* Mascot Mini Greeting Banner */}
              <View style={styles.miniMascotGreeting}>
                <Image source={mascotCharacter} style={styles.miniMascotImage} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.miniMascotTitle}>Welcome to SkipQ!</Text>
                  <Text style={styles.miniMascotSub}>Enter your mobile number to activate your zero-queue pass.</Text>
                </View>
              </View>

              {/* Progress Tracker */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarsRow}>
                  <View style={[styles.progressBarSegment, styles.progressBarActive]} />
                  <View style={styles.progressBarSegment} />
                  <View style={styles.progressBarSegment} />
                  <View style={styles.progressBarSegment} />
                </View>
                <Text style={styles.progressLabel}>STEP 1 OF 4 • MOBILE SIGN-IN</Text>
              </View>

              <View style={styles.contentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Text style={styles.cardIconText}>📱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Mobile Verification</Text>
                    <Text style={styles.cardSubtitle}>
                      Sign in or create your campus digital pickup pass.
                    </Text>
                  </View>
                </View>

                {/* Mobile Number Input Container */}
                <Text style={styles.inputSectionLabel}>MOBILE PHONE NUMBER</Text>
                <View style={[styles.phoneInputContainer, otpSent && styles.phoneInputContainerLocked]}>
                  <View style={styles.countryCodeBadge}>
                    <Text style={styles.countryFlag}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <View style={styles.phoneDivider} />
                  <TextInput
                    style={styles.phoneInputField}
                    placeholder="98765 43210"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={phone}
                    editable={!otpSent || isSendingSms}
                    onChangeText={(val) => {
                      setPhone(val.replace(/\D/g, ''));
                    }}
                  />
                  {otpSent && (
                    <TouchableOpacity
                      style={styles.editPhoneBtn}
                      onPress={() => {
                        setOtpSent(false);
                        setOtpCode('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.editPhoneBtnText}>Change</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Send SMS Code Button */}
                {!otpSent && (
                  <TouchableOpacity
                    style={[
                      styles.primaryGradientBtnWrapper,
                      (phone.replace(/\D/g, '').length !== 10 || isSendingSms) && styles.btnDisabled
                    ]}
                    onPress={handleSendOtp}
                    disabled={phone.replace(/\D/g, '').length !== 10 || isSendingSms}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={
                        phone.replace(/\D/g, '').length === 10 && !isSendingSms
                          ? ['#0747a6', '#0070d2', '#00a3c4']
                          : ['#cbd5e1', '#cbd5e1']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGradientBtn}
                    >
                      {isSendingSms ? (
                        <View style={styles.btnLoadingRow}>
                          <ActivityIndicator size="small" color="#ffffff" />
                          <Text style={styles.btnText}>  Sending SMS Code...</Text>
                        </View>
                      ) : (
                        <Text style={styles.btnText}>Send 6-Digit SMS Code ➔</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* 6-Digit SMS Verification Section */}
                {otpSent && (
                  <View style={styles.otpSection}>
                    <View style={styles.otpHeaderRow}>
                      <Text style={styles.inputSectionLabelNoMargin}>ENTER 6-DIGIT CODE</Text>
                      <TouchableOpacity
                        disabled={resendTimer > 0 || isSendingSms}
                        onPress={handleSendOtp}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={[styles.resendLink, (resendTimer > 0 || isSendingSms) && styles.resendLinkDisabled]}>
                          {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Demo Auto-Fill Chip */}
                    <TouchableOpacity
                      style={styles.demoFillPill}
                      onPress={() => setOtpCode('123456')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.demoFillPillIcon}>⚡</Text>
                      <Text style={styles.demoFillPillText}>Demo Mode: Tap to auto-fill code 123456</Text>
                    </TouchableOpacity>

                    {/* Segmented 6-Digit Boxes */}
                    <View style={styles.digitBoxesContainer}>
                      <View style={styles.digitBoxesRow}>
                        {[0, 1, 2, 3, 4, 5].map((idx) => {
                          const char = otpCode[idx] || '';
                          const isCurrent = otpCode.length === idx;
                          const isFilled = Boolean(char);
                          return (
                            <View
                              key={idx}
                              style={[
                                styles.digitBox,
                                isFilled && styles.digitBoxFilled,
                                isCurrent && styles.digitBoxActive
                              ]}
                            >
                              <Text style={styles.digitBoxChar}>{char}</Text>
                              {isCurrent && <View style={styles.digitCursorBar} />}
                            </View>
                          );
                        })}
                      </View>

                      {/* Invisible full overlay input for smooth typing */}
                      <TextInput
                        ref={otpInputRef}
                        style={styles.digitHiddenInput}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={(val) => {
                          setOtpCode(val.replace(/\D/g, ''));
                        }}
                        caretHidden
                        autoFocus
                      />
                    </View>

                    {/* Verify Action Button */}
                    <TouchableOpacity
                      style={[
                        styles.primaryGradientBtnWrapper,
                        (otpCode.length !== 6 || isCheckingProfile) && styles.btnDisabled,
                        { marginTop: 16 }
                      ]}
                      onPress={handleVerifyAndContinueStep1}
                      disabled={otpCode.length !== 6 || isCheckingProfile}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={
                          otpCode.length === 6 && !isCheckingProfile
                            ? ['#0747a6', '#0070d2', '#00a3c4']
                            : ['#cbd5e1', '#cbd5e1']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryGradientBtn}
                      >
                        {isCheckingProfile ? (
                          <View style={styles.btnLoadingRow}>
                            <ActivityIndicator size="small" color="#ffffff" />
                            <Text style={styles.btnText}>  Verifying Pass Token...</Text>
                          </View>
                        ) : (
                          <Text style={styles.btnText}>Verify & Continue ➔</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Back to Mascot Welcome Screen */}
                <TouchableOpacity
                  style={styles.backBtnFullWidth}
                  onPress={() => setStep(0)}
                >
                  <Text style={styles.backBtnFullWidthText}>← Back to Welcome</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: COMPLETE YOUR PROFILE (NEW USERS)                                */}
          {/* ========================================================================= */}
          {step === 2 && (
            <View>
              {/* Progress Tracker */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarsRow}>
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarActive]} />
                  <View style={styles.progressBarSegment} />
                  <View style={styles.progressBarSegment} />
                </View>
                <Text style={styles.progressLabel}>STEP 2 OF 4 • PROFILE & ROLE</Text>
              </View>

              <View style={styles.contentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Text style={styles.cardIconText}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Your Name & Role</Text>
                    <Text style={styles.cardSubtitle}>
                      Personalize your identity and choose how you order on campus.
                    </Text>
                  </View>
                </View>

                {/* Full Name Input */}
                <Text style={styles.inputSectionLabel}>YOUR FULL NAME *</Text>
                <View style={styles.textInputBox}>
                  <Text style={styles.inputLeadingIcon}>✍️</Text>
                  <TextInput
                    style={styles.textInputField}
                    placeholder="e.g. Satyam Pandey"
                    placeholderTextColor="#94a3b8"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>

                <Text style={[styles.inputSectionLabel, { marginTop: 16 }]}>SELECT YOUR CAMPUS ROLE</Text>

                {/* 1. Student / Scholar Role Card */}
                <TouchableOpacity
                  style={[styles.roleCard, userType === 'student' && styles.roleCardActive]}
                  onPress={() => setUserType('student')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.roleIconCircle, { backgroundColor: '#fef3c7' }]}>
                    <Text style={styles.roleEmoji}>🎓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.roleHeaderRow}>
                      <Text style={styles.roleTitle}>Student / Scholar</Text>
                      <View style={styles.badgeStudent}>
                        <Text style={styles.badgeStudentText}>MOST POPULAR</Text>
                      </View>
                    </View>
                    <Text style={styles.roleDescription}>
                      Browse live canteen menus, check queue times, and collect orders with zero queue using digital tokens.
                    </Text>
                  </View>
                  {userType === 'student' && (
                    <View style={styles.roleCheckCircle}>
                      <Text style={styles.roleCheckMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 2. Faculty / University Staff */}
                <TouchableOpacity
                  style={[styles.roleCard, userType === 'faculty' && styles.roleCardActive]}
                  onPress={() => setUserType('faculty')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.roleIconCircle, { backgroundColor: '#e0f2fe' }]}>
                    <Text style={styles.roleEmoji}>👨‍🏫</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.roleHeaderRow}>
                      <Text style={styles.roleTitle}>Faculty / Staff</Text>
                      <View style={styles.badgeFaculty}>
                        <Text style={styles.badgeFacultyText}>EXPRESS PASS</Text>
                      </View>
                    </View>
                    <Text style={styles.roleDescription}>
                      Priority canteen handoffs and optional direct room delivery between lectures and labs.
                    </Text>
                  </View>
                  {userType === 'faculty' && (
                    <View style={styles.roleCheckCircle}>
                      <Text style={styles.roleCheckMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* 3. Canteen Operator / Merchant */}
                <TouchableOpacity
                  style={[styles.roleCard, userType === 'seller' && styles.roleCardActive]}
                  onPress={() => setUserType('seller')}
                  activeOpacity={0.8}
                >
                  <View style={[styles.roleIconCircle, { backgroundColor: '#dcfce7' }]}>
                    <Text style={styles.roleEmoji}>🏪</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.roleHeaderRow}>
                      <Text style={styles.roleTitle}>Canteen Staff / Merchant</Text>
                      <View style={styles.badgeMerchant}>
                        <Text style={styles.badgeMerchantText}>KDS POS</Text>
                      </View>
                    </View>
                    <Text style={styles.roleDescription}>
                      Manage live orders, toggle dish availability, and verify pickups with 4-digit PINs.
                    </Text>
                  </View>
                  {userType === 'seller' && (
                    <View style={styles.roleCheckCircle}>
                      <Text style={styles.roleCheckMark}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Dynamic Student Fields */}
                {userType === 'student' && (
                  <View style={styles.extraRoleDetailsCard}>
                    <Text style={styles.inputSectionLabel}>STUDENT ENROLLMENT / ROLL NUMBER (OPTIONAL)</Text>
                    <TextInput
                      style={styles.borderedInput}
                      placeholder="Enter Enrollment No (leave empty if none)"
                      placeholderTextColor="#94a3b8"
                      value={rollNo}
                      onChangeText={setRollNo}
                      autoCapitalize="characters"
                    />
                    <Text style={styles.extraFieldHint}>Optional: Used for campus identity verification.</Text>
                  </View>
                )}

                {/* Dynamic Faculty Fields */}
                {userType === 'faculty' && (
                  <View style={styles.extraRoleDetailsCard}>
                    <Text style={styles.inputSectionLabel}>FACULTY / STAFF ID (OPTIONAL)</Text>
                    <TextInput
                      style={styles.borderedInput}
                      placeholder="e.g. FAC-CS-104 or Employee ID"
                      placeholderTextColor="#94a3b8"
                      value={facultyId}
                      onChangeText={setFacultyId}
                      autoCapitalize="characters"
                    />

                    <Text style={styles.inputSectionLabel}>ROOM / CABIN NUMBER (FOR DIRECT ROOM DELIVERY) *</Text>
                    <TextInput
                      style={[styles.borderedInput, { borderColor: '#00a3c4' }]}
                      placeholder="e.g. Block B, Staff Room 204 or Cabin 12"
                      placeholderTextColor="#94a3b8"
                      value={roomNumber}
                      onChangeText={setRoomNumber}
                    />

                    <View style={styles.featureCalloutBox}>
                      <Text style={styles.featureCalloutEmoji}>🚪</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureCalloutTitle}>Direct Campus Room Delivery</Text>
                        <Text style={styles.featureCalloutDesc}>
                          Canteen runners will deliver hot orders straight to your faculty room or cabin between classes!
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.dualBtnRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setStep(1)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dualBtnPrimaryWrapper, !name.trim() && styles.btnDisabled]}
                    disabled={!name.trim()}
                    onPress={() => {
                      if (!name.trim()) {
                        Alert.alert('Name Required', 'Please enter your full name to proceed.');
                        return;
                      }
                      setStep(3);
                    }}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={name.trim() ? ['#0747a6', '#0070d2', '#00a3c4'] : ['#cbd5e1', '#cbd5e1']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGradientBtn}
                    >
                      <Text style={styles.btnText}>Continue to Location ➔</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: LOCATION PERMISSIONS & RADAR                                      */}
          {/* ========================================================================= */}
          {step === 3 && (
            <View>
              {/* Progress Tracker */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarsRow}>
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarActive]} />
                  <View style={styles.progressBarSegment} />
                </View>
                <Text style={styles.progressLabel}>STEP 3 OF 4 • RADAR GEOFENCE</Text>
              </View>

              <View style={styles.contentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Text style={styles.cardIconText}>📍</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Campus Radar Geofence</Text>
                    <Text style={styles.cardSubtitle}>
                      SkipQ uses live hardware telemetry to confirm you are within 300m of the canteen.
                    </Text>
                  </View>
                </View>

                {/* Modern Radar Graphic Container */}
                <View style={styles.radarVisualContainer}>
                  <View style={styles.radarOuterCircle}>
                    <View style={styles.radarMiddleCircle}>
                      <View style={styles.radarInnerCircle}>
                        <Text style={styles.radarPinEmoji}>📍</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.radarStatusText}>SILVER OAK UNIVERSITY • ACTIVE RADAR</Text>
                </View>

                {/* Feature Benefit Highlights */}
                <View style={styles.featureHighlightsList}>
                  <View style={styles.highlightRow}>
                    <View style={styles.highlightIconBadge}>
                      <Text style={styles.highlightIcon}>🎯</Text>
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
                      <Text style={styles.highlightIcon}>🛡️</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.highlightTitle}>300m Zero-Queue Proximity Lock</Text>
                      <Text style={styles.highlightDesc}>
                        Guarantees your order begins cooking only when you are nearby so meals stay fresh and hot.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.highlightRow}>
                    <View style={styles.highlightIconBadge}>
                      <Text style={styles.highlightIcon}>⚡</Text>
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
                    colors={['#0747a6', '#0070d2', '#00a3c4']}
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
                      <Text style={styles.btnText}>📡 Grant GPS & Enter Campus ➔</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Skip Option */}
                <TouchableOpacity style={styles.skipBtnContainer} onPress={handleSkipLocation}>
                  <Text style={styles.skipBtnLinkText}>
                    Use Default Campus Coordinates (Ahmedabad)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backBtnFullWidth}
                  onPress={() => setStep(isExistingUser ? 1 : 2)}
                >
                  <Text style={styles.backBtnFullWidthText}>
                    ← Back to {isExistingUser ? 'Phone Login' : 'Profile Details'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: CANTEEN STALL SETUP (SELLERS ONLY)                                */}
          {/* ========================================================================= */}
          {step === 4 && (
            <View>
              {/* Progress Tracker */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBarsRow}>
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarCompleted]} />
                  <View style={[styles.progressBarSegment, styles.progressBarActive]} />
                </View>
                <Text style={styles.progressLabel}>STEP 4 OF 4 • CANTEEN REGISTRY</Text>
              </View>

              <View style={styles.contentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIconBox}>
                    <Text style={styles.cardIconText}>🏪</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Register Canteen Counter</Text>
                    <Text style={styles.cardSubtitle}>
                      Set up your food stall to start receiving live orders from students & faculty.
                    </Text>
                  </View>
                </View>

                {/* Selected Institution Banner */}
                <View style={styles.institutionBanner}>
                  <Text style={styles.institutionBannerLabel}>ACTIVE INSTITUTION</Text>
                  <Text style={styles.institutionBannerTitle}>
                    📍 {selectedCampusObj?.name || 'Silver Oak University'}
                  </Text>
                </View>

                {/* Vendor Form Box */}
                <View style={styles.vendorFormContainer}>
                  <Text style={styles.inputSectionLabel}>CANTEEN / STALL NAME *</Text>
                  <TextInput
                    style={styles.borderedInput}
                    placeholder="e.g. Silver Oak Central Food Court"
                    placeholderTextColor="#94a3b8"
                    value={stallName}
                    onChangeText={setStallName}
                  />

                  <Text style={styles.inputSectionLabel}>STALL LOCATION ON CAMPUS</Text>
                  <TextInput
                    style={styles.borderedInput}
                    placeholder="e.g. Central Courtyard, Opp. Block A"
                    placeholderTextColor="#94a3b8"
                    value={stallLocation}
                    onChangeText={setStallLocation}
                  />

                  <Text style={styles.inputSectionLabel}>MERCHANT UPI ID (FOR DIRECT SETTLEMENTS)</Text>
                  <TextInput
                    style={styles.borderedInput}
                    placeholder="e.g. canteen.merchant@upi"
                    placeholderTextColor="#94a3b8"
                    value={merchantUpi}
                    onChangeText={setMerchantUpi}
                    autoCapitalize="none"
                  />

                  {/* KDS Callout */}
                  <View style={styles.featureCalloutBox}>
                    <Text style={styles.featureCalloutEmoji}>⚡</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.featureCalloutTitle}>Live Kitchen Display System (KDS)</Text>
                      <Text style={styles.featureCalloutDesc}>
                        You will manage live prep queues, toggle sold-out dishes, and verify 4-digit pickup PINs from your vendor POS.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.dualBtnRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setStep(3)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.secondaryBtnText}>← Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.dualBtnPrimaryWrapper}
                    onPress={handleFinishOnboarding}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={['#0747a6', '#0070d2', '#00a3c4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryGradientBtn}
                    >
                      <Text style={styles.btnText}>Launch Canteen KDS 🚀</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#edf3f8',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ? StatusBar.currentHeight + 6 : 28) : 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 40,
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
    color: '#0f172a',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headerCampusSubtitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  campusPillBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  campusPillText: {
    color: '#0284c7',
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
    backgroundColor: '#ffffff',
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
    color: '#0c52a3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  welcomeHeaderBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 8,
  },
  welcomeHeaderBadgeText: {
    color: '#0284c7',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  welcomeHeroHeading: {
    color: '#0f172a',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  welcomeHeroSub: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18.5,
    fontWeight: '500',
    marginBottom: 16,
  },

  /* Mini Mascot Greeting on Step 1 */
  miniMascotGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  miniMascotImage: {
    width: 48,
    height: 48,
  },
  miniMascotTitle: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '900',
  },
  miniMascotSub: {
    color: '#64748b',
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
    backgroundColor: '#0c52a3',
  },
  progressBarCompleted: {
    backgroundColor: '#00a3c4',
  },
  progressLabel: {
    color: '#0c52a3',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  /* Main Floating Content Card */
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16.5,
    fontWeight: '500',
    marginTop: 2,
  },

  /* Form Labels & Text Inputs */
  inputSectionLabel: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 7,
    marginTop: 8,
  },
  inputSectionLabelNoMargin: {
    color: '#475569',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
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
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingVertical: 0,
  },
  editPhoneBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b9d9f5',
  },
  editPhoneBtnText: {
    color: '#0c52a3',
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
    color: '#ffffff',
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
    backgroundColor: '#f1f5f9',
    height: 52,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  secondaryBtnText: {
    color: '#475569',
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
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  otpHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resendLink: {
    color: '#0c52a3',
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
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digitBoxActive: {
    borderColor: '#0c52a3',
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  digitBoxFilled: {
    borderColor: '#0c52a3',
    backgroundColor: '#e6f2fb',
  },
  digitBoxChar: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
  },
  digitCursorBar: {
    position: 'absolute',
    bottom: 8,
    width: 14,
    height: 2,
    backgroundColor: '#0c52a3',
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
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },
  borderedInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },

  /* Role Selection Cards */
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    color: '#0f172a',
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
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  badgeFacultyText: {
    color: '#0284c7',
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
    color: '#64748b',
    fontSize: 11.5,
    lineHeight: 16.5,
    fontWeight: '500',
  },
  roleCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0c52a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleCheckMark: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },

  /* Extra Role Details Boxes */
  extraRoleDetailsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  extraFieldHint: {
    color: '#64748b',
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
    backgroundColor: '#e0f2fe',
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
    backgroundColor: '#ffffff',
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
    color: '#0c52a3',
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 12,
  },

  /* Feature Highlight Rows */
  featureHighlightsList: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  highlightIcon: {
    fontSize: 17,
  },
  highlightTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  highlightDesc: {
    color: '#64748b',
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
    color: '#64748b',
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
    color: '#0c52a3',
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
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
});
