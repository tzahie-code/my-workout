// Vercel build script — injects the real deployment timestamp into index.html.
// Runs once per deploy; the result is the file Vercel serves.
const fs = require('fs');

const now = new Date();
// Inject raw ISO string — the browser converts to the user's local timezone at runtime
const stamp = now.toISOString();

let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('__BUILD_DATE__')) {
  console.log('Warning: __BUILD_DATE__ placeholder not found in index.html');
  process.exit(0);
}
html = html.replace('__BUILD_DATE__', stamp);
fs.writeFileSync('index.html', html);
console.log('Build date injected:', stamp);
