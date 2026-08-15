import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';

// Self-hosted at build time by next/font — no runtime requests to
// fonts.googleapis.com / fonts.gstatic.com (and no CSP entries for them).
// Calvary Connect brand typeface (see stitch_screens_board/calvary_connect/DESIGN.md).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/components/ui/toast-provider";
import { PageLoader } from "@/components/page-loader";
import { MotionProvider } from "@/components/motion-provider";
import { SupabaseProvider } from '@/components/supabase-provider';
import { PWAProvider } from '@/components/pwa/pwa-provider';
import { PWAInstallPrompt } from '@/components/pwa/pwa-install-prompt';
import { DriverSilentTrackingRoot } from '@/components/tracking/driver-silent-tracking-root';
import { ThemeProvider } from '@/components/theme-provider';
import { FinancialSalesProvider } from '@/context/FinancialSalesContext';
import { RouteOverridesProvider } from '@/components/route-overrides-provider';
import { SidebarProvider } from '@/hooks/use-sidebar';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#002d5c',
  minimumScale: 1,
}

export const metadata: Metadata = {
  title: 'Calvary Connect | Fleet Management',
  description: 'Professional fleet management platform for Calvary Connect - manage logistics, drivers, vehicles, and operations on iOS, Android, or Web.',
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
        color: '#002d5c',
      },
    ],
  },

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
    <html lang="en" suppressHydrationWarning className={spaceGrotesk.variable}>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem={true}
          disableTransitionOnChange
        >
          <div className="bg-background text-foreground min-h-screen">
            <PageLoader />
            <MotionProvider>
              <PWAProvider>
                <SidebarProvider>
                  <SupabaseProvider>
                    <ToastProvider />
                    <DriverSilentTrackingRoot />
                    <RouteOverridesProvider>
                      <FinancialSalesProvider>{children}</FinancialSalesProvider>
                    </RouteOverridesProvider>
                    <Toaster />
                    <PWAInstallPrompt />
                  </SupabaseProvider>
                </SidebarProvider>
              </PWAProvider>
            </MotionProvider>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
