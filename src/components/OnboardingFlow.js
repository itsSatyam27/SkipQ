import React, { useState, useContext, useEffect } from 'react';
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
  Alert
} from 'react-native';
import { AppContext } from '../context/AppContext';
import { DEFAULT_UNIVERSITIES } from '../data/mockData';
import { findClosestUniversity, formatDistance } from '../utils/distance';

export default function OnboardingFlow() {
  const {
    userLocation,
    requestUserLocation,
    locationPermissionGranted,
    completeOnboarding
  } = useContext(AppContext);

  const [step, setStep] = useState(1); // 1: Permissions, 2: Role Selection, 3: Role Details
  const [selectedRole, setSelectedRole] = useState('buyer'); // 'buyer' or 'seller'
  const [selectedUniversity, setSelectedUniversity] = useState('iitb');
  const [detectedCampusInfo, setDetectedCampusInfo] = useState(null);

  // Buyer State
  const [studentName, setStudentName] = useState('');
  const [studentRollNo, setStudentRollNo] = useState('');
  const [studentPhone, setStudentPhone] = useState('');

  // Vendor State
  const [stallName, setStallName] = useState('');
  const [stallLocation, setStallLocation] = useState('');
  const [openingHours, setOpeningHours] = useState('08:00 AM - 10:00 PM');
  const [merchantUpi, setMerchantUpi] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [initialDishName, setInitialDishName] = useState('');
  const [initialDishPrice, setInitialDishPrice] = useState('');
  const [initialDishCategory, setInitialDishCategory] = useState('Snacks');
  const [initialDishIsVeg, setInitialDishIsVeg] = useState(true);

  useEffect(() => {
    // When location is available, determine closest campus
    if (userLocation) {
      const match = findClosestUniversity(userLocation.lat, userLocation.lng, DEFAULT_UNIVERSITIES);
      if (match) {
        setDetectedCampusInfo(match);
        setSelectedUniversity(match.university.id);
      }
    }
  }, [userLocation]);

  const handleGrantLocation = async () => {
    try {
      await requestUserLocation();
      setStep(2);
    } catch (e) {
      setStep(2);
    }
  };

  const handleFinishBuyer = async () => {
    if (!studentName.trim()) {
      Alert.alert('Required Field', 'Please enter your name.');
      return;
    }

    await completeOnboarding({
      chosenRole: 'buyer',
      chosenUniversity: selectedUniversity,
      profileData: {
        name: studentName.trim(),
        rollNo: studentRollNo.trim(),
        phone: studentPhone.trim()
      }
    });
  };

  const handleFinishVendor = async () => {
    if (!stallName.trim()) {
      Alert.alert('Required Field', 'Please enter your Canteen / Stall Name.');
      return;
    }
    if (!stallLocation.trim()) {
      Alert.alert('Required Field', 'Please enter your Shop / Counter location.');
      return;
    }

    let initialMenu = [];
    if (initialDishName.trim()) {
      const priceNum = parseFloat(initialDishPrice);
      initialMenu.push({
        id: 'item-' + Date.now(),
        name: initialDishName.trim(),
        price: isNaN(priceNum) || priceNum <= 0 ? 50 : priceNum,
        category: initialDishCategory,
        isVeg: initialDishIsVeg,
        prepTime: '5 mins',
        isAvailable: true,
        description: 'Freshly prepared at counter.'
      });
    }

    await completeOnboarding({
      chosenRole: 'seller',
      chosenUniversity: selectedUniversity,
      vendorCanteenData: {
        name: stallName.trim(),
        location: stallLocation.trim(),
        openingHours: openingHours.trim(),
        upiId: merchantUpi.trim() || `${stallName.toLowerCase().replace(/\s+/g, '')}@upi`,
        phone: vendorPhone.trim() || '+91 98765 00000',
        initialMenu
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
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
            <Text style={styles.brandTagline}>Zero-Queue Campus Food Radar</Text>
          </View>

          {/* STEP 1: PERMISSIONS */}
          {step === 1 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 1 OF 3</Text>
              </View>

              <Text style={styles.cardTitle}>📍 Location Permissions</Text>
              <Text style={styles.cardDesc}>
                SkipQ uses your live GPS position to detect your university campus, calculate exact walking distance to canteens, and enforce the 300m proximity rule.
              </Text>

              <View style={styles.permissionBox}>
                <Text style={styles.permissionIcon}>🛡️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.permissionHeading}>Campus Proximity & Anti-Fraud</Text>
                  <Text style={styles.permissionSub}>
                    Required to verify distance and ensure food is served piping hot without long counter queues.
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={handleGrantLocation}>
                <Text style={styles.primaryBtnText}>Enable Location & Continue ➔</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep(2)}>
                <Text style={styles.skipBtnText}>Continue with Default Coordinates</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: ROLE SELECTION */}
          {step === 2 && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 2 OF 3</Text>
              </View>

              <Text style={styles.cardTitle}>Select Your Account Type</Text>
              <Text style={styles.cardDesc}>
                Choose how you will be using SkipQ on campus:
              </Text>

              {/* Student Role Card */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'buyer' && styles.roleCardActive]}
                onPress={() => setSelectedRole('buyer')}
              >
                <View style={styles.roleIconCircle}>
                  <Text style={styles.roleEmoji}>🎓</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>Student / Campus Buyer</Text>
                  <Text style={styles.roleSub}>
                    Browse live canteens, check food stock in real time, and order ahead with digital passes.
                  </Text>
                </View>
                {selectedRole === 'buyer' && <Text style={styles.roleCheckmark}>✓</Text>}
              </TouchableOpacity>

              {/* Vendor Role Card */}
              <TouchableOpacity
                style={[styles.roleCard, selectedRole === 'seller' && styles.roleCardActive]}
                onPress={() => setSelectedRole('seller')}
              >
                <View style={[styles.roleIconCircle, { backgroundColor: '#10b981' }]}>
                  <Text style={styles.roleEmoji}>🏪</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roleTitle}>Canteen Vendor / Stall Owner</Text>
                  <Text style={styles.roleSub}>
                    Manage kitchen queues, update dish prices/stock live, and hand off pre-ordered meals.
                  </Text>
                </View>
                {selectedRole === 'seller' && <Text style={styles.roleCheckmark}>✓</Text>}
              </TouchableOpacity>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                  <Text style={styles.nextBtnText}>Continue ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3A: STUDENT SETUP */}
          {step === 3 && selectedRole === 'buyer' && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 3 OF 3</Text>
              </View>

              <Text style={styles.cardTitle}>🎓 Student Profile & Campus</Text>
              <Text style={styles.cardDesc}>
                Configure your campus food radar identity:
              </Text>

              {/* Campus Match Badge */}
              <Text style={styles.inputLabel}>YOUR CAMPUS (AUTO-DETECTED BY GPS)</Text>
              <View style={styles.campusDetectedBox}>
                <Text style={styles.campusIcon}>📍</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.campusName}>
                    {DEFAULT_UNIVERSITIES.find(u => u.id === selectedUniversity)?.name}
                  </Text>
                  {detectedCampusInfo && (
                    <Text style={styles.campusDistance}>
                      Closest detected campus ({formatDistance(detectedCampusInfo.distanceMeters)} away)
                    </Text>
                  )}
                </View>
              </View>

              {/* Campus Selector Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.uniScroll}>
                {DEFAULT_UNIVERSITIES.map(uni => (
                  <TouchableOpacity
                    key={uni.id}
                    style={[
                      styles.uniChip,
                      selectedUniversity === uni.id && styles.uniChipActive
                    ]}
                    onPress={() => setSelectedUniversity(uni.id)}
                  >
                    <Text
                      style={[
                        styles.uniChipText,
                        selectedUniversity === uni.id && styles.uniChipTextActive
                      ]}
                    >
                      {uni.city} - {uni.name.split('(')[0].trim()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Personal Details */}
              <Text style={styles.inputLabel}>YOUR FULL NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Aarav Mehta"
                placeholderTextColor="#64748b"
                value={studentName}
                onChangeText={setStudentName}
              />

              <Text style={styles.inputLabel}>STUDENT ID / ROLL NO (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 21BCE1042"
                placeholderTextColor="#64748b"
                value={studentRollNo}
                onChangeText={setStudentRollNo}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>MOBILE PHONE (FOR SMS TOKENS)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +91 98765 43210"
                placeholderTextColor="#64748b"
                value={studentPhone}
                onChangeText={setStudentPhone}
                keyboardType="phone-pad"
              />

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.launchBtn} onPress={handleFinishBuyer}>
                  <Text style={styles.launchBtnText}>Enter Food Radar 🚀</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* STEP 3B: VENDOR SETUP */}
          {step === 3 && selectedRole === 'seller' && (
            <View style={styles.card}>
              <View style={styles.stepIndicator}>
                <Text style={styles.stepIndicatorText}>STEP 3 OF 3</Text>
              </View>

              <Text style={styles.cardTitle}>🏪 Register Your Canteen Stall</Text>
              <Text style={styles.cardDesc}>
                Set up your stall counter to start receiving live campus orders:
              </Text>

              {/* Campus Match Badge */}
              <Text style={styles.inputLabel}>SELECT CAMPUS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.uniScroll}>
                {DEFAULT_UNIVERSITIES.map(uni => (
                  <TouchableOpacity
                    key={uni.id}
                    style={[
                      styles.uniChip,
                      selectedUniversity === uni.id && styles.uniChipActive
                    ]}
                    onPress={() => setSelectedUniversity(uni.id)}
                  >
                    <Text
                      style={[
                        styles.uniChipText,
                        selectedUniversity === uni.id && styles.uniChipTextActive
                      ]}
                    >
                      {uni.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Stall Information */}
              <Text style={styles.inputLabel}>CANTEEN / STALL NAME *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Sharma Ji Canteen, Cafe Coffee Day Kiosk"
                placeholderTextColor="#64748b"
                value={stallName}
                onChangeText={setStallName}
              />

              <Text style={styles.inputLabel}>SHOP / COUNTER NUMBER & LANDMARK *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Counter #4, Hostel 12 Ground Floor"
                placeholderTextColor="#64748b"
                value={stallLocation}
                onChangeText={setStallLocation}
              />

              <Text style={styles.inputLabel}>MERCHANT UPI ID (FOR DIRECT PAYMENTS)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. canteen.sharma@upi"
                placeholderTextColor="#64748b"
                value={merchantUpi}
                onChangeText={setMerchantUpi}
                autoCapitalize="none"
              />

              {/* Initial Dish (Quick Start) */}
              <Text style={[styles.inputLabel, { marginTop: 14, color: '#10b981' }]}>
                🍳 ADD FIRST DISH (OPTIONAL QUICK START)
              </Text>
              <View style={styles.initialDishBox}>
                <TextInput
                  style={[styles.input, { marginBottom: 6 }]}
                  placeholder="Dish Name (e.g. Cheese Butter Maggi)"
                  placeholderTextColor="#64748b"
                  value={initialDishName}
                  onChangeText={setInitialDishName}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="Price ₹ (e.g. 50)"
                    placeholderTextColor="#64748b"
                    keyboardType="numeric"
                    value={initialDishPrice}
                    onChangeText={setInitialDishPrice}
                  />
                  <TouchableOpacity
                    style={[
                      styles.dietaryToggleBtn,
                      initialDishIsVeg ? styles.vegActive : styles.nonVegActive
                    ]}
                    onPress={() => setInitialDishIsVeg(!initialDishIsVeg)}
                  >
                    <Text style={styles.dietaryToggleText}>
                      {initialDishIsVeg ? '🟢 Pure Veg' : '🔴 Non-Veg'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                  <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.launchBtn} onPress={handleFinishVendor}>
                  <Text style={styles.launchBtnText}>Launch Canteen POS 🚀</Text>
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
    backgroundColor: '#090d16',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  brandHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logoBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 8,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
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
    marginTop: 2,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepIndicator: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  stepIndicatorText: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  permissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  permissionIcon: {
    fontSize: 24,
  },
  permissionHeading: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  permissionSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  primaryBtn: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  skipBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleCardActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  roleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 20,
  },
  roleTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  roleSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  roleCheckmark: {
    color: '#6366f1',
    fontSize: 18,
    fontWeight: '900',
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  campusDetectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    marginBottom: 8,
  },
  campusIcon: {
    fontSize: 16,
  },
  campusName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  campusDistance: {
    color: '#06b6d4',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  uniScroll: {
    marginBottom: 10,
  },
  uniChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  uniChipActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
  },
  uniChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  uniChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  initialDishBox: {
    backgroundColor: '#131d33',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  dietaryToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  vegActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  nonVegActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  dietaryToggleText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  backBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 13,
  },
  nextBtn: {
    flex: 2,
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  launchBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  launchBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
});
