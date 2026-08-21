import { Platform } from 'react-native';

// Cross-Tab / Cross-Window Realtime Event Bus using BroadcastChannel (Web)
// Allows seamless real-time syncing when opening Student view and POS view across multiple tabs

const CHANNEL_NAME = 'skipq_realtime_channel';

let channel = null;

if (Platform.OS === 'web' && typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    channel = null;
  }
}

/**
 * Broadcast an event to other open tabs/windows
 */
export const broadcastEvent = (type, payload = {}) => {
  if (Platform.OS !== 'web') return;

  const eventData = {
    type,
    payload,
    timestamp: Date.now()
  };

  if (channel) {
    try {
      channel.postMessage(eventData);
    } catch (e) {
      console.warn('BroadcastChannel postMessage failed:', e);
    }
  }

  // Fallback to localStorage trigger for web
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('skipq_sync_event', JSON.stringify(eventData));
    } catch (e) {}
  }
};

/**
 * Subscribe to realtime events across tabs
 */
export const subscribeToRealtimeEvents = (callback) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }

  // BroadcastChannel listener
  const handleBroadcast = (event) => {
    if (event.data && typeof callback === 'function') {
      callback(event.data);
    }
  };

  if (channel && typeof channel.addEventListener === 'function') {
    channel.addEventListener('message', handleBroadcast);
  }

  // Storage event listener fallback
  const handleStorage = (event) => {
    if (event.key === 'skipq_sync_event' && event.newValue) {
      try {
        const parsed = JSON.parse(event.newValue);
        if (typeof callback === 'function') {
          callback(parsed);
        }
      } catch (e) {}
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel && typeof channel.removeEventListener === 'function') {
      channel.removeEventListener('message', handleBroadcast);
    }
    if (typeof window.removeEventListener === 'function') {
      window.removeEventListener('storage', handleStorage);
    }
  };
};

export const SYNC_EVENTS = {
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  MENU_UPDATED: 'MENU_UPDATED',
  CANTEEN_UPDATED: 'CANTEEN_UPDATED'
};

