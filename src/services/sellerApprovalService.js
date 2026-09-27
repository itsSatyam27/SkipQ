import { auth, db, doc, setDoc, serverTimestamp } from './firebase';

export async function requestSellerApproval({ stallName, location, upiId, universityId }) {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Verify your phone number before requesting seller access.');
  const request = {
    userId: user.uid,
    status: 'PENDING',
    stallName: String(stallName || '').trim(),
    location: String(location || '').trim(),
    upiId: String(upiId || '').trim(),
    universityId: universityId || 'sou',
    submittedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'sellerRequests', user.uid), request);
  return request;
}
