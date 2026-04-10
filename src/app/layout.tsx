import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SupabaseProvider } from '@/components/supabase-provider';
import { RoleSelectorWrapper } from '@/components/dashboard/role-selector-wrapper';
import { PWAProvider } from '@/components/pwa/pwa-provider';
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#2952A3',
}

export const metadata: Metadata = {
  title: 'Calvary Connect | Fleet Management',
  description: 'Professional fleet management platform for Calvary Connect — manage logistics, drivers, vehicles, and operations on iOS, Android, or Web.',
  keywords: ['fleet management', 'logistics', 'driver management', 'vehicle tracking', 'Calvary Connect'],
  authors: [{ name: 'Calvary Connect' }],
  creator: 'Calvary Connect',
  publisher: 'Calvary Connect',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'mask-icon',
        url: '/favicon.svg',
        color: '#2952A3',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Calvary Connect',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Calvary Connect',
    title: 'Calvary Connect | Fleet Management',
    description: 'Professional fleet management platform for Calvary Connect',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Calvary Connect | Fleet Management',
    description: 'Professional fleet management platform for Calvary Connect',
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
            <RoleSelectorWrapper />
            <PWAInstallPrompt />
          </SupabaseProvider>
        </PWAProvider>
      </body>
    </html>
  );
}
