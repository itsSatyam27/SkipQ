const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/backendFixture.cjs');
async function start(f) { return (await f.http(f.handlers.api, '/auth/start-mobile-login', {})).data; }
const finish = (f, session, token = 'buyer') => f.http(f.handlers.api, '/auth/complete-mobile-login', session, token);
const claim = (f, session) => f.http(f.handlers.api, '/auth/claim-mobile-login', session, null);
test('mobile Google handoff uses distinct browser and app secrets', async () => {
  const f = fixture(); const session = await start(f);
  assert.notEqual(session.browserKey, session.pollKey);
  assert.equal((await claim(f, session)).data.pending, true);
  assert.equal((await finish(f, session)).code, 200);
  assert.match((await claim(f, session)).data.customToken, /verified-buyer/);
  assert.equal((await claim(f, session)).code, 409);
});
test('knowing a session ID or the browser key is insufficient to claim its token', async () => {
  const f = fixture(); const session = await start(f);
  assert.equal((await finish(f, { ...session, browserKey: '0'.repeat(64) })).code, 403);
  await finish(f, session);
  assert.equal((await claim(f, { ...session, pollKey: session.browserKey })).code, 403);
  assert.equal((await claim(f, session)).code, 200);
});
test('concurrent app claims return at most one sign-in token', async () => {
  const f = fixture(); const session = await start(f); await finish(f, session);
  const results = await Promise.all(Array.from({ length: 4 }, () => claim(f, session)));
  assert.equal(results.filter(result => result.code === 200).length, 1);
});
test('expired mobile sessions fail without issuing credentials', async () => {
  const f = fixture(); const session = await start(f); f.advance(300001);
  assert.equal((await finish(f, session)).code, 410);
  assert.equal((await claim(f, session)).code, 410);
});
test('blocked account cannot finish or claim a mobile login', async () => {
  const f = fixture(); const session = await start(f); f.store.get('users/buyer').banStatus = 'perm_ban';
  assert.equal((await finish(f, session)).data.code, 'ACCOUNT_BLOCKED');
  assert.equal((await claim(f, session)).data.code, 'ACCOUNT_BLOCKED');
});
test('mobile login cannot be completed by an unauthenticated caller', async () => {
  const f = fixture(); const session = await start(f);
  assert.equal((await finish(f, session, null)).code, 401);
  assert.equal((await finish(f, session, 'unverified')).code, 403);
});
