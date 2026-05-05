// Vercel build script — injects the real deployment timestamp into index.html.
// Runs once per deploy; the result is the file Vercel serves.
const fs = require('fs');

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const stamp =
  'v' + now.getUTCFullYear() + '.' +
  pad(now.getUTCMonth() + 1) + '.' +
  pad(now.getUTCDate()) +
  ' ' + pad(now.getUTCHours()) + ':' +
  pad(now.getUTCMinutes()) + ' UTC';

let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('__BUILD_DATE__')) {
  console.log('Warning: __BUILD_DATE__ placeholder not found in index.html');
  process.exit(0);
}
html = html.replace('__BUILD_DATE__', stamp);
fs.writeFileSync('index.html', html);
console.log('Build date injected:', stamp);
