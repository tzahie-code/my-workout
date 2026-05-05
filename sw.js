// Service Worker — caches the app shell so it loads even with no/bad internet.
// API calls (Turso sync, Supabase, Google auth) are NEVER intercepted — they
// go directly to the network so your workout data always syncs normally.
// CACHE_VER is replaced at build time by build.js — changes on every deploy
// so stale content is never served after an update.
const CACHE_VER = '__CACHE_VER__';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pass through: non-GET, API routes, external origins (Turso, Supabase, Google, etc.)
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Only intercept the app shell (/ and /index.html)
  if (!APP_SHELL.includes(url.pathname)) return;

  // Serve from cache immediately; update cache in background
  e.respondWith(
    caches.open(CACHE_VER).then(async cache => {
      const cached = await cache.match(e.request);
      // Always fetch fresh copy in background to keep cache up to date
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200) cache.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || await networkFetch;
    })
  );
});
