function selectOwnedCanteen(canteens, uid, universityId, selectedId, profileId) {
  if (!uid) return null;
  const owned = canteens.filter(shop => shop.ownerId === uid && shop.universityId === universityId);
  return owned.find(shop => shop.id === selectedId) || owned.find(shop => shop.id === profileId) || owned[0] || null;
}
module.exports = { selectOwnedCanteen };
