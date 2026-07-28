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
    serverActions: {
      // File uploads (avatars, chat attachments, POD photos, insurance docs)
      // go through server actions; the 1 MB default rejects real photos.
      bodySizeLimit: '10mb',
    },
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
    // Security headers (CSP, HSTS, X-Frame-Options, etc.) are set exclusively
    // in src/middleware.ts. They used to be duplicated here with slightly
    // different directives, which drifted out of sync — see project history.
    // Do not re-add them here; edit middleware.ts instead.
    return [
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
