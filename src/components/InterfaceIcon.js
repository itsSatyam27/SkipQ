import React from 'react';
import Svg, { Path } from 'react-native-svg';
const paths = {
  cart: 'M3 3h2l2.4 12h11.9L22 7H6M9 20h.01M18 20h.01',
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  moon: 'M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z',
  cash: 'M3 6h18v12H3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM6 9h.01M18 15h.01',
  phone: 'M7 2h10v20H7ZM11 18h2',
  lock: 'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  support: 'M4 13v-2a8 8 0 0 1 16 0v2M4 12H2v7h4v-7ZM20 12h2v7h-4v-7Z',
  logout: 'M10 3H4v18h6m4-5 4-4-4-4m-5 4h13',
  chevron: 'm9 5 7 7-7 7',
  shop: 'M3 10h18L19 3H5ZM5 10v11h14V10M9 21v-7h6v7M3 7h18',

  scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7h3v3H7Zm7 0h3v3h-3ZM7 14h3v3H7Zm7 0h3m-3 3h3v-3',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-7Z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  orders: 'M9 4H5v17h14V4h-4M9 2h6v5H9ZM8 11h8m-8 4h6',
  menu: 'M4 3h16v18H4ZM8 7h8m-8 5h8m-8 5h5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4 10-10',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  edit: 'm4 16 12-12 4 4L8 20H4ZM14 6l4 4',
  user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  location: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};
export default function InterfaceIcon({ name = 'menu', size = 22, color = '#64748b' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><Path d={paths[name] || paths.menu} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
