'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MapPin, AlertTriangle, Navigation } from 'lucide-react';

interface LocationPermissionPromptProps {
  onGranted: () => void;
  onDenied: () => void;
  required?: boolean;
}

export function LocationPermissionPrompt({ 
  onGranted, 
  onDenied, 
  required = true 
}: LocationPermissionPromptProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    if (typeof navigator === 'undefined') return;

    try {
      const result = await navigator.permissions?.query({ name: 'geolocation' });
      if (result) {
        setPermissionState(result.state);
        
        if (result.state === 'granted') {
          onGranted();
        } else if (result.state === 'denied') {
          setIsOpen(true);
        } else {
          setIsOpen(true);
        }

        result.addEventListener('change', () => {
          setPermissionState(result.state);
          if (result.state === 'granted') {
            setIsOpen(false);
            onGranted();
          }
        });
      } else {
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }
  };

  const requestLocation = async () => {
    setIsRequesting(true);
    
    if (!navigator.geolocation) {
      setIsRequesting(false);
      onDenied();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setIsRequesting(false);
        setIsOpen(false);
        onGranted();
      },
      (error) => {
        setIsRequesting(false);
        console.error('Location error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Location Access Required
          </DialogTitle>
          <DialogDescription>
            {required 
              ? "This app requires your location to track your route and ensure safety. Please enable location services to continue."
              : "Enable location to allow real-time tracking and better service."
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
            <Navigation className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Why we need your location:</p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                <li>Track your delivery route</li>
                <li>Ensure driver safety</li>
                <li>Provide accurate ETAs to customers</li>
                <li>Optimize fleet management</li>
              </ul>
            </div>
          </div>

          {permissionState === 'denied' && (
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="text-sm text-red-700">
                <p className="font-medium">Location is blocked</p>
                <p className="mt-1">Please enable location in your browser settings and refresh the page.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={requestLocation} 
            disabled={isRequesting || permissionState === 'denied'}
            className="flex-1"
          >
            {isRequesting ? 'Requesting...' : 'Enable Location'}
          </Button>
          {!required && (
            <Button 
              variant="outline" 
              onClick={() => { setIsOpen(false); onDenied(); }}
              className="flex-1"
            >
              Skip
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
