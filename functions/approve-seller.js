// Run only from a trusted administrator workstation using Application Default Credentials.
const admin = require('firebase-admin');
async function main() {
  const [projectId, uid] = process.argv.slice(2);
  if (!projectId || !uid || !/^[A-Za-z0-9_-]+$/.test(uid)) throw new Error('Usage: npm run approve-seller -- PROJECT_ID USER_UID');
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
  const request = await admin.firestore().collection('sellerRequests').doc(uid).get();
  if (!request.exists || request.data().status !== 'PENDING') throw new Error('A pending seller application is required.');
  const user = await admin.auth().getUser(uid);
  const profile = await admin.firestore().collection('users').doc(uid).get();
  if (user.disabled || !user.emailVerified || !profile.data()?.profileComplete || profile.data()?.userType !== 'seller') throw new Error('The seller needs a verified Google account and completed seller profile.');
  if (profile.data().banStatus && profile.data().banStatus !== 'active') throw new Error('A blocked seller cannot be approved.');
  const batch = admin.firestore().batch();
  batch.set(admin.firestore().collection('sellerApprovals').doc(uid), { approved: true, approvedAt: admin.firestore.FieldValue.serverTimestamp() });
  batch.update(request.ref, { status: 'APPROVED', approvedAt: admin.firestore.FieldValue.serverTimestamp() });
  await batch.commit();
  console.log('Seller approved. Ask them to sign out and sign in again, then complete seller setup.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
