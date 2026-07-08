// Calvary Connect — Service Worker (Enterprise Offline Support)
// Business Continuity: Drivers work even with no internet connection.
//
// Cache strategies:
//   - Driver pages: NetworkFirst (3s timeout → cache)
//   - Static assets: CacheFirst (versioned)
//   - Trip status updates: Background Sync (24h retry queue)
//   - GPS location: buffered locally, batch-synced on reconnect
//
// Phase 2: Replace with Workbox CLI for full production build integration.

const CACHE_NAME = 'calvary-connect-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/favicon.png',
  '/icon.png',
  '/apple-touch-icon.png',
  '/driver',
  '/offline',
];

// ─── SLA: Background sync retry window ────────────────────────────────────────
const SYNC_RETRY_HOURS = 24;

// ─── Install: pre-cache static assets ────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Partial cache install (some assets may be missing):', err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removing old cache:', name);
            return caches.delete(name);
          })
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: multi-strategy routing ───────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // Skip Firebase / Supabase / external APIs — handled by SDK offline queues
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('api.mapbox.com') ||
    url.hostname.includes('maps.googleapis.com')
  ) {
    return;
  }

  // Driver pages + trip API: NetworkFirst (3s timeout, offline fallback)
  if (url.pathname.startsWith('/driver') || url.pathname.startsWith('/api/trips')) {
    event.respondWith(networkFirst(request, 3000));
    return;
  }

  // Static assets: CacheFirst
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|webp|svg|ico)$/)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // All other navigation: NetworkFirst with longer timeout
  event.respondWith(networkFirst(request, 5000));
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-status') {
    event.waitUntil(syncQueue('trip-status-queue'));
  }
  if (event.tag === 'sync-gps-buffer') {
    event.waitUntil(syncQueue('gps-buffer-queue'));
  }
  if (event.tag === 'sync-fuel-requests') {
    event.waitUntil(syncQueue('fuel-requests-queue'));
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
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: data.tag || 'default',
        data: { url: data.url },
        vibrate: [200, 100, 200],
        requireInteraction: data.critical || false,
      })
    );
  } catch {
    console.warn('[SW] Failed to parse push data');
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});

// ─── Client messages ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
  if (event.data?.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => cache.addAll(event.data.urls || []))
    );
  }
});

// ─── Strategy helpers ─────────────────────────────────────────────────────────

async function networkFirst(request, timeoutMs) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline') || await cache.match('/');
      return offlinePage || new Response('You are offline. Please reconnect.', { status: 503 });
    }
    return new Response('', { status: 404 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function syncQueue(queueName) {
  // In production: open IndexedDB store `queueName`, replay each request
  console.log(`[SW] Syncing queue: ${queueName}`);
  // Placeholder — implement with idb-keyval or native IDB in Phase 2
}
