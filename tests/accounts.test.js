const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, Timestamp } = require('./helpers/backendFixture.cjs');
const { createAccounts, normalizePhone, phoneKey } = require('../functions/accounts');
const user = uid => ({ uid, email: `${uid}@example.com`, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const profile = (phone = '9876543210') => ({ name: 'Campus User', phone, userType: 'student', universityId: 'sou' });
const register = (f, identity, details) => f.http(f.handlers.api, '/profile/register', details, identity);
test('phone normalization prevents spacing and country-prefix duplicates', () => {
  assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
  assert.equal(phoneKey('9876543210'), phoneKey('+91 (98765) 43210'));
  assert.throws(() => normalizePhone('abc9876543210'));
  assert.throws(() => normalizePhone('+1 9876543210'));
});
test('Google signup links a phone inside profile setup, marked unverified', async () => {
  const f = fixture();
  const result = await register(f, 'new-user', profile());
  assert.equal(result.code, 200);
  assert.equal(result.data.profile.email, 'new-user@example.com');
  assert.equal(result.data.profile.phoneVerified, false);
  assert.equal(result.data.profile.profileComplete, true);
  assert.equal(f.store.get(`phoneLinks/${phoneKey('9876543210')}`).uid, 'new-user');
});
test('another Google account cannot claim the same phone', async () => {
  const f = fixture();
  await register(f, 'first', profile());
  const result = await register(f, 'second', profile('+91 98765 43210'));
  assert.equal(result.code, 409);
  assert.equal(result.data.code, 'PHONE_ALREADY_LINKED');
  assert.match(result.data.message, /different number/);
  assert.equal(f.store.has('users/second'), false);
});
test('simultaneous registrations cannot claim a number twice', async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => register(f, `user-${i}`, profile())));
  assert.equal(results.filter(result => result.code === 200).length, 1);
  assert.equal(results.filter(result => result.data.code === 'PHONE_ALREADY_LINKED').length, 7);
});
test('same account can retry registration without creating another profile', async () => {
  const f = fixture();
  await register(f, 'first', profile());
  assert.equal((await register(f, 'first', profile())).code, 200);
  assert.equal([...f.store.keys()].filter(key => key.startsWith('phoneLinks/')).length, 1);
});
test('a rejected duplicate can retry with a different unused number', async () => {
  const f = fixture(); await register(f, 'first', profile());
  assert.equal((await register(f, 'second', profile())).code, 409);
  const result = await register(f, 'second', profile('8765432109'));
  assert.equal(result.code, 200); assert.equal(result.data.profile.phone, '8765432109');
});
test('linked email, phone and account type remain immutable', async () => {
  const f = fixture(); await register(f, 'first', profile());
  for (const [details, code] of [[{ ...profile(), email: 'other@example.com' }, 'EMAIL_IMMUTABLE'], [{ ...profile(), phone: '8765432109' }, 'PHONE_IMMUTABLE'], [{ ...profile(), userType: 'seller' }, 'ROLE_IMMUTABLE']]) {
    const result = await register(f, 'first', details); assert.equal(result.code, 409); assert.equal(result.data.code, code);
  }
});
test('blocked account retains its phone link and cannot reuse registration to clear bans', async () => {
  const f = fixture(); await register(f, 'first', profile());
  f.store.get('users/first').banStatus = 'perm_ban';
  assert.equal((await register(f, 'first', profile())).data.code, 'ACCOUNT_BLOCKED');
  assert.equal((await register(f, 'another-google-account', profile())).data.code, 'PHONE_ALREADY_LINKED');
  assert.equal(f.store.get(`phoneLinks/${phoneKey('9876543210')}`).uid, 'first');
});
test('unverified identities and forged client profiles are rejected', async () => {
  const f = fixture();
  assert.equal((await register(f, 'unverified', profile())).code, 403);
  assert.equal((await register(f, 'new', { ...profile(), userType: 'admin' })).code, 400);
  const result = await register(f, 'new', { ...profile(), banStatus: 'active', walletBalance: 50000, phoneVerified: true });
  assert.equal(result.data.profile.walletBalance, 0); assert.equal(result.data.profile.phoneVerified, false);
});
test('accounts with no completed profile cannot submit orders', async () => {
  const f = fixture();
  assert.equal((await f.http(f.handlers.orders, '/create', f.body(), 'new-user')).code, 409);
});
