'use client';

import { useEffect } from 'react';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Dev builds serve dynamically-imported chunks (e.g. the map components)
    // under stable, unhashed filenames that change content without changing
    // URL — the service worker's CacheFirst strategy for static assets then
    // serves a permanently stale copy no matter how many times you reload.
    // Only register it in production, where content-hashed filenames make
    // CacheFirst safe.
    if (process.env.NODE_ENV !== 'production') return;
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('SW registered:', registration.scope);
          })
          .catch((error) => {
            console.log('SW registration failed:', error);
          });
      });
    }
  }, []);

  return <>{children}</>;
}
