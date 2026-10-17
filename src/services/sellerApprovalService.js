import { auth, db, doc, setDoc, getDoc, serverTimestamp } from './firebase';

export async function requestSellerApproval({ stallName, location, upiId, universityId }) {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Sign in with Google and complete your profile before requesting seller access.');
  const ref = doc(db, 'sellerRequests', user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();
  const request = {
    userId: user.uid,
    status: 'PENDING',
    stallName: String(stallName || '').trim(),
    location: String(location || '').trim(),
    upiId: String(upiId || '').trim(),
    universityId: universityId || 'sou',
    submittedAt: serverTimestamp()
  };
  await setDoc(ref, request);
  return request;
}
