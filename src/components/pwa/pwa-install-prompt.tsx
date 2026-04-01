'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone, Monitor, Share2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else if (/win32|win64|macintosh|mac intel|linux/.test(userAgent)) {
      setPlatform('desktop');
    }

    // Listen for beforeinstallprompt (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Show prompt after 3 seconds for iOS (no native prompt available)
    const timer = setTimeout(() => {
      if (platform === 'ios' && !isInstalled) {
        setShowPrompt(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, [platform, isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Store dismissal in localStorage to not show again for 7 days
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Check if user dismissed recently
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) {
        setShowPrompt(false);
      }
    }
  }, []);

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50">
      <Card className="shadow-2xl border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Install FleetCommand
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {platform === 'ios' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install FleetCommand on your iPhone/iPad for quick access:
              </p>
              <ol className="text-sm space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">1.</span>
                  <span>Tap the <Share2 className="h-4 w-4 inline mx-1" /> Share button in Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">2.</span>
                  <span>Scroll down and tap "Add to Home Screen"</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-foreground">3.</span>
                  <span>Tap "Add" to install</span>
                </li>
              </ol>
            </div>
          )}

          {platform === 'android' && deferredPrompt && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install FleetCommand on your Android device for the best experience:
              </p>
              <Button 
                onClick={handleInstallClick}
                className="w-full gap-2"
              >
                <Smartphone className="h-4 w-4" />
                Install App
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Or tap menu ⋮ → "Add to Home screen"
              </p>
            </div>
          )}

          {platform === 'desktop' && deferredPrompt && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install FleetCommand as a desktop app for easy access:
              </p>
              <Button 
                onClick={handleInstallClick}
                className="w-full gap-2"
              >
                <Monitor className="h-4 w-4" />
                Install Desktop App
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Or use Chrome menu → Install FleetCommand
              </p>
            </div>
          )}

          {platform === 'unknown' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Install FleetCommand for quick access:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="bg-muted p-2 rounded">
                  <strong>iOS:</strong> Share → Add to Home Screen
                </div>
                <div className="bg-muted p-2 rounded">
                  <strong>Android:</strong> Menu → Add to Home screen
                </div>
                <div className="bg-muted p-2 rounded col-span-2">
                  <strong>Desktop:</strong> Chrome menu → Install FleetCommand
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
