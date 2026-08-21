// SkipQ Mobile Initial Data with GPS Coordinates
export const DEFAULT_UNIVERSITIES = [
  { id: 'iitb', name: 'IIT Bombay (Powai Campus)', city: 'Mumbai', lat: 19.1334, lng: 72.9133 },
  { id: 'du_north', name: 'DU North Campus (Delhi Uni)', city: 'New Delhi', lat: 28.6890, lng: 77.2104 },
  { id: 'bits_pilani', name: 'BITS Pilani (Main Campus)', city: 'Pilani', lat: 28.3639, lng: 75.5870 },
  { id: 'vit_vellore', name: 'VIT Vellore (Vellore Campus)', city: 'Vellore', lat: 12.9692, lng: 79.1559 },
  { id: 'manipal', name: 'Manipal University (MAHE)', city: 'Manipal', lat: 13.3525, lng: 74.7928 }
];

export const INITIAL_CANTEENS = [
  {
    id: 'shop-101',
    universityId: 'iitb',
    name: 'Sharma Ji Canteen',
    location: 'Hostel 4 Ground Floor',
    lat: 19.1336,
    lng: 72.9135, // ~30m from campus center
    rating: 4.8,
    reviewsCount: 320,
    openingHours: '08:00 AM - 11:30 PM',
    status: 'Open',
    currentQueue: 3,
    avgWaitMins: 6,
    upiId: 'sharmaji.canteen@upi',
    phone: '+91 98765 43210',
    banner: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
    tags: ['Fast Food', 'North Indian', 'Quick Snacks'],
    menu: [
      { id: 'item-1', name: 'Samosa with Chutney (2 pcs)', category: 'Snacks', price: 20, prepTime: '2 mins', isAvailable: true, description: 'Crispy golden samosas served with tangy mint chutneys.' },
      { id: 'item-2', name: 'Cold Coffee with Ice Cream', category: 'Beverages', price: 60, prepTime: '4 mins', isAvailable: true, description: 'Chilled thick coffee topped with vanilla ice cream.' },
      { id: 'item-3', name: 'Cheese Butter Maggi', category: 'Snacks', price: 50, prepTime: '6 mins', isAvailable: true, description: 'Classic noodles cooked with butter and cheese.' },
      { id: 'item-4', name: 'Masala Chai', category: 'Beverages', price: 15, prepTime: '2 mins', isAvailable: true, description: 'Steaming hot ginger spiced milk tea.' }
    ]
  },
  {
    id: 'shop-102',
    universityId: 'iitb',
    name: 'Nescafe Kiosk',
    location: 'Main Academic Building Plaza',
    lat: 19.1352,
    lng: 72.9150, // ~220m from campus center
    rating: 4.7,
    reviewsCount: 510,
    openingHours: '07:30 AM - 10:00 PM',
    status: 'Open',
    currentQueue: 1,
    avgWaitMins: 3,
    upiId: 'nescafe.iitb@upi',
    phone: '+91 98765 12345',
    banner: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80',
    tags: ['Coffee', 'Sandwiches', 'Shakes'],
    menu: [
      { id: 'item-2', name: 'Cold Coffee with Ice Cream', category: 'Beverages', price: 55, prepTime: '3 mins', isAvailable: true, description: 'Signature Nescafe chilled coffee blend.' },
      { id: 'item-5', name: 'Veg Grilled Sandwich', category: 'Sandwiches', price: 65, prepTime: '5 mins', isAvailable: true, description: 'Triple layer toastie with bell peppers.' },
      { id: 'item-6', name: 'Chocolate Muffin', category: 'Snacks', price: 40, prepTime: '1 min', isAvailable: true, description: 'Freshly baked cocoa muffin.' }
    ]
  },
  {
    id: 'shop-103',
    universityId: 'iitb',
    name: 'Kathi Roll Express',
    location: 'Gymkhana Far Gate (Outer Block)',
    lat: 19.1380,
    lng: 72.9190, // ~650m from campus center (Out of 300m range for testing rule!)
    rating: 4.6,
    reviewsCount: 215,
    openingHours: '11:00 AM - 01:00 AM',
    status: 'Open',
    currentQueue: 5,
    avgWaitMins: 10,
    upiId: 'kathiroll.express@upi',
    phone: '+91 99887 76655',
    banner: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=600&q=80',
    tags: ['Rolls', 'Wraps', 'Quick Meal'],
    menu: [
      { id: 'item-7', name: 'Paneer Butter Tikka Roll', category: 'Rolls', price: 90, prepTime: '8 mins', isAvailable: true, description: 'Char-grilled cottage cheese wrapped in flaky paratha.' },
      { id: 'item-8', name: 'Double Egg Cheese Roll', category: 'Rolls', price: 80, prepTime: '7 mins', isAvailable: true, description: 'Fluffy two-egg paratha roll with cheddar.' }
    ]
  }
];

export const SAMPLE_ORDERS = [
  {
    id: 'SQ-1042',
    tokenNumber: 'SQ-42',
    shopId: 'shop-101',
    shopName: 'Sharma Ji Canteen',
    buyerName: 'Priya Sharma',
    items: [
      { name: 'Cold Coffee with Ice Cream', price: 60, qty: 1 },
      { name: 'Samosa with Chutney (2 pcs)', price: 20, qty: 2 }
    ],
    totalAmount: 100,
    paymentMethod: 'PhonePe',
    paymentStatus: 'PAID',
    orderStatus: 'Preparing',
    heldDepositAmount: 0,
    timestamp: new Date(Date.now() - 5 * 60000).toISOString()
  }
];
