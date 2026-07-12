import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
  experimental: {
    scrollRestoration: true,
  },
  // FAT32 volumes make Node's readlink return EISDIR for regular files,
  // which crashes webpack's symlink resolution. Skip it — no symlinks here.
  // Also exclude puppeteer from bundling (server-only, bundles Chromium binaries).
  webpack: (config, { isServer }) => {
    config.resolve.symlinks = false;
    if (isServer) {
      config.externals = [...(config.externals ?? []), 'puppeteer', 'puppeteer-core'];
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for styles; unsafe-eval for App Router hydration
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.mapbox.com",
              "font-src 'self' https://fonts.gstatic.com",
              // Supabase REST + Realtime WS, Firebase, Mapbox, OSRM, Nominatim
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.googleapis.com wss://*.firebaseio.com https://*.firebaseio.com https://api.mapbox.com https://events.mapbox.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://vercel.live",
              // Images from data URIs, blobs (WebRTC), and allowed CDNs
              "img-src 'self' data: blob: https://*.supabase.co https://placehold.co https://images.unsplash.com https://picsum.photos",
              // Service worker must be from same origin
              "worker-src 'self' blob:",
              // WebRTC audio/video streams
              "media-src 'self' blob:",
              // Vercel Live for dev previews only
              "frame-src 'self' https://vercel.live",
            ].join('; '),
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
