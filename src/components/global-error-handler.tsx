"use client";

import { useEffect } from 'react';

export function GlobalErrorHandler() {
  useEffect(() => {
    // Global error handler
    window.onerror = function (msg, url, line, col, error) {
      console.error("Global error:", msg, url, line, col, error);
      
      // Log to external service if needed
      if ((window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: msg?.toString() || 'Unknown error',
          fatal: false
        });
      }
      
      return false;
    };

    // Unhandled promise rejection handler
    window.onunhandledrejection = function (event) {
      console.error("Unhandled promise:", event.reason);
      
      // Log to external service if needed
      if ((window as any).gtag) {
        (window as any).gtag('event', 'exception', {
          description: `Unhandled promise: ${event.reason}`,
          fatal: false
        });
      }
    };

    // Cleanup handlers
    return () => {
      window.onerror = null;
      window.onunhandledrejection = null;
    };
  }, []);

  return null;
}
