// LEGACY SERVICE WORKER — intentionally self-destructing.
//
// The app registers /sw.js only. This file remains solely so that browsers
// that registered /service-worker.js from an old deployment fetch this stub,
// which unregisters itself and deletes every cache it may have created
// (including stale map tiles that kept breaking new deployments).
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clientsList = await self.clients.matchAll({ type: 'window' });
      // Reload controlled pages so they pick up /sw.js instead
      clientsList.forEach((client) => client.navigate(client.url));
    })()
  );
});
