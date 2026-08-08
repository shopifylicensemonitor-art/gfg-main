// Peakconix Sender - Service Worker
// Strategy: Cache-first for assets, Network-first for navigation
const CACHE_VERSION = 'peakx-v3';
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const NAV_CACHE = `${CACHE_VERSION}-nav`;
const KNOWN_CACHES = [ASSET_CACHE, NAV_CACHE];

// Core shell — cache these on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-sm.webp',
  '/favicon.ico'
];

// ── Install: pre-cache the app shell ────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSET_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: wipe outdated caches and claim all tabs ───────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => !KNOWN_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: route requests to the right strategy ─────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Skip cross-origin requests (CDN, analytics etc.)
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === 'navigate';
  const isAsset = /\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)(\?.*)?$/.test(url.pathname);

  if (isNavigation) {
    // Network-first for HTML pages — fall back to cached /index.html offline
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(NAV_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
  } else if (isAsset) {
    // Cache-first for static assets — serve instantly, update cache in background
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
  }
  // All other requests go through normally (no SW interception)
});

