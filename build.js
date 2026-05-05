// Vercel build script — runs once per deploy.
// 1. Injects the real deployment timestamp into index.html  (__BUILD_DATE__)
// 2. Injects a unique cache-busting version into sw.js      (__CACHE_VER__)
//    so the service worker updates on every deploy and never serves stale content.
const fs = require('fs');

const now = new Date();
const pad = n => String(n).padStart(2, '0');

// ISO string for index.html — browser converts to local timezone at runtime
const buildDate = now.toISOString();

// Short version string for sw.js cache key, e.g. "mw-20260505-1432"
const cacheVer = 'mw-' +
  now.getUTCFullYear() +
  pad(now.getUTCMonth() + 1) +
  pad(now.getUTCDate()) + '-' +
  pad(now.getUTCHours()) +
  pad(now.getUTCMinutes());

// ── Patch index.html ──────────────────────────────────────────────────────────
let html = fs.readFileSync('index.html', 'utf8');
if (!html.includes('__BUILD_DATE__')) {
  console.warn('Warning: __BUILD_DATE__ placeholder not found in index.html');
} else {
  html = html.replace('__BUILD_DATE__', buildDate);
  fs.writeFileSync('index.html', html);
  console.log('index.html  → build date:', buildDate);
}

// ── Patch sw.js ───────────────────────────────────────────────────────────────
let sw = fs.readFileSync('sw.js', 'utf8');
if (!sw.includes('__CACHE_VER__')) {
  console.warn('Warning: __CACHE_VER__ placeholder not found in sw.js');
} else {
  sw = sw.replace('__CACHE_VER__', cacheVer);
  fs.writeFileSync('sw.js', sw);
  console.log('sw.js       → cache ver: ', cacheVer);
}
