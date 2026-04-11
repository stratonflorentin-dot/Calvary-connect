'use client';

import { useEffect } from 'react';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/service-worker.js')
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
