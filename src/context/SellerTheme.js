import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
const SellerTheme = createContext({ light: false, toggle: () => {} });
export function SellerThemeProvider({ children }) {
  const [light, setLight] = useState(false);
  const touched = useRef(false);
  useEffect(() => { let mounted = true; AsyncStorage.getItem('@skipq_seller_theme').then(value => { if (mounted && !touched.current) setLight(value === 'light'); }).catch(() => {}); return () => { mounted = false; }; }, []);
  const toggle = () => { touched.current = true; setLight(previous => { const next = !previous; AsyncStorage.setItem('@skipq_seller_theme', next ? 'light' : 'dark').catch(() => {}); return next; }); };
  return <SellerTheme.Provider value={{ light, toggle }}>{children}</SellerTheme.Provider>;
}
export const useSellerTheme = () => useContext(SellerTheme);
const surfaces = { '#090b0d': '#f6f7f9', '#121417': '#ffffff', '#17191d': '#ffffff', '#191c20': '#f1f3f6', '#202329': '#e7eaf0', '#26292e': '#dce0e7', '#22252a': '#dce0e7', '#41464f': '#bac1cc', '#211a07': '#fff6da', '#292418': '#fff1c7', '#3a2c07': '#ecd490', '#15231c': '#e6f6ec', '#13291b': '#e6f6ec', '#27171c': '#ffebef' };
const text = { '#f5f4f0': '#172333', '#e5e6e8': '#243143', '#a5a9b2': '#596579', '#b6bac2': '#4c596d', '#9b9fa9': '#596579', '#8495a8': '#657187', '#8293a7': '#657187', '#8d9bad': '#657187', '#f5cf76': '#775515', '#ffb313': '#9b6500', '#47db85': '#18824b' };
export function useSellerStyles(base) {
  const { light } = useSellerTheme();
  return useMemo(() => {
    if (!light) return base;
    return Object.fromEntries(Object.entries(base).map(([name, original]) => {
      const style = { ...StyleSheet.flatten(original) };
      for (const key of Object.keys(style)) if (typeof style[key] === 'string') style[key] = (key === 'color' ? text : surfaces)[style[key]] || style[key];
      return [name, style];
    }));
  }, [base, light]);
}
