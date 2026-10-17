import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
export default function WalletTopUpModal({ visible, onClose }) {
  return <Modal visible={visible} transparent onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <View style={{ backgroundColor: 'white', padding: 24, borderRadius: 16 }}>
        <Text>Wallet top-ups are unavailable. Pay your canteen with cash or UPI.</Text>
        <TouchableOpacity onPress={onClose} style={{ padding: 16 }}><Text>Close</Text></TouchableOpacity>
      </View>
    </View>
  </Modal>;
}
