const fs = require('node:fs');
const path = require('node:path');
function checkRelease() {
  if (fs.existsSync(path.join(__dirname, '..', '.env'))) process.loadEnvFile(path.join(__dirname, '..', '.env'));
  const issues = [];
  const required = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_STORAGE_BUCKET', 'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_APP_ID'];
  for (const name of required) {
    const key = `EXPO_PUBLIC_${name}`;
    const value = process.env[key];
    if (!value || /YOUR_|your_|placeholder/i.test(value)) issues.push(`${key} is missing or contains a placeholder.`);
  }
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('EXPO_PUBLIC_') && /FAST2SMS|SECRET|PRIVATE_KEY|SERVICE_ACCOUNT/i.test(key)) issues.push(`${key} must not be included in the client environment.`);
  }
  if (process.env.EAS_BUILD_PLATFORM === 'android' || process.argv.includes('--android')) {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
    if (!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(webClientId)) issues.push('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be the Web OAuth client ID for Android Google sign-in.');
    const filename = process.env.GOOGLE_SERVICES_JSON || path.join(__dirname, '..', 'google-services.json');
    try {
      const native = JSON.parse(fs.readFileSync(filename, 'utf8'));
      if (native.project_info?.project_id !== process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID) issues.push('google-services.json must belong to the configured Firebase project.');
      const client = native.client?.find(c => c.client_info?.android_client_info?.package_name === 'com.skipq.app');
      if (!client) issues.push('google-services.json must include Android package com.skipq.app.');
      if (!client?.oauth_client?.some(c => c.client_type === 3 && c.client_id === webClientId)) issues.push('The Web OAuth client ID must match google-services.json; download it again after enabling Google sign-in.');
      if (!client?.oauth_client?.some(c => c.client_type === 1 && c.android_info?.certificate_hash)) issues.push('Register the Android signing SHA-1 in Firebase and download google-services.json again before the final build.');
    } catch { issues.push('Add Firebase Android google-services.json, or set GOOGLE_SERVICES_JSON to its file path.'); }
  }
  if (issues.length) throw new Error(`Release configuration needs attention:\n${issues.map(issue => `- ${issue}`).join('\n')}`);
  return true;
}
if (require.main === module) {
  try { checkRelease(); console.log('Release configuration passed.'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { checkRelease };
