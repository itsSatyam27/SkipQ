import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { Platform, AppState } from 'react-native';
import { requestDevicePosition, watchDevicePosition, openDeviceLocationSettings } from '../services/locationService';
import { isUsableLocation } from '../services/locationPolicy.cjs';

export default function useDeviceLocation(enabled) {
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setStatus] = useState('idle');
  const [locationError, setError] = useState(null);
  const current = useRef(null);
  const watcher = useRef(null);
  const pending = useRef(null);
  const generation = useRef(0);
  const update = location => { current.current = location; setUserLocation(location); setStatus('ready'); setError(null); };
  const fail = error => { current.current = null; setUserLocation(null); setError({ code: error.code || 'LOCATION_UNAVAILABLE', message: error.message || 'Could not find your location. Retry GPS.', needsSettings: error.needsSettings }); setStatus('error'); };
  const requestUserLocation = () => {
    if (pending.current) return pending.current;
    const version = generation.current;
    setStatus('locating'); setError(null);
    const job = (async () => {
      try {
        const location = await requestDevicePosition();
        if (version !== generation.current) return null;
        update(location);
        watcher.current?.remove(); watcher.current = null;
        try {
          const next = await watchDevicePosition(value => { if (version === generation.current) update(value); }, error => { if (version === generation.current) fail(error); });
          if (version === generation.current) watcher.current = next; else next.remove();
        } catch { /* Current fix remains usable; the next checkout refreshes stale GPS. */ }
        return location;
      } catch (error) { if (version === generation.current) fail(error); throw error; }
    })();
    pending.current = job;
    job.finally(() => { if (pending.current === job) pending.current = null; }).catch(() => {});
    return job;
  };
  const resetLocation = () => {
    generation.current++; watcher.current?.remove(); watcher.current = null; pending.current = null;
    current.current = null; setUserLocation(null); setStatus('idle'); setError(null);
  };
  useEffect(() => () => { generation.current++; watcher.current?.remove(); pending.current = null; }, []);
  useEffect(() => {
    // Restore only an existing grant. The first permission prompt is user-triggered.
    if (!enabled) return;
    let alive = true;
    const restore = async () => {
      try {
        const granted = Platform.OS === 'web'
          ? (await navigator.permissions?.query({ name: 'geolocation' }))?.state === 'granted'
          : (await Location.getForegroundPermissionsAsync()).status === 'granted';
        if (alive && granted && !isUsableLocation(current.current)) await requestUserLocation();
      } catch { /* Retry remains available on Explore and Cart. */ }
    };
    restore();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') restore(); });
    return () => { alive = false; listener.remove(); generation.current++; watcher.current?.remove(); watcher.current = null; pending.current = null; };
  }, [enabled]);
  return { userLocation, locationStatus, locationError, requestUserLocation, resetLocation,
    getLocation: () => current.current, locationPermissionGranted: locationStatus === 'ready',
    openLocationSettings: () => openDeviceLocationSettings(locationError?.code) };
}
