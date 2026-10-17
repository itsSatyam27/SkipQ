import { auth, db, doc, getDoc } from './firebase';
export async function isSellerApproved() {
  const user = auth?.currentUser;
  if (!user || !db) return false;
  const approval = await getDoc(doc(db, 'sellerApprovals', user.uid));
  return approval.data()?.approved === true;
}
