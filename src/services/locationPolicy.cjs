const MAX_LOCATION_AGE_MS = 120000;
function gpsError(code, message, needsSettings = false) {
  const error = new Error(message); error.code = code; error.needsSettings = needsSettings; return error;
}
function isUsableLocation(value, now = Date.now()) {
  return Boolean(value && [value.lat, value.lng, value.accuracy, value.timestamp].every(Number.isFinite)
    && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180 && value.accuracy >= 0 && value.accuracy <= 100
    && value.timestamp <= now + 10000 && now - value.timestamp <= MAX_LOCATION_AGE_MS);
}
function normalizePosition(position, now = Date.now()) {
  const value = { lat: position?.coords?.latitude, lng: position?.coords?.longitude,
    accuracy: position?.coords?.accuracy, timestamp: position?.timestamp };
  if (![value.lat, value.lng, value.accuracy, value.timestamp].every(Number.isFinite) || Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180 || value.accuracy < 0)
    throw gpsError('INVALID_LOCATION', 'Your device returned an invalid location. Please try again.');
  if (value.accuracy > 100) throw gpsError('LOW_ACCURACY', `Location accuracy is about ${Math.round(value.accuracy)}m. Enable precise location and try near a window or outdoors.`, true);
  if (!isUsableLocation(value, now)) throw gpsError('STALE_LOCATION', 'Your location is out of date. Refresh GPS before ordering.');
  return value;
}
module.exports = { MAX_LOCATION_AGE_MS, gpsError, isUsableLocation, normalizePosition };
