const config = require('./app.json').expo;
const fs = require('node:fs');
// Native Firebase config identifies the Android OAuth app; it is not a service account.
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
if (fs.existsSync(googleServicesFile)) config.android.googleServicesFile = googleServicesFile;
// Builds validate native Google configuration; web uses Firebase's Google popup.
if (process.env.EAS_BUILD === 'true') require('./scripts/check-release.cjs').checkRelease();
module.exports = config;
