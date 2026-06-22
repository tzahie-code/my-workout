// Vercel build script — runs once per deploy.
// 1. Injects the real deployment timestamp into index.html  (__BUILD_DATE__)
// 2. Injects a unique cache-busting version into sw.js      (__CACHE_VER__)
//    so the service worker updates on every deploy and never serves stale content.
// 3. Generates icon-192.png and icon-512.png (pure Node.js, no dependencies)
const fs   = require('fs');
const zlib = require('zlib');

const now = new Date();
const pad = n => String(n).padStart(2, '0');

const buildDate = now.toISOString();
const cacheVer  = 'mw-' +
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

// ── Generate PWA icons ────────────────────────────────────────────────────────
// Pure Node.js PNG encoder — no npm packages needed.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const lenBuf    = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf]);
}

function encodePNG(rgba, size) {
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3); // filter byte + RGB (no alpha in file)
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      row[1 + x*3]     = rgba[s];
      row[1 + x*3 + 1] = rgba[s+1];
      row[1 + x*3 + 2] = rgba[s+2];
    }
    rows.push(row);
  }
  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

// Design: full orange gradient fill (iOS clips to rounded rect automatically),
// large white "W" rendered as smooth anti-aliased strokes.
// Filling the full square — not a circle on dark — is how professional app icons look.

function generateIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;

  // Orange gradient: #ff6b35 top → #d94b20 bottom
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(255 - 38 * t);  // 255 → 217
    const g = Math.round(107 - 32 * t);  // 107 → 75
    const b = Math.round(53  - 21 * t);  // 53  → 32
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      rgba[idx] = r; rgba[idx+1] = g; rgba[idx+2] = b; rgba[idx+3] = 255;
    }
  }

  // White "W" — 5 centerline points, fills ~72% of icon width
  const wS = size * 0.34;
  const wPts = [
    [cx - wS,        cy - wS * 0.50],
    [cx - wS * 0.38, cy + wS * 0.52],
    [cx,             cy - wS * 0.42],
    [cx + wS * 0.38, cy + wS * 0.52],
    [cx + wS,        cy - wS * 0.50],
  ];
  const strokeR = size * 0.080; // bold stroke, readable at small sizes

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const px = x + 0.5, py = y + 0.5;

      let minDist = Infinity;
      for (let k = 0; k < wPts.length - 1; k++) {
        const ax = wPts[k][0],  ay = wPts[k][1];
        const bx = wPts[k+1][0], by = wPts[k+1][1];
        const ux = bx - ax, uy = by - ay;
        const lenSq = ux * ux + uy * uy;
        const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * ux + (py - ay) * uy) / lenSq)) : 0;
        const d = Math.sqrt((px - ax - t * ux) ** 2 + (py - ay - t * uy) ** 2);
        if (d < minDist) minDist = d;
      }

      const wAlpha = Math.max(0, Math.min(1, strokeR - minDist + 1));
      if (wAlpha > 0) {
        rgba[idx]   = Math.round(rgba[idx]   + (255 - rgba[idx])   * wAlpha);
        rgba[idx+1] = Math.round(rgba[idx+1] + (255 - rgba[idx+1]) * wAlpha);
        rgba[idx+2] = Math.round(rgba[idx+2] + (255 - rgba[idx+2]) * wAlpha);
      }
    }
  }

  return encodePNG(rgba, size);
}

fs.writeFileSync('icon-192.png', generateIcon(192));
fs.writeFileSync('icon-512.png', generateIcon(512));
console.log('icons       → icon-192.png (192×192), icon-512.png (512×512)');
