const fs = require('node:fs');
const path = require('node:path');

const icon = path.join(__dirname, '..', 'assets', 'icon.png');
const websiteIcon = path.join(__dirname, '..', 'website', 'icon.png');
fs.copyFileSync(icon, websiteIcon);
console.log('Website icon ready from assets/icon.png.');
