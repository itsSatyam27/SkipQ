const { normalizePosition, gpsError } = require('./locationPolicy.cjs');

// Devices often emit an approximate fix before GPS converges. Keep listening
// within a bounded window instead of rejecting the first inaccurate result.
function acquireAccuratePosition(subscribe, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    let subscription, settled = false, lastError;
    const stop = () => { subscription?.remove(); subscription = null; };
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); stop();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(lastError || gpsError('LOCATION_TIMEOUT',
      'Could not get an accurate location yet. Enable precise location, move near a window or outdoors and retry.')), timeoutMs);
    const update = position => {
      if (settled) return;
      try { finish(null, normalizePosition(position)); } catch (error) { lastError = error; }
    };
    const failed = error => {
      if (settled) return;
      if (['PERMISSION_DENIED', 'SERVICES_DISABLED', 'INSECURE_ORIGIN'].includes(error.code)) finish(error);
      else lastError = error;
    };
    Promise.resolve().then(() => subscribe(update, failed)).then(value => {
      subscription = value;
      if (settled) stop();
    }, error => finish(error));
  });
}
module.exports = { acquireAccuratePosition };
