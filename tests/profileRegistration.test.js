const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function harness(existing) {
  const calls = [];
  const context = { console, auth: { currentUser: { uid: 'buyer', email: 'buyer@example.com', emailVerified: true,
    getIdToken: async force => { calls.push(['token', force]); } } }, db: {}, isFirebaseConfigured: true,
    doc: (_db, collection, id) => `${collection}/${id}`, serverTimestamp: () => 'server-time',
    runTransaction: async (_db, work) => work({
      get: async ref => { calls.push(['read', ref]); return { exists: () => ref.startsWith('users/') && !!existing, data: () => existing }; },
      set: (ref, value) => { calls.push(['write', ref, value]); }
    }) };
  const source = fs.readFileSync('src/services/authService.js', 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, '');
  vm.createContext(context); vm.runInContext(source, context);
  return { calls, register: context.registerAccountProfile };
}
const profile = { name: 'Buyer', phone: '9876543210', userType: 'student' };
test('first signup refreshes credentials before atomic profile and phone writes', async () => {
  const h = harness(); await h.register(profile);
  assert.deepEqual(h.calls[0], ['token', true]);
  assert.deepEqual(h.calls.filter(c => c[0] === 'write').map(c => c[1]), ['users/buyer', 'phoneClaims/9876543210']);
});
test('same-account setup retry returns persisted profile without extra claim reads or writes', async () => {
  const h = harness({ ...profile, email: 'buyer@example.com', profileComplete: true, banStatus: 'active' });
  const saved = await h.register(profile);
  assert.equal(saved.uid, 'buyer');
  assert.deepEqual(h.calls.map(c => c[0]), ['token', 'read']);
});
test('retry cannot bypass a saved restriction or change immutable identity', async () => {
  const h = harness({ ...profile, email: 'buyer@example.com', profileComplete: true, banStatus: 'perm_ban' });
  await assert.rejects(h.register(profile), { code: 'ACCOUNT_BLOCKED' });
  const other = harness({ ...profile, email: 'buyer@example.com', profileComplete: true, banStatus: 'active' });
  await assert.rejects(other.register({ ...profile, phone: '8765432109' }), /cannot be changed/);
});
