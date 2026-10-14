// Service Worker — caches the app shell so it loads even with no/bad internet.
// API calls (Turso sync, Supabase, Google auth) are NEVER intercepted — they
// go directly to the network so your workout data always syncs normally.
// CACHE_VER is replaced at build time by build.js — changes on every deploy
// so stale content is never served after an update.
const CACHE_VER = 'mw-20261014-1247';
const GIF_CACHE = 'mw-workout-gifs-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER).then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER && k !== GIF_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pass through: non-GET and external origins (Turso, Supabase, Google, etc.)
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Exercise GIFs are immutable URLs. Keep every successfully loaded workout
  // image on the device so a later outage of the external host cannot blank it.
  if (url.pathname === '/api/img-proxy') {
    e.respondWith(
      caches.open(GIF_CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        if (cached) return cached;
        const response = await fetch(e.request);
        if (response?.ok && (response.headers.get('content-type') || '').startsWith('image/')) {
          await cache.put(e.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

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
