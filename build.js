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

// Design: dark background, orange filled circle, white pixel-art "W"
// "W" glyph — 7 columns × 8 rows bitmap
const W_GLYPH = [
  [1,0,0,0,0,0,1],
  [1,0,0,0,0,0,1],
  [1,0,0,1,0,0,1],
  [1,0,1,0,1,0,1],
  [1,0,1,0,1,0,1],
  [0,1,0,0,0,1,0],
  [0,1,0,0,0,1,0],
  [0,0,0,0,0,0,0],
];

function generateIcon(size) {
  const rgba = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.42; // orange circle radius

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i  = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx*dx + dy*dy) <= r) {
        rgba[i] = 255; rgba[i+1] = 107; rgba[i+2] = 53; // #ff6b35 orange
      } else {
        rgba[i] = 13;  rgba[i+1] = 13;  rgba[i+2] = 15; // #0d0d0f dark
      }
      rgba[i+3] = 255;
    }
  }

  // Draw white "W" glyph — scale so the letter fills ~46% of the circle diameter
  const glyphW = W_GLYPH[0].length, glyphH = W_GLYPH.length;
  const scale  = Math.max(1, Math.round(size * 0.46 / glyphW));
  const ox     = Math.round(cx - glyphW * scale / 2);
  const oy     = Math.round(cy - glyphH * scale / 2);

  for (let gy = 0; gy < glyphH; gy++) {
    for (let gx = 0; gx < glyphW; gx++) {
      if (!W_GLYPH[gy][gx]) continue;
      for (let py = 0; py < scale; py++) {
        for (let px = 0; px < scale; px++) {
          const x = ox + gx * scale + px, y = oy + gy * scale + py;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const i = (y * size + x) * 4;
          rgba[i] = rgba[i+1] = rgba[i+2] = rgba[i+3] = 255;
        }
      }
    }
  }

  return encodePNG(rgba, size);
}

fs.writeFileSync('icon-192.png', generateIcon(192));
fs.writeFileSync('icon-512.png', generateIcon(512));
console.log('icons       → icon-192.png (192×192), icon-512.png (512×512)');
