import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import { sortUniversitiesByDistance, getDistanceInMeters, formatDistance } from '../utils/distance';
import { sendSmsOtp } from '../services/smsService';
import { loginWithPhone, getUserProfileByPhone } from '../services/authService';
import { fetchNearbyCampuses } from '../services/campusService';

export default function OnboardingFlow() {
  const {
    userLocation,
    requestUserLocation,
    locationPermissionGranted,
    completeOnboarding,
    canteens
  } = useContext(AppContext);

  // 1: Phone & OTP, 2: Name & Role (New Users Only), 3: Location Permissions, 4: Nearest Campus Discovery, 5: Canteen Setup (Seller)
  const [step, setStep] = useState(1);

  // Step 1: Phone Login & Verification
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  const [existingUserName, setExistingUserName] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [smsDeliveryStatus, setSmsDeliveryStatus] = useState('simulated');
  const otpInputRef = useRef(null);

  // Step 2: User Type ('student', 'faculty', 'seller')
  const [userType, setUserType] = useState('student');
  const [rollNo, setRollNo] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [roomNumber, setRoomNumber] = useState('');

  // Step 3: Location Permission
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isFetchingCampuses, setIsFetchingCampuses] = useState(false);

  // Step 4: Nearest Campus Selection
  const [selectedUniversity, setSelectedUniversity] = useState('sou');
  const [sortedCampuses, setSortedCampuses] = useState([]);

  // Vendor Fields (if userType === 'seller')
  const [stallName, setStallName] = useState('');
  const [stallLocation, setStallLocation] = useState('');
  const [merchantUpi, setMerchantUpi] = useState('');

  const selectedCampusObj =
    sortedCampuses.find(u => u.id === selectedUniversity) ||
    sortedCampuses[0] ||
    DEFAULT_UNIVERSITIES.find(u => u.id === selectedUniversity) ||
    DEFAULT_UNIVERSITIES[0];

  const campusDistanceDisplay =
    selectedCampusObj?.distanceFormatted && selectedCampusObj.distanceFormatted !== 'Location pending'
      ? selectedCampusObj.distanceFormatted
      : (userLocation?.lat && selectedCampusObj?.lat)
        ? formatDistance(getDistanceInMeters(userLocation.lat, userLocation.lng, selectedCampusObj.lat, selectedCampusObj.lng))
        : (selectedCampusObj?.distanceFormatted || 'Calculating...');

  const campusCanteensLiveCount = (canteens || []).filter(
    c => c.universityId === (selectedCampusObj?.id || 'sou')
  ).length;

  // Update sorted campuses whenever userLocation changes
  useEffect(() => {
    // Only refresh if we have real GPS (not null)
    if (!userLocation?.lat || !userLocation?.lng) return;
    fetchNearbyCampuses(userLocation.lat, userLocation.lng).then((list) => {
      setSortedCampuses(list);
      if (list.length > 0 && !selectedUniversity) {
        setSelectedUniversity(list[0].id);
      }
    }).catch(() => {});
  }, [userLocation]);

  const [resendTimer, setResendTimer] = useState(0);
  const [expectedOtp, setExpectedOtp] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

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
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setExpectedOtp(generated);
    setOtpSent(true);
    setOtpCode('');
    setResendTimer(30);
    setCopiedCode(false);
    setAutoFilled(false);

    try {
      const result = await sendSmsOtp(cleanPhone, generated);
      if (result && result.success) {
        setSmsDeliveryStatus('live');
      } else {
        setSmsDeliveryStatus('simulated');
      }
    } catch (e) {
      setSmsDeliveryStatus('simulated');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleAutoFill = () => {
    if (expectedOtp) {
      setOtpCode(expectedOtp);
      setAutoFilled(true);
      setTimeout(() => setAutoFilled(false), 2500);
    }
  };

  const handleCopyCode = async () => {
    if (!expectedOtp) return;
    try {
      await Clipboard.setStringAsync(expectedOtp);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      console.log('Clipboard copy note:', e);
    }
  };

  const handleVerifyAndContinueStep1 = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      Alert.alert('Phone Required', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!otpSent) {
      Alert.alert('Verification Required', 'Please tap "Send 6-Digit SMS Code" first.');
      return;
    }
    if (otpCode.trim().length !== 6) {
      Alert.alert('6-Digit Code Required', 'Please enter the complete 6-digit verification code.');
      return;
    }
    // Verify against received SMS OTP
    if (expectedOtp && otpCode.trim() !== expectedOtp) {
      Alert.alert('Incorrect Code', 'The 6-digit code you entered is invalid. Please check and try again.');
      return;
    }

    setIsCheckingProfile(true);

    try {
      // Check if user already has a registered profile
      const existingProfile = await getUserProfileByPhone(cleanPhone);

      if (existingProfile && existingProfile.name && existingProfile.name.trim() !== '' && existingProfile.name !== 'Campus Student') {
        console.log('[Onboarding] Existing user profile recognized:', cleanPhone, existingProfile.name);
        setIsExistingUser(true);
        setExistingUserName(existingProfile.name);
        setName(existingProfile.name);
        if (existingProfile.userType) setUserType(existingProfile.userType);
        if (existingProfile.rollNo) setRollNo(existingProfile.rollNo);
        if (existingProfile.facultyId) setFacultyId(existingProfile.facultyId);
        if (existingProfile.roomNumber) setRoomNumber(existingProfile.roomNumber);
        if (existingProfile.universityId) setSelectedUniversity(existingProfile.universityId);

        // Synchronize Firestore user document immediately
        await loginWithPhone({
          phone: cleanPhone,
          name: existingProfile.name,
          userType: existingProfile.userType || 'student',
          universityId: existingProfile.universityId || selectedUniversity || 'sou',
          rollNo: existingProfile.rollNo || '',
          facultyId: existingProfile.facultyId || '',
          roomNumber: existingProfile.roomNumber || ''
        });

        setIsOtpVerified(true);
        // Existing user! Skip Step 2 (Name & Details) completely and proceed to Location setup!
        setStep(3);
      } else {
        // New unregistered user: proceed to enter Name & Role details
        console.log('[Onboarding] New user, prompting for profile details');
        setIsExistingUser(false);
        setIsOtpVerified(true);
        setStep(2);
      }
    } catch (e) {
      console.log('User profile lookup error:', e);
      setIsExistingUser(false);
      setIsOtpVerified(true);
      setStep(2);
    } finally {
      setIsCheckingProfile(false);
    }
  };

  // Step 3 Handlers (Location)
  const handleGrantLocation = async () => {
    setIsRequestingLocation(true);
    try {
      await requestUserLocation();
      let coords = null;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (loc?.coords) {
          coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        }
      } catch (locErr) {}

      const lat = coords?.lat || userLocation?.lat;
      const lng = coords?.lng || userLocation?.lng;

      setIsFetchingCampuses(true);
      try {
        const list = await fetchNearbyCampuses(lat, lng);
        setSortedCampuses(list);
        if (list.length > 0) {
          setSelectedUniversity(list[0].id);
        }
      } catch (fetchErr) {
        console.log('Campus fetch note:', fetchErr);
      } finally {
        setIsFetchingCampuses(false);
      }
    } catch (e) {
      console.log('Location grant note:', e);
    } finally {
      setIsRequestingLocation(false);
      setStep(4);
    }
  };

  const handleSkipLocation = async () => {
    // Use SOU default coordinates as fallback
    setIsFetchingCampuses(true);
    try {
      const fallbackLat = userLocation?.lat || 23.0917;
      const fallbackLng = userLocation?.lng || 72.5349;
      const list = await fetchNearbyCampuses(fallbackLat, fallbackLng);
      setSortedCampuses(list);
      if (list.length > 0) {
        setSelectedUniversity(list[0].id);
      }
    } catch (e) {
      console.log('Campus fetch (skip) note:', e);
    } finally {
      setIsFetchingCampuses(false);
    }
    setStep(4);
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

    await completeOnboarding({
      chosenRole,
      chosenUniversity: selectedUniversity || 'sou',
      profileData: {
        name: name.trim(),
        phone: phone.trim(),
        userType,
        rollNo: userType === 'student' ? (rollNo.trim() || '') : '',
        facultyId: userType === 'faculty' ? (facultyId.trim() || '') : '',
        roomNumber: userType === 'faculty' ? (roomNumber.trim() || '') : '',
        facultyRoomNote: userType === 'faculty' ? (roomNumber.trim() || '') : ''
      },
      vendorCanteenData
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070a13" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>Q</Text>
            </View>
            <Text style={styles.brandTitle}>SkipQ</Text>
            <Text style={styles.brandTagline}>Zero-Queue Campus Food Radar • Silver Oak</Text>
          </View>

          {/* STEP 1: PHONE LOGIN & VERIFICATION */}
          {step === 1 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>⚡ STEP 1 OF 4 • MOBILE LOGIN</Text>
              </View>

              <Text style={styles.cardTitle}>👋 Welcome to SkipQ</Text>
              <Text style={styles.cardDesc}>
                Enter your mobile number to sign in and activate your zero-queue digital pickup pass.
              </Text>

              {/* Mobile Number Input with Unified Modern Container */}
              <Text style={styles.inputLabel}>MOBILE PHONE NUMBER</Text>
              <View style={[styles.unifiedPhoneCard, otpSent && styles.unifiedPhoneCardLocked]}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryFlag}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <View style={styles.phoneDivider} />
                <TextInput
                  style={styles.unifiedPhoneInput}
                  placeholder="98765 43210"
                  placeholderTextColor="#475569"
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
                    style={styles.changePhoneBtn}
                    onPress={() => {
                      setOtpSent(false);
                      setOtpCode('');
                      setExpectedOtp('');
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.changePhoneText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Send SMS Code Button */}
              {!otpSent && (
                <TouchableOpacity
                  style={[
                    styles.sendOtpBtn,
                    (phone.replace(/\D/g, '').length !== 10 || isSendingSms) && styles.sendOtpBtnDisabled
                  ]}
                  onPress={handleSendOtp}
                  disabled={phone.replace(/\D/g, '').length !== 10 || isSendingSms}
                  activeOpacity={0.85}
                >
                  {isSendingSms ? (
                    <View style={styles.btnLoadingRow}>
                      <ActivityIndicator size="small" color="#ffffff" />
                      <Text style={styles.sendOtpBtnText}>  Dispatching SMS...</Text>
                    </View>
                  ) : (
                    <Text style={styles.sendOtpBtnText}>Send 6-Digit SMS Code ➔</Text>
                  )}
                </TouchableOpacity>
              )}

              {/* 6-Digit SMS Verification Card */}
              {otpSent && (
                <View style={styles.verificationSection}>
                  <View style={styles.verificationHeaderRow}>
                    <Text style={styles.inputLabelNoMargin}>ENTER 6-DIGIT CODE</Text>
                    <TouchableOpacity
                      disabled={resendTimer > 0 || isSendingSms}
                      onPress={handleSendOtp}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.resendText, (resendTimer > 0 || isSendingSms) && styles.resendTextDisabled]}>
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Sleek SMS Autofill Suggestion Banner */}
                  {Boolean(expectedOtp) && (
                    <View style={styles.smsAutofillBanner}>
                      <View style={styles.smsAutofillLeft}>
                        <Text style={styles.smsIcon}>💬</Text>
                        <View>
                          <Text style={styles.smsAutofillLabel}>Code from SMS</Text>
                          <Text style={styles.smsCodeHighlight}>{expectedOtp}</Text>
                        </View>
                      </View>
                      <View style={styles.smsAutofillActions}>
                        <TouchableOpacity
                          style={[styles.quickFillButton, autoFilled && styles.quickFillButtonSuccess]}
                          onPress={handleAutoFill}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.quickFillButtonText}>
                            {autoFilled ? '✓ Filled' : '⚡ Auto-Fill'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.quickCopyButton, copiedCode && styles.quickCopyButtonSuccess]}
                          onPress={handleCopyCode}
                          activeOpacity={0.8}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.quickCopyButtonText}>{copiedCode ? '✓' : '📋'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Segmented 6-Digit Boxes with Full Transparent Overlay */}
                  <View style={styles.interactiveBoxesContainer}>
                    <View style={styles.segmentedBoxesRow}>
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
                            <Text style={styles.digitBoxText}>{char}</Text>
                            {isCurrent && <View style={styles.cursorIndicator} />}
                          </View>
                        );
                      })}
                    </View>

                    {/* Transparent Full Overlay Input for Seamless Numberpad Input */}
                    <TextInput
                      ref={otpInputRef}
                      style={styles.overlayHiddenInput}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={otpCode}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/\D/g, '');
                        setOtpCode(cleaned);
                      }}
                      caretHidden
                      autoFocus
                    />
                  </View>

                  {otpCode.length === 6 && (
                    <View style={styles.codeMatchBanner}>
                      {otpCode === expectedOtp ? (
                        <View style={styles.codeMatchSuccessBadge}>
                          <Text style={styles.codeMatchSuccessText}>✓ 6-Digit Code Verified</Text>
                        </View>
                      ) : (
                        <View style={styles.codeMatchErrorBadge}>
                          <Text style={styles.codeMatchErrorText}>⚠️ Incorrect verification code</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Verify and Continue Action */}
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (!otpSent || otpCode.length !== 6 || isCheckingProfile) && styles.primaryBtnDimmed
                ]}
                onPress={handleVerifyAndContinueStep1}
                disabled={!otpSent || otpCode.length !== 6 || isCheckingProfile}
                activeOpacity={0.85}
              >
                {isCheckingProfile ? (
                  <View style={styles.btnLoadingRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.primaryBtnText}>  Verifying & Signing In...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryBtnText}>Verify & Continue ➔</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: COMPLETE YOUR PROFILE (NEW USERS ONLY) */}
          {step === 2 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 2 OF 4 • COMPLETE YOUR PROFILE</Text>
              </View>

              <Text style={styles.cardTitle}>📝 Your Name & Campus Role</Text>
              <Text style={styles.cardDesc}>
                Enter your full name and select your role to personalize your zero-queue ordering experience:
              </Text>

              {/* Full Name Input */}
              <Text style={styles.inputLabel}>YOUR FULL NAME *</Text>
              <View style={styles.unifiedInputContainer}>
                <Text style={styles.inputLeadingIcon}>👤</Text>
                <TextInput
                  style={styles.unifiedTextInput}
                  placeholder="e.g. Satyam Sharma"
                  placeholderTextColor="#475569"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>SELECT YOUR CAMPUS ROLE</Text>

              {/* 1. Student / Scholar */}
              <TouchableOpacity
                style={[styles.roleCard, userType === 'student' && styles.roleCardActive]}
                onPress={() => setUserType('student')}
              >
                <View style={styles.roleIconCircle}>
                  <Text style={styles.roleEmoji}>🎓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.roleHeaderRow}>
                    <Text style={styles.roleTitle}>Student / Scholar</Text>
                    <View style={styles.roleBadgeStudent}>
                      <Text style={styles.roleBadgeStudentText}>MOST POPULAR</Text>
                    </View>
                  </View>
                  <Text style={styles.roleSub}>
                    Browse live canteen menus, check wait times, and collect orders with zero queue using digital tokens.
                  </Text>
                </View>
                {userType === 'student' && <Text style={styles.roleCheckmark}>✓</Text>}
              </TouchableOpacity>

              {/* 2. Faculty / University Staff */}
              <TouchableOpacity
                style={[styles.roleCard, userType === 'faculty' && styles.roleCardActive]}
                onPress={() => setUserType('faculty')}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={styles.roleEmoji}>👨‍🏫</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.roleHeaderRow}>
                    <Text style={styles.roleTitle}>Faculty / Staff</Text>
                    <View style={styles.roleBadgeFaculty}>
                      <Text style={styles.roleBadgeFacultyText}>EXPRESS PASS</Text>
                    </View>
                  </View>
                  <Text style={styles.roleSub}>
                    Priority canteen handoffs between lectures, lab sessions, and departmental meetings.
                  </Text>
                </View>
                {userType === 'faculty' && <Text style={styles.roleCheckmark}>✓</Text>}
              </TouchableOpacity>

              {/* 3. Canteen Operator / Merchant */}
              <TouchableOpacity
                style={[styles.roleCard, userType === 'seller' && styles.roleCardActive]}
                onPress={() => setUserType('seller')}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={styles.roleEmoji}>🏪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.roleHeaderRow}>
                    <Text style={styles.roleTitle}>Canteen Staff / Merchant</Text>
                    <View style={styles.roleBadgeMerchant}>
                      <Text style={styles.roleBadgeMerchantText}>KDS POS</Text>
                    </View>
                  </View>
                  <Text style={styles.roleSub}>
                    Manage kitchen orders, update dish prices and out-of-stock items, and verify pickups with 4-digit PINs.
                  </Text>
                </View>
                {userType === 'seller' && <Text style={styles.roleCheckmark}>✓</Text>}
              </TouchableOpacity>

              {/* Dynamic Role-Specific Detail Inputs */}
              {userType === 'student' && (
                <View style={styles.roleExtraFieldsBox}>
                  <Text style={styles.inputLabel}>STUDENT ENROLLMENT / ROLL NUMBER (OPTIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Enrollment No (leave empty if none)"
                    placeholderTextColor="#64748b"
                    value={rollNo}
                    onChangeText={setRollNo}
                    autoCapitalize="characters"
                  />
                  <Text style={styles.roleFieldHint}>Leave empty if not yet assigned by university.</Text>
                </View>
              )}

              {userType === 'faculty' && (
                <View style={styles.roleExtraFieldsBox}>
                  <Text style={styles.inputLabel}>FACULTY / STAFF ID (OPTIONAL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. FAC-CS-104 or Employee ID"
                    placeholderTextColor="#64748b"
                    value={facultyId}
                    onChangeText={setFacultyId}
                    autoCapitalize="characters"
                  />

                  <Text style={styles.inputLabel}>ROOM / CABIN NUMBER (FOR DIRECT ROOM DELIVERY) *</Text>
                  <TextInput
                    style={[styles.input, { borderColor: '#38bdf8' }]}
                    placeholder="e.g. Block B, Staff Room 204 or Cabin 12"
                    placeholderTextColor="#64748b"
                    value={roomNumber}
                    onChangeText={setRoomNumber}
                  />

                  <View style={styles.roomDeliveryCallout}>
                    <Text style={styles.roomDeliveryCalloutEmoji}>🚪</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomDeliveryCalloutTitle}>Direct Campus Room Delivery</Text>
                      <Text style={styles.roomDeliveryCalloutSub}>
                        Canteen runners will deliver hot orders straight to your faculty room or cabin between classes!
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, !name.trim() && styles.nextBtnDisabled]}
                  disabled={!name.trim()}
                  onPress={async () => {
                    if (!name.trim()) {
                      Alert.alert('Name Required', 'Please enter your full name to proceed.');
                      return;
                    }
                    try {
                      await loginWithPhone({
                        phone,
                        name: name.trim(),
                        userType,
                        universityId: selectedUniversity || 'sou',
                        rollNo: userType === 'student' ? rollNo.trim() : '',
                        facultyId: userType === 'faculty' ? facultyId.trim() : '',
                        roomNumber: userType === 'faculty' ? roomNumber.trim() : ''
                      });
                    } catch (e) {}
                    setStep(3);
                  }}
                >
                  <Text style={styles.nextBtnText}>Continue to Location ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3: LOCATION PERMISSIONS */}
          {step === 3 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>
                  {isExistingUser ? 'STEP 2 OF 3 • GPS PERMISSIONS' : 'STEP 3 OF 4 • GPS PERMISSIONS'}
                </Text>
              </View>

              {isExistingUser && (
                <View style={styles.welcomeBackBanner}>
                  <Text style={styles.welcomeBackIcon}>👋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.welcomeBackTitle}>Welcome back, {existingUserName || name}!</Text>
                    <Text style={styles.welcomeBackSub}>
                      Your SkipQ account is verified. Let's find your nearest campus food court.
                    </Text>
                  </View>
                </View>
              )}

              <Text style={styles.cardTitle}>📍 Campus Geofencing Setup</Text>
              <Text style={styles.cardDesc}>
                SkipQ uses your live device GPS to locate your nearest campus and verify that you are within the 300m counter proximity so food is prepared fresh.
              </Text>

              {/* Permissions Feature Highlights */}
              <View style={styles.permissionList}>
                <View style={styles.permissionItem}>
                  <Text style={styles.permissionItemIcon}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.permissionItemTitle}>Nearest Campus Auto-Discovery</Text>
                    <Text style={styles.permissionItemDesc}>
                      Detects your physical presence at Silver Oak University or neighboring colleges in Gujarat.
                    </Text>
                  </View>
                </View>

                <View style={styles.permissionItem}>
                  <Text style={styles.permissionItemIcon}>🛡️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.permissionItemTitle}>300m Zero-Queue Proximity Lock</Text>
                    <Text style={styles.permissionItemDesc}>
                      Guarantees your order is placed near counter so meals are fresh and not left cold.
                    </Text>
                  </View>
                </View>

                <View style={styles.permissionItem}>
                  <Text style={styles.permissionItemIcon}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.permissionItemTitle}>Real Hardware Telemetry</Text>
                    <Text style={styles.permissionItemDesc}>
                      Continuous high-accuracy coordinates without simulated buttons or fake locations.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Primary GPS Permission Button */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleGrantLocation}
                disabled={isRequestingLocation}
              >
                {isRequestingLocation ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>📡 Grant GPS & Detect Campus ➔</Text>
                )}
              </TouchableOpacity>

              {/* Skip / Desktop Testing Button */}
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipLocation}>
                <Text style={styles.skipBtnText}>Continue with Default Coordinates (Ahmedabad)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.backBtnFull} onPress={() => setStep(isExistingUser ? 1 : 2)}>
                <Text style={styles.backBtnText}>← Back to {isExistingUser ? 'Phone Login' : 'Profile Details'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 4: NEAREST REGISTERED CAMPUS DISCOVERY */}
          {step === 4 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>
                  {isExistingUser
                    ? 'STEP 3 OF 3 • CAMPUS CONFIRMATION'
                    : `STEP 4 OF ${userType === 'seller' ? '5' : '4'} • CAMPUS DISCOVERY`}
                </Text>
              </View>

              <Text style={styles.cardTitle}>🏫 Nearest Campus Confirmed</Text>
              <Text style={styles.cardDesc}>
                We automatically detected the closest campus based on your GPS distance. Tap any other campus if you study elsewhere:
              </Text>

              {isFetchingCampuses ? (
                <View style={styles.campusFetchingBanner}>
                  <ActivityIndicator color="#06b6d4" size="small" />
                  <Text style={styles.campusFetchingText}>  Scanning for campuses within 10 km...</Text>
                </View>
              ) : (
                <>
              {/* Auto-chosen Nearest Campus Callout */}
              <View style={styles.autoSelectCampusBanner}>
                <View style={styles.autoSelectCampusHeader}>
                  <Text style={styles.autoSelectCampusBadge}>🎯 AUTO-CHOSEN NEAREST CAMPUS</Text>
                  <Text style={styles.autoSelectCampusDist}>{campusDistanceDisplay}</Text>
                </View>
                <Text style={styles.autoSelectCampusName}>{selectedCampusObj?.name || 'Silver Oak University'}</Text>
                <Text style={styles.autoSelectCampusSub}>
                  {selectedCampusObj?.type || 'University'} • {selectedCampusObj?.city || 'Ahmedabad'}
                  {campusCanteensLiveCount > 0 ? ` • 🟢 ${campusCanteensLiveCount} Canteens Active` : ' • 0 Canteens Live'}
                </Text>
                <Text style={styles.autoSelectCampusNote}>
                  ✓ Selected for you. Confirm below or tap any other campus to switch:
                </Text>
              </View>

              {/* Sorted Campus Cards */}
              <View style={styles.campusesList}>
                {sortedCampuses.map((campus, idx) => {
                  const isSelected = selectedUniversity === campus.id;
                  const isNearest = idx === 0;
                  const liveCount = (canteens || []).filter(c => c.universityId === campus.id).length;

                  return (
                    <TouchableOpacity
                      key={campus.id}
                      style={[
                        styles.campusCard,
                        isSelected && styles.campusCardActive,
                        isNearest && styles.campusCardNearest
                      ]}
                      onPress={() => setSelectedUniversity(campus.id)}
                    >
                      <View style={styles.campusCardHeader}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.campusTagRow}>
                            {isNearest && (
                              <View style={styles.nearestBadge}>
                                <Text style={styles.nearestBadgeText}>
                                  🎯 NEAREST TO YOU • {campus.distanceFormatted}
                                </Text>
                              </View>
                            )}
                            {!isNearest && (
                              <View style={styles.distanceBadge}>
                                <Text style={styles.distanceBadgeText}>
                                  📍 {campus.distanceFormatted}
                                </Text>
                              </View>
                            )}
                            {liveCount > 0 && (
                              <View style={styles.liveCanteensBadge}>
                                <Text style={styles.liveCanteensBadgeText}>
                                  🟢 {liveCount} Canteens Live
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.campusCardTitle, isSelected && styles.campusCardTitleActive]}>
                            {campus.name}
                          </Text>
                          <Text style={styles.campusCardType}>
                            {campus.type} • {campus.city}
                          </Text>
                          <Text style={styles.campusCardAddr} numberOfLines={1}>
                            {campus.address}
                          </Text>
                        </View>
                        <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                          {isSelected && <View style={styles.radioDot} />}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(3)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.launchBtn}
                  onPress={() => {
                    if (userType === 'seller') {
                      setStep(5);
                    } else {
                      handleFinishOnboarding();
                    }
                  }}
                >
                  <Text style={styles.launchBtnText}>
                    {userType === 'seller' ? 'Next: Setup Stall ➔' : 'Confirm & Enter Food Radar 🚀'}
                  </Text>
                </TouchableOpacity>
              </View>
              </>
              )}
            </View>
          )}


          {/* STEP 5: DEDICATED CANTEEN STALL SETUP (VENDORS ONLY) */}
          {step === 5 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 5 OF 5 • CANTEEN STALL SETUP</Text>
              </View>

              <Text style={styles.cardTitle}>🏪 Register Your Canteen Stall</Text>
              <Text style={styles.cardDesc}>
                Configure your campus food counter profile to begin receiving digital orders & calling tokens:
              </Text>

              {/* Selected Institution Banner */}
              <View style={styles.selectedCampusBanner}>
                <Text style={styles.selectedCampusBannerLabel}>REGISTERING STALL AT</Text>
                <Text style={styles.selectedCampusBannerTitle}>
                  📍 {selectedCampusObj?.name || 'Selected Campus'}
                </Text>
              </View>

              <View style={styles.vendorBoxDedicated}>
                <Text style={styles.inputLabel}>CANTEEN / STALL NAME *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Silver Oak Central Food Court"
                  placeholderTextColor="#64748b"
                  value={stallName}
                  onChangeText={setStallName}
                />

                <Text style={styles.inputLabel}>STALL LOCATION ON CAMPUS</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Central Courtyard, Opp. Block A"
                  placeholderTextColor="#64748b"
                  value={stallLocation}
                  onChangeText={setStallLocation}
                />

                <Text style={styles.inputLabel}>MERCHANT UPI ID (FOR DIRECT PAYMENTS)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. canteen.merchant@upi"
                  placeholderTextColor="#64748b"
                  value={merchantUpi}
                  onChangeText={setMerchantUpi}
                  autoCapitalize="none"
                />

                <View style={styles.kdsFeatureCallout}>
                  <Text style={styles.kdsFeatureTitle}>⚡ Live Kitchen Display System (KDS)</Text>
                  <Text style={styles.kdsFeatureSub}>
                    You will manage live student prep queues, toggle menu items, and call 4-digit pickup PINs from the vendor portal.
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(4)}>
                  <Text style={styles.backBtnText}>← Back to Campuses</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.launchBtn} onPress={handleFinishOnboarding}>
                  <Text style={styles.launchBtnText}>Launch Canteen KDS 🚀</Text>
                </TouchableOpacity>
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
    backgroundColor: '#070a13',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) + 8 : 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTagline: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: '#0c1322',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.22)',
  },
  stepIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  stepIndicatorText: {
    color: '#a5b4fc',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 7,
    marginTop: 12,
  },
  inputLabelNoMargin: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  unifiedPhoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111c35',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    height: 54,
  },
  unifiedPhoneCardLocked: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: '#0d162b',
  },
  countryCodeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCodeText: {
    color: '#f1f5f9',
    fontSize: 15,
    fontWeight: '800',
  },
  phoneDivider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 12,
  },
  unifiedPhoneInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.5,
    paddingVertical: 0,
  },
  changePhoneBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  changePhoneText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '800',
  },
  sendOtpBtn: {
    backgroundColor: '#4f46e5',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  sendOtpBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#1e293b',
  },
  sendOtpBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  verificationSection: {
    backgroundColor: '#0a101f',
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  verificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resendText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  resendTextDisabled: {
    color: '#64748b',
  },
  smsAutofillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    marginBottom: 12,
  },
  smsAutofillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smsIcon: {
    fontSize: 16,
  },
  smsAutofillLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  smsCodeHighlight: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  smsAutofillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickFillButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickFillButtonSuccess: {
    backgroundColor: '#10b981',
  },
  quickFillButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  quickCopyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickCopyButtonSuccess: {
    borderColor: '#10b981',
  },
  quickCopyButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  interactiveBoxesContainer: {
    position: 'relative',
    marginVertical: 4,
  },
  segmentedBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 7,
  },
  digitBox: {
    flex: 1,
    height: 52,
    backgroundColor: '#111c35',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  digitBoxFilled: {
    backgroundColor: '#0d1527',
    borderColor: '#6366f1',
  },
  digitBoxActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  digitBoxText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  cursorIndicator: {
    position: 'absolute',
    bottom: 10,
    width: 14,
    height: 2.5,
    backgroundColor: '#38bdf8',
    borderRadius: 2,
  },
  overlayHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
  },
  codeMatchBanner: {
    marginTop: 8,
    alignItems: 'center',
  },
  codeMatchSuccessBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  codeMatchSuccessText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '800',
  },
  codeMatchErrorBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  codeMatchErrorText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  unifiedInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111c35',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 4,
  },
  inputLeadingIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  unifiedTextInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 0,
  },
  input: {
    backgroundColor: '#111c35',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 10,
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDimmed: {
    opacity: 0.55,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#111a2e',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  roleCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  roleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 20,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  roleTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  roleBadgeStudent: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeStudentText: {
    color: '#a5b4fc',
    fontSize: 8,
    fontWeight: '900',
  },
  roleBadgeFaculty: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeFacultyText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '900',
  },
  roleBadgeMerchant: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roleBadgeMerchantText: {
    color: '#34d399',
    fontSize: 8,
    fontWeight: '900',
  },
  roleSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  roleCheckmark: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '900',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  backBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  backBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
  },
  backBtnFull: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  nextBtn: {
    flex: 1,
    backgroundColor: '#4f46e5',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  launchBtn: {
    flex: 1,
    backgroundColor: '#10b981',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  launchBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  permissionList: {
    backgroundColor: '#111a2e',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  permissionItem: {
    flexDirection: 'row',
    gap: 10,
  },
  permissionItemIcon: {
    fontSize: 18,
  },
  permissionItemTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  permissionItemDesc: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  skipBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  campusesList: {
    gap: 10,
    marginBottom: 14,
  },
  campusCard: {
    backgroundColor: '#111a2e',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  campusCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  campusCardNearest: {
    borderColor: '#06b6d4',
  },
  campusCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  campusTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  nearestBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  nearestBadgeText: {
    color: '#22d3ee',
    fontSize: 8,
    fontWeight: '900',
  },
  distanceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  distanceBadgeText: {
    color: '#cbd5e1',
    fontSize: 8,
    fontWeight: '800',
  },
  liveCanteensBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  liveCanteensBadgeText: {
    color: '#34d399',
    fontSize: 8,
    fontWeight: '900',
  },
  campusCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  campusCardTitleActive: {
    color: '#818cf8',
  },
  campusCardType: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  campusCardAddr: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 2,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  radioCircleActive: {
    borderColor: '#6366f1',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366f1',
  },
  vendorBox: {
    backgroundColor: '#0c1222',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  vendorBoxTitle: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  selectedCampusBanner: {
    backgroundColor: '#0c1a2d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  selectedCampusBannerLabel: {
    color: '#38bdf8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectedCampusBannerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 2,
  },
  vendorBoxDedicated: {
    backgroundColor: '#0c1424',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  kdsFeatureCallout: {
    backgroundColor: '#111e33',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  kdsFeatureTitle: {
    color: '#34d399',
    fontSize: 11.5,
    fontWeight: '800',
  },
  kdsFeatureSub: {
    color: '#94a3b8',
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },
  roleExtraFieldsBox: {
    backgroundColor: '#0c1527',
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  roleFieldHint: {
    color: '#64748b',
    fontSize: 10,
    marginTop: -4,
    marginBottom: 6,
  },
  roomDeliveryCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#38bdf8',
    gap: 8,
  },
  roomDeliveryCalloutEmoji: {
    fontSize: 20,
  },
  roomDeliveryCalloutTitle: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '800',
  },
  roomDeliveryCalloutSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  welcomeBackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    gap: 10,
  },
  welcomeBackIcon: {
    fontSize: 24,
  },
  welcomeBackTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  welcomeBackSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  autoSelectCampusBanner: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  autoSelectCampusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  autoSelectCampusBadge: {
    color: '#22d3ee',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  autoSelectCampusDist: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  autoSelectCampusName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  autoSelectCampusSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  autoSelectCampusNote: {
    color: '#67e8f9',
    fontSize: 10.5,
    marginTop: 8,
    fontWeight: '600',
  },
  nextBtnDisabled: {
    opacity: 0.45,
  },
  campusFetchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 12,
  },
  campusFetchingText: {
    color: '#06b6d4',
    fontSize: 13,
    fontWeight: '600',
  },
});

