// Service Worker — caches the app so it loads from local storage even with no internet.
// Bump CACHE_VER whenever index.html is deployed to force a refresh.
const CACHE_VER = 'mw-v1';
const CACHE_URLS = ['/', '/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VER).then(cache => cache.addAll(CACHE_URLS))
  );
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', e => {
  // Delete old cache versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VER).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Only cache-intercept same-origin requests (not fonts, Google APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Cache-first for the app shell, network-update in background (stale-while-revalidate)
  e.respondWith(
    caches.open(CACHE_VER).then(async cache => {
      const cached = await cache.match(e.request);
      const networkFetch = fetch(e.request).then(res => {
        if (res && res.status === 200) cache.put(e.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || await networkFetch;
    })
  );
});
