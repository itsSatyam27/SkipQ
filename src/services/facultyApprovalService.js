import { auth, db, doc, getDoc, setDoc, serverTimestamp } from './firebase';

export async function requestFacultyApproval({ name, facultyId, roomNumber, universityId }) {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Sign in and complete your faculty profile before requesting access.');
  const ref = doc(db, 'facultyRequests', user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();
  const request = {
    userId: user.uid,
    status: 'PENDING',
    name: String(name || '').trim(),
    email: String(user.email || '').trim().toLowerCase(),
    facultyId: String(facultyId || '').trim(),
    roomNumber: String(roomNumber || '').trim(),
    universityId: universityId || 'sou',
    submittedAt: serverTimestamp()
  };
  await setDoc(ref, request);
  return request;
}

export async function isFacultyApproved(profile) {
  if (profile?.userType !== 'faculty') return true;
  // Profiles created before faculty verification was introduced remain active.
  if (profile.facultyApprovalStatus === undefined) return true;
  const user = auth?.currentUser;
  if (!user || !db) return false;
  const approval = await getDoc(doc(db, 'facultyApprovals', user.uid));
  return approval.data()?.approved === true;
}
