const fs = require('node:fs');
const path = require('node:path');
if (fs.existsSync('.env')) process.loadEnvFile('.env');
const config = {};
for (const [key, name] of Object.entries({apiKey:'API_KEY',authDomain:'AUTH_DOMAIN',projectId:'PROJECT_ID',storageBucket:'STORAGE_BUCKET',messagingSenderId:'MESSAGING_SENDER_ID',appId:'APP_ID'})) {
  config[key] = process.env[`EXPO_PUBLIC_FIREBASE_${name}`];
  if (!config[key]) throw new Error(`Missing Firebase public config: ${name}`);
}
fs.mkdirSync('admin/dist', {recursive:true});
for (const file of ['index.html','style.css','app.js']) fs.copyFileSync(path.join('admin',file),path.join('admin/dist',file));
fs.writeFileSync('admin/dist/config.js', `window.SKIPQ_FIREBASE_CONFIG = ${JSON.stringify(config)};\n`);
console.log('Admin website built in admin/dist (public Firebase config only).');
