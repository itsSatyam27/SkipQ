const crypto = require('node:crypto');
const normalizeEmail = value => String(value || '').trim().toLowerCase();
function accountError(status, code, message) { const error = new Error(message); error.status = status; error.code = code; throw error; }
function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!/^[+\d\s()-]+$/.test(raw)) accountError(400, 'INVALID_PHONE', 'Enter a valid Indian mobile number.');
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) accountError(400, 'INVALID_PHONE', 'Enter a valid 10-digit Indian mobile number.');
  return digits;
}
const phoneKey = phone => crypto.createHash('sha256').update(`+91${normalizePhone(phone)}`).digest('hex');
const complete = profile => Boolean(profile?.universityStatus !== 'LEFT' && profile?.profileComplete && profile.name && profile.email && profile.phone && ['student', 'faculty', 'seller'].includes(profile.userType));
function blocked(profile, now) {
  return profile?.universityStatus === 'LEFT' || profile?.banStatus === 'perm_ban'
    || (profile?.banStatus === 'temp_ban' && (profile.banUntil?.toMillis?.() || 0) > now);
}
function createAccounts({ db, Timestamp, now = Date.now }) {
  const stamp = () => Timestamp.fromMillis(now());
  async function register(user, body) {
    if (user.email_verified !== true || !user.email) accountError(403, 'EMAIL_NOT_VERIFIED', 'Sign in with your verified Google account first.');
    const email = normalizeEmail(user.email);
    if (body.email !== undefined && normalizeEmail(body.email) !== email) accountError(409, 'EMAIL_IMMUTABLE', 'Your linked email cannot be changed.');
    const phone = normalizePhone(body.phone);
    const name = String(body.name || '').trim();
    if (!name || name.length > 100 || !['student', 'faculty', 'seller'].includes(body.userType)) accountError(400, 'INVALID_PROFILE', 'Enter your name and select Student, Faculty, or Seller.');
    const userRef = db.collection('users').doc(user.uid);
    const phoneRef = db.collection('phoneLinks').doc(phoneKey(phone));
    return db.runTransaction(async tx => {
      const previous = (await tx.get(userRef)).data();
      const linked = (await tx.get(phoneRef)).data();
      if (previous?.email && normalizeEmail(previous.email) !== email) accountError(409, 'EMAIL_IMMUTABLE', 'Your account email cannot be changed. Contact support for recovery.');
      if (previous?.phone && normalizePhone(previous.phone) !== phone) accountError(409, 'PHONE_IMMUTABLE', 'Your linked phone number cannot be changed.');
      if (previous?.userType && previous.userType !== body.userType) accountError(409, 'ROLE_IMMUTABLE', 'Your registered account type cannot be changed.');
      if (linked && linked.uid !== user.uid) accountError(409, 'PHONE_ALREADY_LINKED', 'This phone number is already linked to another account. Please use a different number.');
      if (blocked(previous, now())) accountError(403, 'ACCOUNT_BLOCKED', 'This account is blocked from the platform.');
      const editable = ['rollNo', 'facultyId', 'roomNumber', 'facultyRoomNote', 'universityId', 'stallName', 'stallLocation', 'merchantUpi'];
      const fields = Object.fromEntries(editable.filter(key => body[key] !== undefined).map(key => [key, String(body[key]).trim().slice(0, 300)]));
      const profile = { ...(previous || {}), ...fields, uid: user.uid, authUid: user.uid, name, email, phone,
        emailVerified: true, phoneVerified: previous?.phoneVerified === true, userType: body.userType,
        profileComplete: true, updatedAt: stamp(), createdAt: previous?.createdAt || stamp() };
      if (!previous) Object.assign(profile, { walletBalance: 0, banStatus: 'active', unclaimedOrderCount: 0 });
      tx.set(userRef, profile);
      if (!linked) tx.set(phoneRef, { uid: user.uid, createdAt: stamp() });
      return profile;
    });
  }
  async function requireComplete(user) {
    const profile = await db.runTransaction(async tx => (await tx.get(db.collection('users').doc(user.uid))).data());
    if (profile?.universityStatus === 'LEFT') accountError(403, 'LEFT_UNIVERSITY', 'This account is inactive because it has left the university.');
    if (!complete(profile)) accountError(409, 'PROFILE_REQUIRED', 'Complete your profile and link a phone number before using this feature.');
    if (normalizeEmail(profile.email) !== normalizeEmail(user.email)) accountError(403, 'EMAIL_MISMATCH', 'Sign in with the email linked to this account.');
    if (blocked(profile, now())) accountError(403, 'ACCOUNT_BLOCKED', 'This account is blocked from the platform.');
    return profile;
  }
  return { register, requireComplete };
}
module.exports = { createAccounts, normalizePhone, normalizeEmail, phoneKey, complete, blocked, accountError };
