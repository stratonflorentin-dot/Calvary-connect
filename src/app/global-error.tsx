'use client';

// Root error boundary for the App Router. Unlike error.tsx (which is nested
// inside the root layout), global-error.tsx catches errors thrown in the root
// layout itself, so it must render its own <html>/<body>. It intentionally
// shows a generic message instead of error.message to avoid leaking internal
// error details to end users; the digest is kept for server-side correlation.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui, sans-serif',
            background: '#0b0b0c',
            color: '#fff',
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ opacity: 0.7, marginBottom: 16 }}>
              An unexpected error occurred. Please try again.
            </p>
            {error.digest && (
              <p style={{ opacity: 0.4, fontSize: 12, marginBottom: 16 }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#0ea5e9',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
