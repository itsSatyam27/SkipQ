import React from 'react';
import { Text } from 'react-native';
import { useSellerTheme } from '../context/SellerTheme';

export default function DishRating({ value }) {
  const { light } = useSellerTheme();
  const label = value?.count
    ? `★ ${value.average.toFixed(1)} · ${value.count} ${value.count === 1 ? 'rating' : 'ratings'}`
    : 'Not rated yet';
  return <Text accessibilityLabel={label} style={{ fontSize: 12, marginTop: 6, color: light ? '#856000' : '#ffc447', fontWeight: '600' }}>{label}</Text>;
}
