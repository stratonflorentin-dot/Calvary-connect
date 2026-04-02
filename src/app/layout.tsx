import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseProvider } from '@/components/supabase-provider';
import { PWAProvider } from '@/components/pwa/pwa-provider';
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1e40af',
}

export const metadata: Metadata = {
  title: 'FleetCommand | Fleet Management System',
  description: 'Professional fleet management platform for logistics operations, driver management, and vehicle tracking. Available on iOS, Android, Mac, Windows, and Web.',
  keywords: ['fleet management', 'logistics', 'driver management', 'vehicle tracking', 'fleet operations'],
  authors: [{ name: 'FleetCommand' }],
  creator: 'FleetCommand',
  publisher: 'FleetCommand',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.svg',
        color: '#1e40af',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FleetCommand',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'FleetCommand',
    title: 'FleetCommand | Fleet Management System',
    description: 'Professional fleet management platform for logistics operations',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FleetCommand | Fleet Management System',
    description: 'Professional fleet management platform for logistics operations',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
        <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.0/mapbox-gl.css" rel="stylesheet" />
      </head>
      <body className="font-body antialiased bg-background text-foreground">
        <PWAProvider>
          <SupabaseProvider>
            {children}
            <Toaster />
            <PWAInstallPrompt />
          </SupabaseProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
