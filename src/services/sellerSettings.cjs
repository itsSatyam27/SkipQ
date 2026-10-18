const DEFAULT_WORKING_HOURS = [8 * 60, 20 * 60];
function parseWorkingHours(value) {
  const times = String(value || '').match(/\d{1,2}(?::\d{2})?\s*(?:AM|PM)/gi) || [];
  const parseTime = time => {
    const match = time.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*$/i);
    if (!match) return null;
    const hour = Number(match[1]), minute = Number(match[2] || 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    return (hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + minute;
  };
  if (times.length < 2) return [...DEFAULT_WORKING_HOURS];
  const start = parseTime(times[0]), end = parseTime(times[1]);
  return start == null || end == null ? [...DEFAULT_WORKING_HOURS] : [start, end];
}
function formatWorkingTime(value) {
  const minutes = ((Number(value) % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60), minute = minutes % 60;
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}
function formatWorkingHours(start, end) {
  return `${formatWorkingTime(start)} - ${formatWorkingTime(end)}`;
}

function validateSellerSettings(draft) {
  const clean = (key, max) => String(draft[key] || '').trim().slice(0, max);
  const name = clean('name', 100), stallName = clean('stallName', 100), location = clean('location', 150);
  const upiId = clean('upiId', 150), openingHours = clean('openingHours', 100);
  if (!name) throw new Error('Enter your full name in Account.');
  if (!stallName) throw new Error('Enter your canteen name.');
  if (!location) throw new Error('Enter the location of your canteen on campus.');
  if (upiId && !/^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$/.test(upiId)) throw new Error('Enter a valid merchant UPI ID, such as canteen@bank, or leave it empty.');
  return {
    profile: { name, stallName, stallLocation: location, merchantUpi: upiId },
    canteen: { name: stallName, location, upiId, openingHours, status: draft.isOpen ? 'Open' : 'Closed' }
  };
}
module.exports = { validateSellerSettings, parseWorkingHours, formatWorkingTime, formatWorkingHours };
