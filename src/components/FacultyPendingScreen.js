import React, { useContext } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { AppContext } from '../context/AppContext';
import { useSellerStyles } from '../context/SellerTheme';

export default function FacultyPendingScreen() {
  const styles = useSellerStyles(baseStyles);
  const { userProfile, facultyReviewStatus } = useContext(AppContext);
  const rejected = facultyReviewStatus === 'REJECTED';
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>FACULTY VERIFICATION</Text>
    <Text style={styles.title}>Account under review</Text>
    <Text style={styles.subtitle}>We verify faculty accounts before enabling campus ordering.</Text>
    <View style={styles.card}>
      <View style={styles.icon}><Svg width={30} height={30} viewBox="0 0 24 24"><Circle cx={12} cy={12} r={9} fill="none" stroke="#ffb313" strokeWidth={1.6}/><Path d="M12 7v5l3 2" fill="none" stroke="#ffb313" strokeWidth={1.8} strokeLinecap="round"/></Svg></View>
      <Text style={[styles.badge,rejected&&styles.rejectedBadge]}>{rejected?'VERIFICATION DECLINED':'APPROVAL PENDING'}</Text>
      <Text style={styles.heading}>{rejected?'Contact campus administration':'Verification request received'}</Text>
      <Text style={styles.copy}>{rejected?'Your faculty details could not be verified. Ask the administrator to review your ID and approve the existing request.':'An administrator will confirm your university faculty or staff details. Ordering and faculty benefits unlock automatically after approval.'}</Text>
      <View style={styles.detail}>
        <Text style={styles.label}>NAME</Text><Text style={styles.value}>{userProfile.name || 'Not provided'}</Text>
        <Text style={styles.label}>FACULTY / STAFF ID</Text><Text style={styles.value}>{userProfile.facultyId || 'Not provided'}</Text>
        <Text style={styles.label}>DEPARTMENT / ROOM</Text><Text style={styles.value}>{userProfile.roomNumber || userProfile.facultyRoomNote || 'Not provided'}</Text>
      </View>
      <Text style={styles.hint}>{rejected?'Your profile remains saved while access is under review.':'Keep the app installed. This screen updates automatically when your request is reviewed.'}</Text>
    </View>
  </ScrollView>;
}

const baseStyles = StyleSheet.create({
  content:{flexGrow:1,padding:24,paddingTop:72,paddingBottom:48,width:'100%',maxWidth:560,alignSelf:'center',backgroundColor:'#090b0d'},
  eyebrow:{color:'#ffb313',fontSize:10,fontWeight:'800',letterSpacing:1.4},title:{color:'#f5f4f0',fontSize:30,fontWeight:'800',marginTop:10},
  subtitle:{color:'#9b9fa9',fontSize:14,lineHeight:21,marginTop:7,marginBottom:24},card:{backgroundColor:'#121417',borderRadius:24,borderWidth:1,borderColor:'#26292e',padding:24},
  icon:{width:58,height:58,borderRadius:18,backgroundColor:'#211a07',alignItems:'center',justifyContent:'center',marginBottom:20},badge:{color:'#ffb313',backgroundColor:'#211a07',fontSize:10,fontWeight:'800',letterSpacing:.7,padding:8,borderRadius:8,alignSelf:'flex-start'},
  rejectedBadge:{color:'#ff858b',backgroundColor:'#351518'},heading:{color:'#f5f4f0',fontSize:22,fontWeight:'800',marginTop:14},copy:{color:'#9b9fa9',fontSize:14,lineHeight:22,marginTop:10},detail:{backgroundColor:'#191c20',borderRadius:14,padding:16,marginVertical:20},
  label:{fontSize:10,color:'#9b9fa9',fontWeight:'700',letterSpacing:.7},value:{fontSize:14,fontWeight:'600',color:'#e5e6e8',marginTop:5,marginBottom:14},hint:{color:'#9b9fa9',fontSize:12,lineHeight:19}
});
