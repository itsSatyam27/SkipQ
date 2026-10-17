// One idempotent registration canteen per seller; all writes still use client rules.
async function ensureRegisteredCanteen({ db, api, uid, campus }) {
  const { collection, doc, query, where, getDocs, runTransaction, serverTimestamp } = api;
  const existing = await getDocs(query(collection(db, 'canteens'), where('ownerId', '==', uid), where('universityId', '==', campus.id)));
  return runTransaction(db, async tx => {
    const profileRef = doc(db, 'users', uid);
    const profileSnap = await tx.get(profileRef);
    const approval = await tx.get(doc(db, 'sellerApprovals', uid));
    const request = await tx.get(doc(db, 'sellerRequests', uid));
    const profile = profileSnap.data();
    if (!profile || profile.userType !== 'seller' || profile.universityId !== campus.id || approval.data()?.approved !== true) throw new Error('Approved seller registration is required.');
    const id = profile.sellerShopId || existing.docs[0]?.id || `registration_${uid}`;
    const shopRef = doc(db, 'canteens', id);
    const shopSnap = await tx.get(shopRef);
    if (shopSnap.exists()) {
      const shop = shopSnap.data();
      if (shop.ownerId !== uid || shop.universityId !== campus.id) throw new Error('The linked canteen belongs to another account or campus.');
      if (profile.sellerShopId !== id) tx.update(profileRef, { sellerShopId: id, updatedAt: serverTimestamp() });
      return { ...shop, id };
    }
    const details = request.data() || {};
    const name = String(details.stallName || profile.stallName || '').trim();
    if (!name) throw new Error('Canteen registration details are missing. Complete canteen setup.');
    const shop = { id, ownerId: uid, universityId: campus.id, name,
      location: details.location || profile.stallLocation || 'Campus food court',
      upiId: details.upiId || profile.merchantUpi || '', phone: profile.phone || '',
      lat: campus.lat, lng: campus.lng, status: 'Open', menu: [], currentQueue: 0, avgWaitMins: 5,
      tags: ['Campus Canteen'], createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    tx.set(shopRef, shop);
    tx.update(profileRef, { sellerShopId: id, updatedAt: serverTimestamp() });
    return shop;
  });
}
module.exports = { ensureRegisteredCanteen };
