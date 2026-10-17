const crypto = require('node:crypto');
const { accountError, blocked } = require('./accounts');
const hash = value => crypto.createHash('sha256').update(String(value || '')).digest('hex');
const matches = (value, stored) => typeof value === 'string' && value.length === 64 && typeof stored === 'string' && stored.length === 64
  && crypto.timingSafeEqual(Buffer.from(hash(value), 'hex'), Buffer.from(stored, 'hex'));
function createGoogleBridge({ db, auth, Timestamp, now = Date.now }) {
  async function start(ip) {
    const id = crypto.randomBytes(24).toString('hex');
    const browserKey = crypto.randomBytes(32).toString('hex');
    const pollKey = crypto.randomBytes(32).toString('hex');
    const rateRef = db.collection('loginRateLimits').doc(hash(String(ip || 'unknown')));
    await db.runTransaction(async tx => {
      const rate = (await tx.get(rateRef)).data() || {};
      const current = now();
      const count = current - (rate.windowAt?.toMillis?.() || 0) < 3600000 ? Number(rate.count || 0) : 0;
      if (count >= 100) accountError(429, 'LOGIN_RATE_LIMIT', 'Too many sign-in attempts. Please try again later.');
      tx.set(rateRef, { count: count + 1, windowAt: count ? rate.windowAt : Timestamp.fromMillis(current), expiresAt: Timestamp.fromMillis(current + 3600000) });
      tx.set(db.collection('mobileLogins').doc(id), { browserHash: hash(browserKey), pollHash: hash(pollKey), status: 'PENDING', expiresAt: Timestamp.fromMillis(current + 300000) });
    });
    return { loginId: id, browserKey, pollKey, expiresInSeconds: 300 };
  }
  function refFor(id) {
    if (!/^[a-f0-9]{48}$/.test(String(id || ''))) accountError(400, 'INVALID_LOGIN', 'Invalid sign-in session.');
    return db.collection('mobileLogins').doc(id);
  }
  function live(data) { if (!data || data.expiresAt.toMillis() <= now()) accountError(410, 'LOGIN_EXPIRED', 'This sign-in session expired. Start again in SkipQ.'); }
  async function finish(user, { loginId, browserKey }) {
    // Only a fresh Google sign-in can authorize the browser-to-app handoff.
    if (user.firebase?.sign_in_provider !== 'google.com' || user.email_verified !== true || !user.email
      || !Number.isFinite(user.auth_time) || now() / 1000 - user.auth_time > 300) accountError(403, 'GOOGLE_REQUIRED', 'Choose your Google account to continue.');
    const ref = refFor(loginId);
    const status = await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data(); live(data);
      if (!matches(browserKey, data.browserHash)) accountError(403, 'INVALID_LOGIN_KEY', 'Invalid sign-in session.');
      if (data.status !== 'PENDING') accountError(409, 'LOGIN_ALREADY_USED', 'This sign-in session is already complete.');
      const profile = (await tx.get(db.collection('users').doc(user.uid))).data();
      if (blocked(profile, now())) { tx.update(ref, { status: 'BLOCKED' }); return 'BLOCKED'; }
      tx.update(ref, { uid: user.uid, email: user.email.toLowerCase(), status: 'COMPLETE' });
      return 'COMPLETE';
    });
    if (status === 'BLOCKED') accountError(403, 'ACCOUNT_BLOCKED', 'This account is blocked from the platform.');
    return { success: true };
  }
  async function claim({ loginId, pollKey }) {
    const ref = refFor(loginId);
    const result = await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data(); live(data);
      if (!matches(pollKey, data.pollHash)) accountError(403, 'INVALID_LOGIN_KEY', 'Invalid sign-in session.');
      if (data.status === 'PENDING') return { pending: true };
      if (data.status === 'BLOCKED') accountError(403, 'ACCOUNT_BLOCKED', 'This account is blocked from the platform.');
      if (data.status !== 'COMPLETE') accountError(409, 'LOGIN_ALREADY_USED', 'This sign-in session was already used. Start again.');
      const profile = (await tx.get(db.collection('users').doc(data.uid))).data();
      if (blocked(profile, now())) accountError(403, 'ACCOUNT_BLOCKED', 'This account is blocked from the platform.');
      tx.update(ref, { status: 'CONSUMED' });
      return { uid: data.uid, email: data.email };
    });
    if (result.pending) return result;
    const user = await auth.getUser(result.uid);
    if (user.disabled || user.emailVerified !== true || user.email?.toLowerCase() !== result.email) accountError(403, 'ACCOUNT_UNAVAILABLE', 'This Google account cannot sign in.');
    return { customToken: await auth.createCustomToken(result.uid, { googleVerified: true }) };
  }
  return { start, finish, claim };
}
module.exports = { createGoogleBridge };
