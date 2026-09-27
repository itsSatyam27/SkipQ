import React, { useContext, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppContext } from '../context/AppContext';

const Field = ({ label, last, ...props }) => (
  <View style={[styles.field, last && styles.fieldLast]}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput style={styles.fieldInput} placeholderTextColor="#879188" {...props} />
  </View>
);

export default function StudentProfileScreen() {
  const { userProfile, updateUserProfile, walletBalance, topUpWallet, logoutUser, restartOnboarding } = useContext(AppContext);
  const [name, setName] = useState(userProfile?.name || '');
  const [rollNo, setRollNo] = useState(userProfile?.rollNo || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [userType, setUserType] = useState(userProfile?.userType || 'student');
  const [facultyRoomNote, setFacultyRoomNote] = useState(userProfile?.facultyRoomNote || '');
  const [topUpAmount, setTopUpAmount] = useState('200');

  useEffect(() => {
    if (!userProfile) return;
    setName(userProfile.name || ''); setRollNo(userProfile.rollNo || ''); setPhone(userProfile.phone || '');
    setUserType(userProfile.userType || 'student'); setFacultyRoomNote(userProfile.facultyRoomNote || '');
  }, [userProfile]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Add your name', 'Your name helps the counter identify your order.');
    await updateUserProfile({ name: name.trim(), rollNo: rollNo.trim(), phone: phone.trim(), userType, facultyRoomNote: facultyRoomNote.trim() });
    Alert.alert('Saved', 'Your profile is up to date.');
  };
  const addMoney = async value => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return Alert.alert('Enter an amount', 'Please enter a valid wallet top-up amount.');
    await topUpWallet(amount); Alert.alert('Demo wallet updated', `₹${amount} was added locally. Connect a payment provider before using this in production.`);
  };
  const changeSetup = () => Alert.alert('Change campus or role?', 'You will return to setup, but your saved data stays safe.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: restartOnboarding }]);
  const logout = () => Alert.alert('Log out?', 'You will return to the welcome screen.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Log out', style: 'destructive', onPress: logoutUser }]);
  const sendFeedback = () => {
    const subject = encodeURIComponent('SkipQ feedback');
    const body = encodeURIComponent('Hi SkipQ team,\n\nMy feedback:\n\n\nDevice / app version (optional):');
    Linking.openURL(`mailto:skipqueue.official@gmail.com?subject=${subject}&body=${body}`).catch(() =>
      Alert.alert('Email unavailable', 'Please email skipqueue.official@gmail.com directly.')
    );
  };
  const firstName = name.trim().split(' ')[0] || 'Student';

  return <View style={styles.container}><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.topLine}><View><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.title}>Hello, {firstName}</Text></View><View style={styles.status}><View style={styles.statusDot}/><Text style={styles.statusText}>ACTIVE</Text></View></View>

    <View style={styles.identityCard}><View style={styles.avatar}><Text style={styles.avatarText}>{name.trim() ? name.trim()[0].toUpperCase() : 'S'}</Text></View><View style={styles.identityCopy}><Text style={styles.name}>{name || 'Campus student'}</Text><Text style={styles.campus}>Silver Oak University · SOU</Text><Text style={styles.memberId}>{rollNo ? `ID  ${rollNo}` : 'Add your enrollment number'}</Text></View><TouchableOpacity style={styles.saveMini} onPress={save}><Text style={styles.saveMiniText}>SAVE</Text></TouchableOpacity></View>

    <View style={styles.walletCard}><View style={styles.walletHeader}><View><Text style={styles.walletLabel}>SKIPQ DEMO WALLET</Text><Text style={styles.walletAmount}>₹{walletBalance.toFixed(0)}</Text></View><View style={styles.walletMark}><Text style={styles.walletMarkText}>Q</Text></View></View><Text style={styles.walletMessage}>Local test balance only — no payment is processed.</Text><View style={styles.quickAmounts}>{[100, 200, 500].map(amount => <TouchableOpacity key={amount} style={styles.amountButton} onPress={() => addMoney(amount)}><Text style={styles.amountText}>+ ₹{amount}</Text></TouchableOpacity>)}</View><View style={styles.customAmountRow}><TextInput style={styles.amountInput} value={topUpAmount} onChangeText={setTopUpAmount} keyboardType="numeric" placeholder="Custom amount" placeholderTextColor="#91a197"/><TouchableOpacity style={styles.addButton} onPress={() => addMoney(topUpAmount)}><Text style={styles.addButtonText}>ADD</Text></TouchableOpacity></View></View>

    <View style={styles.sectionHeader}><Text style={styles.sectionKicker}>ACCOUNT TYPE</Text><Text style={styles.sectionHint}>Select how you collect orders</Text></View>
    <View style={styles.segment}><TouchableOpacity style={[styles.segmentOption, userType === 'student' && styles.segmentSelected]} onPress={() => setUserType('student')}><Text style={[styles.segmentTitle, userType === 'student' && styles.segmentTitleSelected]}>Student</Text><Text style={[styles.segmentSub, userType === 'student' && styles.segmentSubSelected]}>Standard pickup</Text></TouchableOpacity><TouchableOpacity style={[styles.segmentOption, userType === 'faculty' && styles.segmentSelected]} onPress={() => setUserType('faculty')}><Text style={[styles.segmentTitle, userType === 'faculty' && styles.segmentTitleSelected]}>Faculty</Text><Text style={[styles.segmentSub, userType === 'faculty' && styles.segmentSubSelected]}>Express collection</Text></TouchableOpacity></View>
    {userType === 'faculty' && <View style={styles.noteCard}><Text style={styles.noteTitle}>Faculty Express is on</Text><Text style={styles.noteText}>Your order is prioritized at the counter. Add a default room for staff delivery.</Text><TextInput style={styles.noteInput} value={facultyRoomNote} onChangeText={setFacultyRoomNote} placeholder="Department / staff room" placeholderTextColor="#91a197"/></View>}

    <View style={styles.detailsCard}><Text style={styles.cardTitle}>Personal details</Text><Text style={styles.cardCaption}>Only the counter details that matter.</Text><Field label="NAME" value={name} onChangeText={setName} placeholder="Your full name"/><Field label="ENROLLMENT NUMBER" value={rollNo} onChangeText={setRollNo} placeholder="e.g. 210101120042"/><Field label="PHONE" value={phone} onChangeText={setPhone} placeholder="+91 98765 43210" keyboardType="phone-pad" last/><TouchableOpacity style={styles.saveButton} onPress={save}><Text style={styles.saveButtonText}>SAVE CHANGES</Text></TouchableOpacity></View>
    <View style={styles.actionsCard}><TouchableOpacity style={styles.actionRow} onPress={changeSetup}><View><Text style={styles.actionTitle}>Campus and role</Text><Text style={styles.actionSub}>Change your setup</Text></View><Text style={styles.actionArrow}>›</Text></TouchableOpacity><View style={styles.divider}/><TouchableOpacity style={styles.actionRow} onPress={logout}><View><Text style={styles.logoutTitle}>Log out</Text><Text style={styles.actionSub}>Sign out of this device</Text></View><Text style={styles.logoutArrow}>›</Text></TouchableOpacity></View><View style={styles.bottomSpace}/>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f5f3ee'},content:{width:'100%',maxWidth:760,alignSelf:'center',padding:20,paddingTop:22,paddingBottom:160},topLine:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20},eyebrow:{color:'#718076',fontSize:10,fontWeight:'900',letterSpacing:1.5},title:{color:'#18211c',fontSize:30,fontWeight:'900',letterSpacing:-1,marginTop:3},status:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#e4eee7',borderRadius:20,paddingHorizontal:10,paddingVertical:7},statusDot:{width:6,height:6,borderRadius:3,backgroundColor:'#4c8a62'},statusText:{color:'#376048',fontSize:10,fontWeight:'900',letterSpacing:.7},
  identityCard:{flexDirection:'row',alignItems:'center',backgroundColor:'#fffdf9',borderWidth:1,borderColor:'#e5e0d7',borderRadius:20,padding:16,marginBottom:14},avatar:{width:54,height:54,borderRadius:18,backgroundColor:'#e8b85a',alignItems:'center',justifyContent:'center',marginRight:13},avatarText:{color:'#18211c',fontSize:24,fontWeight:'900'},identityCopy:{flex:1},name:{color:'#18211c',fontSize:17,fontWeight:'900'},campus:{color:'#68756c',fontSize:12,marginTop:2},memberId:{color:'#376048',fontSize:10,fontWeight:'800',marginTop:7},saveMini:{borderWidth:1,borderColor:'#d8e3db',borderRadius:9,paddingHorizontal:9,paddingVertical:7},saveMiniText:{color:'#376048',fontSize:9,fontWeight:'900',letterSpacing:.7},
  walletCard:{backgroundColor:'#18211c',borderRadius:24,padding:20,marginBottom:24,shadowColor:'#142019',shadowOffset:{width:0,height:10},shadowOpacity:.18,shadowRadius:16,elevation:7},walletHeader:{flexDirection:'row',justifyContent:'space-between'},walletLabel:{color:'#a9cbb3',fontSize:10,fontWeight:'900',letterSpacing:1.2},walletAmount:{color:'#fff',fontSize:38,fontWeight:'900',letterSpacing:-1.5,marginTop:2},walletMark:{width:38,height:38,borderRadius:19,backgroundColor:'#2c4535',alignItems:'center',justifyContent:'center'},walletMarkText:{color:'#e8b85a',fontSize:18,fontWeight:'900'},walletMessage:{color:'#b7c3ba',fontSize:12,marginTop:6},quickAmounts:{flexDirection:'row',gap:8,marginTop:18},amountButton:{flex:1,borderWidth:1,borderColor:'#3f6250',backgroundColor:'#24352b',borderRadius:12,paddingVertical:10,alignItems:'center'},amountText:{color:'#e5eee8',fontSize:12,fontWeight:'800'},customAmountRow:{flexDirection:'row',gap:8,marginTop:9},amountInput:{flex:1,backgroundColor:'#24352b',borderWidth:1,borderColor:'#3f6250',color:'#fff',borderRadius:12,paddingHorizontal:12,height:44,fontSize:13,fontWeight:'700'},addButton:{backgroundColor:'#e8b85a',borderRadius:12,justifyContent:'center',alignItems:'center',paddingHorizontal:18},addButtonText:{color:'#18211c',fontSize:11,fontWeight:'900',letterSpacing:.6},
  sectionHeader:{marginBottom:10},sectionKicker:{color:'#18211c',fontSize:12,fontWeight:'900',letterSpacing:.5},sectionHint:{color:'#7b847d',fontSize:12,marginTop:2},segment:{flexDirection:'row',padding:4,backgroundColor:'#e5e6df',borderRadius:16,marginBottom:14},segmentOption:{flex:1,paddingVertical:12,paddingHorizontal:13,borderRadius:12},segmentSelected:{backgroundColor:'#fffdf9',shadowColor:'#3d4a41',shadowOpacity:.08,shadowRadius:5,elevation:2},segmentTitle:{color:'#718076',fontSize:13,fontWeight:'900'},segmentTitleSelected:{color:'#18211c'},segmentSub:{color:'#94a097',fontSize:10,marginTop:2},segmentSubSelected:{color:'#4c8a62'},noteCard:{backgroundColor:'#e6f0e8',borderRadius:16,padding:15,marginBottom:16,borderWidth:1,borderColor:'#c8dbcd'},noteTitle:{color:'#244a32',fontSize:13,fontWeight:'900'},noteText:{color:'#53705d',fontSize:12,lineHeight:17,marginTop:4},noteInput:{backgroundColor:'#fffdf9',color:'#18211c',borderWidth:1,borderColor:'#c9dbcf',borderRadius:10,paddingHorizontal:11,height:42,marginTop:12,fontSize:13},
  detailsCard:{backgroundColor:'#fffdf9',borderRadius:20,padding:17,borderWidth:1,borderColor:'#e5e0d7',marginBottom:16},cardTitle:{color:'#18211c',fontSize:17,fontWeight:'900'},cardCaption:{color:'#758078',fontSize:12,marginTop:2,marginBottom:14},field:{borderBottomWidth:1,borderBottomColor:'#ece8df',paddingVertical:11},fieldLast:{borderBottomWidth:0},fieldLabel:{color:'#79847b',fontSize:10,fontWeight:'900',letterSpacing:.8,marginBottom:5},fieldInput:{color:'#18211c',fontSize:14,fontWeight:'700',padding:0,minHeight:22},saveButton:{backgroundColor:'#18211c',borderRadius:13,alignItems:'center',paddingVertical:14,marginTop:15},saveButtonText:{color:'#fff',fontSize:11,fontWeight:'900',letterSpacing:.8},
  actionsCard:{backgroundColor:'#fffdf9',borderWidth:1,borderColor:'#e5e0d7',borderRadius:18,overflow:'hidden'},actionRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:17,paddingVertical:15},actionTitle:{color:'#18211c',fontSize:14,fontWeight:'800'},logoutTitle:{color:'#bf4c42',fontSize:14,fontWeight:'800'},actionSub:{color:'#7b847d',fontSize:11,marginTop:2},actionArrow:{color:'#516258',fontSize:25,fontWeight:'300'},logoutArrow:{color:'#bf4c42',fontSize:25,fontWeight:'300'},divider:{height:1,backgroundColor:'#ece8df',marginLeft:17},bottomSpace:{height:20}
});
