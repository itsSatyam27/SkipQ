import { useEffect, useState } from 'react';
import { db, doc, onSnapshot } from '../services/firebase';
export default function useLocationTestAccess(uid) {
  const [grant, setGrant] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setGrant(null);
    if (!__DEV__ || !uid || !db) return;
    const unsubscribe = onSnapshot(doc(db, 'locationTestAccess', uid), snap => {
      setGrant(snap.exists() ? { ...snap.data(), uid } : null); setNow(Date.now());
    }, () => setGrant(null));
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [uid]);
  return Boolean(__DEV__ && grant?.uid === uid && grant?.enabled === true && grant.expiresAt?.toMillis?.() > now);
}
