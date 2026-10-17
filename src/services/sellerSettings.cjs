function validateSellerSettings(draft) {
  const clean = (key, max) => String(draft[key] || '').trim().slice(0, max);
  const name = clean('name', 100), stallName = clean('stallName', 100), location = clean('location', 150);
  const upiId = clean('upiId', 150), openingHours = clean('openingHours', 100);
  if (!name) throw new Error('Enter your full name in Account.');
  if (!stallName) throw new Error('Enter your canteen name.');
  if (!location) throw new Error('Enter the location of your canteen on campus.');
  if (upiId && !/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$/.test(upiId)) throw new Error('Enter a valid UPI ID, such as canteen@bank, or leave it empty for cash only.');
  return {
    profile: { name, stallName, stallLocation: location, merchantUpi: upiId },
    canteen: { name: stallName, location, upiId, openingHours, status: draft.isOpen ? 'Open' : 'Closed' }
  };
}
module.exports = { validateSellerSettings };
