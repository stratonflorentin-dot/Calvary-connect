// Calvary Connect — Service Worker v3
// Strategies:
//   - Static assets (JS/CSS/fonts/images): CacheFirst
//   - Navigation (HTML pages): NetworkFirst with offline fallback
//   - External APIs (Supabase, Firebase, Mapbox): BYPASS — handled by SDK queues
//   - Push notifications: supported with correct icon paths
//
// Do NOT cache:
//   - Supabase REST or WebSocket (auth tokens, realtime)
//   - Firebase Realtime Database
//   - Any authenticated API endpoint

const CACHE_VERSION = 'calvary-connect-v3';

// Only cache assets that are guaranteed to exist at the root level
const STATIC_PRECACHE = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icon.png',
  '/apple-touch-icon.png',
  '/icon-72.png',
  '/icon-96.png',
  '/icon-128.png',
  '/icon-144.png',
  '/icon-384.png',
  '/icon-512.png',
];

// ─── Install: pre-cache only known-safe static assets ────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails atomically — use individual adds to be resilient
      Promise.allSettled(
        STATIC_PRECACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache ${url}:`, err.message);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

// ─── Activate: remove all old caches ─────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => {
            console.log('[SW] Removing stale cache:', k);
            return caches.delete(k);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch routing ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // BYPASS: Supabase (REST, Realtime WebSocket, Auth)
  if (url.hostname.includes('supabase.co')) return;

  // BYPASS: Firebase (Realtime DB, Auth, Analytics)
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase.com') ||
    url.hostname.includes('firebaseapp.com')
  ) return;

  // BYPASS: Mapbox and routing APIs
  if (
    url.hostname.includes('api.mapbox.com') ||
    url.hostname.includes('events.mapbox.com') ||
    url.hostname.includes('router.project-osrm.org') ||
    url.hostname.includes('nominatim.openstreetmap.org')
  ) return;

  // BYPASS: Vercel Live / deployment tooling
  if (url.hostname.includes('vercel.live')) return;

  // Static assets: CacheFirst
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico|gif)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Font stylesheets from Google Fonts: CacheFirst with network fallback
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigation requests (HTML pages): NetworkFirst with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigate(request));
    return;
  }

  // Everything else same-origin: NetworkFirst
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, 5000));
    return;
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Calvary Connect', {
        body: data.body || '',
        // Use icons that actually exist in /public
        icon: '/icon-128.png',
        badge: '/icon-72.png',
        tag: data.tag || 'calvary-default',
        data: { url: data.url || '/' },
        vibrate: [200, 100, 200],
        requireInteraction: data.critical || false,
      })
    );
  } catch (err) {
    console.warn('[SW] Failed to parse push notification data:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing tab if possible
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ─── Background Sync (stub — implement with IndexedDB in Phase 2) ─────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-status') {
    event.waitUntil(syncQueue('trip-status-queue'));
  }
  if (event.tag === 'sync-gps-buffer') {
    event.waitUntil(syncQueue('gps-buffer-queue'));
  }
});

// ─── Client messages ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_VERSION).then((cache) =>
        Promise.allSettled((event.data.urls || []).map((u) => cache.add(u).catch(() => {})))
      )
    );
  }
});

// ─── Strategy helpers ─────────────────────────────────────────────────────────

async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function networkFirstNavigate(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try the cached version of this exact page
    const cached = await cache.match(request);
    if (cached) return cached;
    // Fall back to the cached root ('/') for SPA navigation
    const rootCached = await cache.match('/');
    if (rootCached) return rootCached;
    // Last resort: plain offline message
    return new Response(
      '<!DOCTYPE html><html><head><title>Calvary Connect — Offline</title></head>' +
        '<body style="font-family:sans-serif;text-align:center;padding:40px">' +
        '<h1>You are offline</h1>' +
        '<p>Please reconnect to continue using Calvary Connect.</p>' +
        '<button onclick="window.location.reload()">Retry</button>' +
        '</body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst fetch failed:', request.url, err.message);
    return new Response('', { status: 404 });
  }
}

async function syncQueue(queueName) {
  // TODO Phase 2: open IndexedDB store `queueName`, replay queued fetch requests
  console.log(`[SW] Background sync triggered for: ${queueName}`);
}
