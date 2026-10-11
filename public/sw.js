/* Spendwise service worker — enables install + a basic app-shell cache.
 * Network-first for navigations (so data stays fresh), cache fallback offline.
 * API responses are never cached (financial data must be live). */
const CACHE = 'mt-shell-v3';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GETs. Never cache API calls.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Next's client-side navigations fetch RSC payloads from the same paths as
  // the HTML. Those are app content, not assets — caching them first-hand
  // serves a stale screen after every deploy (and defeats HMR in dev), so
  // leave them to the network entirely.
  if (url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') return;
  if (url.pathname.startsWith('/_next/') && !url.pathname.startsWith('/_next/static/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/'))),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
      return res;
    })),
  );
});
