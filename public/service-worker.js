const CACHE_NAME = 'calvary-connect-v2';
const MAPLIBRE_PATTERNS = [
    /\.pbf$/,
    /cartocdn\.com/,
    /basemaps\.cartocdn\.com/,
    /mapbox\.com/,
    /tile\.openstreetmap\.org/,
    /openstreetmap\.org/,
    /style\.json$/,
    /glyphs/,
    /sprites/
];

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip caching for MapLibre resources to prevent failed tiles from being cached
    const isMapLibreResource = MAPLIBRE_PATTERNS.some(pattern => pattern.test(url.href));

    if (isMapLibreResource) {
        // Network-first for map resources to always get fresh tiles
        event.respondWith(
            fetch(event.request).catch(() => {
                // If network fails, try cache as fallback
                return caches.match(event.request);
            })
        );
    } else {
        // Cache-first for other static assets
        event.respondWith(
            caches.match(event.request).then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(response => {
                    // Only cache successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                    return response;
                });
            })
        );
    }
});
