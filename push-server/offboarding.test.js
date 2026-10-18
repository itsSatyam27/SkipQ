import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from './server.js';

const require = createRequire(import.meta.url);
const { fixture } = require('../tests/helpers/backendFixture.cjs');

async function startServer(t, f) {
  const server = createServer({ db: f.db, auth: f.auth, messaging: { send: async () => 'sent' } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test('Render offboarding endpoint authenticates admin and applies offboarding', async t => {
  const f = fixture();
  const baseUrl = await startServer(t, f);
  const response = await fetch(`${baseUrl}/admin/offboard-user`, {
    method: 'POST',
    headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'buyer', reason: 'Left the university' })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(f.store.get('users/buyer').universityStatus, 'LEFT');
  assert.equal(f.users.get('buyer').disabled, true);
});

test('Render offboarding endpoint rejects missing or unauthorized credentials', async t => {
  const f = fixture();
  const baseUrl = await startServer(t, f);
  const missing = await fetch(`${baseUrl}/admin/offboard-user`, { method: 'POST' });
  assert.equal(missing.status, 401);
  const nonAdmin = await fetch(`${baseUrl}/admin/offboard-user`, {
    method: 'POST',
    headers: { Authorization: 'Bearer buyer', 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'seller', reason: 'Left the university', sellerAction: 'close' })
  });
  assert.equal(nonAdmin.status, 403);
  assert.equal(f.store.get('users/seller').universityStatus, undefined);
});
