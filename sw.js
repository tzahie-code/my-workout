// Service Worker — caches the app shell so it loads even with no/bad internet.
// API calls (Turso sync, Supabase, Google auth) are NEVER intercepted — they
// go directly to the network so your workout data always syncs normally.
const CACHE_VER = 'mw-v1';
const APP_SHELL = ['/', '/index.html'];

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
