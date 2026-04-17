"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Truck, Clock, AlertTriangle, Shield, Route } from "lucide-react";
import { City, calculateDistance, getEstimatedTime, getCargoRouteRecommendation } from "@/lib/african-cities";

interface RouteMapDialogProps {
  isOpen: boolean;
  onClose: () => void;
  origin: City | null;
  destination: City | null;
  cargoType: string;
  isSafeRoute: boolean;
}

export function RouteMapDialog({ 
  isOpen, 
  onClose, 
  origin, 
  destination, 
  cargoType,
  isSafeRoute 
}: RouteMapDialogProps) {
  if (!origin || !destination) return null;

  const distance = calculateDistance(origin, destination);
  const estimatedTime = getEstimatedTime(origin, destination);
  const recommendation = getCargoRouteRecommendation(cargoType || 'General Cargo', origin, destination);
  
  // Generate map URL (using Google Maps embed with directions)
  const mapUrl = `https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d8000000!2d${(origin.lng + destination.lng) / 2}!3d${(origin.lat + destination.lat) / 2}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e0!4m5!1s${encodeURIComponent(origin.name)}!2s${origin.lat},${origin.lng}!3m2!1d${origin.lat}!2d${origin.lng}!4m5!1s${encodeURIComponent(destination.name)}!2s${destination.lat},${destination.lng}!3m2!1d${destination.lat}!2d${destination.lng}!5e0!3m2!1sen!2s!4v1`;
  
  // Alternative: OpenStreetMap
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(origin.lng, destination.lng) - 2}%2C${Math.min(origin.lat, destination.lat) - 2}%2C${Math.max(origin.lng, destination.lng) + 2}%2C${Math.max(origin.lat, destination.lat) + 2}&layer=mapnik&marker=${origin.lat}%2C${origin.lng}&marker=${destination.lat}%2C${destination.lng}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-blue-600" />
            {isSafeRoute ? 'Safe Route Analysis' : 'Route Map'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Route Header */}
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <MapPin className="h-6 w-6 text-green-600 mx-auto" />
                  <p className="text-sm font-medium mt-1">{origin.name}</p>
                  <p className="text-xs text-muted-foreground">{origin.country}</p>
                </div>
                <div className="flex flex-col items-center px-4">
                  <div className="flex items-center gap-1 text-slate-400">
                    <span className="text-lg">→</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {distance} km
                  </div>
                </div>
                <div className="text-center">
                  <MapPin className="h-6 w-6 text-red-600 mx-auto" />
                  <p className="text-sm font-medium mt-1">{destination.name}</p>
                  <p className="text-xs text-muted-foreground">{destination.country}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2 text-slate-600">
                  <Truck className="h-4 w-4" />
                  <span className="font-medium">{distance} km</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 mt-1">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">~{estimatedTime} hours</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Map */}
          <div className="border rounded-lg overflow-hidden">
            <iframe
              src={mapUrl}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="bg-slate-100"
            />
          </div>
          
          {/* Cargo-Specific Recommendations */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4" />
              Cargo-Specific Recommendations
            </h4>
            <div className="text-sm text-blue-800 whitespace-pre-line">
              {recommendation}
            </div>
          </div>
          
          {/* Safety Information */}
          {isSafeRoute && (
            <div className="bg-amber-50 p-4 rounded-lg">
              <h4 className="font-medium text-amber-900 flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4" />
                Route Safety Information
              </h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Primary highway route recommended for trucks</li>
                <li>• Avoid night driving on rural sections</li>
                <li>• Check weather conditions before departure</li>
                <li>• Recommended rest stops every 4 hours</li>
                {origin.country !== destination.country && (
                  <li>• Cross-border documentation required at {origin.country} → {destination.country} border</li>
                )}
              </ul>
            </div>
          )}
          
          {/* Cargo Type Badge */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Cargo Type:</span>
            <Badge variant="outline" className="font-medium">
              {cargoType || 'General Cargo'}
            </Badge>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
