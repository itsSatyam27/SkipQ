const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const script = path.resolve('scripts/check-release.cjs');
const base = Object.fromEntries(['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID'].map(key => [`EXPO_PUBLIC_FIREBASE_${key}`, 'test-project']));
function run(extra = {}, args = []) {
  // Run outside the repo so no real .env or signing configuration is loaded.
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'skipq-release-'));
  const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('EXPO_PUBLIC_') && !key.startsWith('EAS_BUILD')));
  const isolatedScript = path.join(temp, 'check.cjs');
  fs.writeFileSync(isolatedScript, fs.readFileSync(script));
  try { return execFileSync(process.execPath, [isolatedScript, ...args], { cwd: temp, env: { ...clean, ...base, ...extra }, stdio: 'pipe' }).toString(); }
  finally {
    assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
test('Spark web release needs no Cloud Functions endpoints or hosted login bridge', () => assert.match(run(), /passed/));
test('Android release stops before missing OAuth and signing configuration can ship', () => assert.throws(() => run({}, ['--android']), /Command failed/));
