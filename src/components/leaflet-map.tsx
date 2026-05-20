// Leaflet Map Component for Driver Location Tracking
// Real-time GPS tracking for Calvary Logistics fleet

"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Truck,
  Navigation,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Locate,
  ChevronRight,
  Clock,
  Fuel,
  Phone,
  MessageSquare,
  MoreVertical,
  CheckCircle,
  XCircle,
  Activity,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DriverLocation {
  id: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  status: string;
  isOnline: boolean;
  vehiclePlate: string;
  lastUpdate: string;
}

interface LeafletMapProps {
  locations: DriverLocation[];
  defaultCenter: [number, number];
  onDriverSelect?: (driver: DriverLocation) => void;
}

// Custom truck icon SVG as data URL
const createTruckIcon = (isOnline: boolean, heading: number = 0) => {
  const color = isOnline ? "#10b981" : "#6b7280";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <g transform="rotate(${heading}, 20, 20)">
        <circle cx="20" cy="20" r="18" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>
        <path d="M12 22 L20 12 L28 22 L28 28 L12 28 Z" fill="${color}" stroke="white" stroke-width="1.5"/>
        <circle cx="20" cy="20" r="3" fill="white"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

export default function LeafletMap({
  locations,
  defaultCenter,
  onDriverSelect,
}: LeafletMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const isInitializingRef = useRef(false);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(
    null,
  );
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current || isInitializingRef.current) return;

    const initMap = async () => {
      isInitializingRef.current = true;
      try {
        // Dynamically import Leaflet
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");

        // Check again after async import to prevent race conditions
        if (mapInstanceRef.current) return;

        // Leaflet retains state on DOM element during strict mode re-mounts
        // We must forcefully clean up the _leaflet_id if it exists
        if (mapRef.current && (mapRef.current as any)._leaflet_id) {
          (mapRef.current as any)._leaflet_id = null;
        }

        // Initialize map
        const map = L.map(mapRef.current!, {
          center: defaultCenter,
          zoom: 7,
          zoomControl: false,
          attributionControl: true,
        });

        // Add tile layer (OpenStreetMap)
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map);

        // Add zoom control to bottom right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Store map instance
        mapInstanceRef.current = map;

        // Add Tanzania boundary layer (simplified)
        const tanzaniaBoundary = [
        [-0.9897, 29.5732],
        [-1.0596, 29.5732],
        [-1.4467, 29.9533],
        [-2.2156, 29.9533],
        [-3.2939, 31.2016],
        [-3.2939, 33.2143],
        [-4.5998, 33.5061],
        [-5.9468, 35.3122],
        [-6.5365, 37.4571],
        [-7.9445, 38.5997],
        [-9.4085, 39.7402],
        [-10.6817, 40.2169],
        [-10.6817, 40.2169],
        [-10.6817, 39.7402],
        [-9.4085, 39.7402],
        [-7.9445, 38.5997],
        [-6.5365, 37.4571],
        [-5.9468, 35.3122],
        [-4.5998, 33.5061],
        [-3.2939, 33.2143],
        [-3.2939, 31.2016],
        [-2.2156, 29.9533],
        [-1.4467, 29.9533],
        [-1.0596, 29.5732],
        [-0.9897, 29.5732],
      ];

      // Add border crossing points
      const borderPoints = [
        {
          name: "Namanga",
          coords: [-2.5276, 36.7873] as [number, number],
          country: "Kenya/Tanzania",
        },
        {
          name: "Tunduma",
          coords: [-9.3042, 32.7765] as [number, number],
          country: "Tanzania/Zambia",
        },
        {
          name: "Sirari",
          coords: [-1.4769, 34.0539] as [number, number],
          country: "Tanzania/Kenya",
        },
        {
          name: "Mikumi",
          coords: [-7.8019, 37.0452] as [number, number],
          country: "Tanzania/Mozambique",
        },
      ];

      borderPoints.forEach((point) => {
        const marker = L.marker(point.coords, {
          icon: L.divIcon({
            className: "border-marker",
            html: `<div class="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500 border-2 border-white shadow-lg">
              <span class="text-white text-xs font-bold">${point.name[0]}</span>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        }).addTo(map);

        marker.bindPopup(`
          <div class="p-2">
            <p class="font-bold text-sm">${point.name} Border</p>
            <p class="text-xs text-gray-500">${point.country}</p>
          </div>
        `);
      });

      // Add major cities
      const majorCities = [
        {
          name: "Dar es Salaam",
          coords: [-6.7924, 39.2083] as [number, number],
        },
        { name: "Arusha", coords: [-3.3667, 36.683] as [number, number] },
        { name: "Mwanza", coords: [-2.5164, 32.8983] as [number, number] },
        { name: "Dodoma", coords: [-6.163, 35.7516] as [number, number] },
      ];

      majorCities.forEach((city) => {
        const marker = L.marker(city.coords, {
          icon: L.divIcon({
            className: "city-marker",
            html: `<div class="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 border-2 border-white shadow">
              <span class="text-white text-[10px] font-bold">${city.name[0]}</span>
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
        }).addTo(map);

        marker.bindPopup(`<p class="font-medium text-sm">${city.name}</p>`);
      });
      } finally {
        isInitializingRef.current = false;
      }
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [defaultCenter]);

  // Update markers when locations change
  useEffect(() => {
    const updateMarkers = async () => {
      if (!mapInstanceRef.current || !locations.length) return;

      const L = await import("leaflet");
      const map = mapInstanceRef.current;

      // Remove old markers that are no longer in the list
      markersRef.current.forEach((marker, id) => {
        if (!locations.find((l) => l.id === id)) {
          map.removeLayer(marker);
          markersRef.current.delete(id);
        }
      });

      // Add or update markers
      locations.forEach((location) => {
        if (markersRef.current.has(location.id)) {
          // Update existing marker position
          const marker = markersRef.current.get(location.id);
          marker.setLatLng([location.latitude, location.longitude]);
        } else {
          // Create new marker
          const icon = L.divIcon({
            className: "driver-marker",
            html: `
              <div class="relative group">
                <div class="${cn(
                  "flex items-center justify-center w-12 h-12 rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110",
                  location.isOnline ? "bg-emerald-500" : "bg-gray-400",
                )}">
                  <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                  </svg>
                </div>
                ${location.isOnline ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>' : ""}
              </div>
            `,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          });

          const marker = L.marker([location.latitude, location.longitude], {
            icon,
          }).addTo(map);

          // Create popup content
          const popupContent = `
            <div class="p-3 min-w-[200px]">
              <div class="flex items-center justify-between mb-2">
                <p class="font-bold text-sm">${location.driverName}</p>
                <span class="px-2 py-0.5 rounded-full text-xs font-medium ${location.isOnline ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}">
                  ${location.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div class="space-y-1 text-xs text-gray-600">
                <p class="flex items-center gap-2">
                  <span class="font-medium">Vehicle:</span> ${location.vehiclePlate}
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium">Speed:</span> ${location.speed} km/h
                </p>
                <p class="flex items-center gap-2">
                  <span class="font-medium">Updated:</span> ${new Date(location.lastUpdate).toLocaleTimeString()}
                </p>
              </div>
              <div class="mt-3 flex gap-2">
                <button onclick="window.dispatchEvent(new CustomEvent('driver-action', {detail: {action: 'track', driverId: '${location.id}'}}))"
                  class="px-3 py-1.5 bg-blue-500 text-white text-xs rounded hover:bg-blue-600">
                  Track
                </button>
                <button onclick="window.dispatchEvent(new CustomEvent('driver-action', {detail: {action: 'details', driverId: '${location.id}'}}))"
                  class="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
                  Details
                </button>
              </div>
            </div>
          `;

          marker.bindPopup(popupContent);

          marker.on("click", () => {
            setSelectedDriver(location);
            setShowPanel(true);
            onDriverSelect?.(location);
          });

          markersRef.current.set(location.id, marker);
        }
      });

      // Fit bounds to show all markers
      if (locations.length > 0) {
        const bounds = L.latLngBounds(
          locations.map((l) => [l.latitude, l.longitude]),
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
      }
    };

    updateMarkers();
  }, [locations, onDriverSelect]);

  const handleZoomIn = async () => {
    if (mapInstanceRef.current) {
      const L = await import("leaflet");
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = async () => {
    if (mapInstanceRef.current) {
      const L = await import("leaflet");
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleCenterMap = async () => {
    if (mapInstanceRef.current && locations.length > 0) {
      const L = await import("leaflet");
      const bounds = L.latLngBounds(
        locations.map((l) => [l.latitude, l.longitude]),
      );
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full" />

      {/* Map Controls Overlay */}
      <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-[1000]">
        <Button
          variant="outline"
          size="icon"
          className="bg-white shadow-xl hover:bg-gray-50 active:scale-95 transition-all"
          onClick={handleZoomIn}
        >
          <ZoomIn className="w-5 h-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="bg-white shadow-xl hover:bg-gray-50 active:scale-95 transition-all"
          onClick={handleZoomOut}
        >
          <ZoomOut className="w-5 h-5" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="bg-blue-600 hover:bg-blue-700 shadow-xl active:scale-95 transition-all"
          onClick={handleCenterMap}
        >
          <Locate className="w-5 h-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-24 left-4 bg-white/95 backdrop-blur-md rounded-xl shadow-xl p-4 z-[1000] max-w-[200px]">
        <h4 className="text-sm font-bold mb-3">Legend</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow" />
            <span>Online Driver</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-white shadow" />
            <span>Offline Driver</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow" />
            <span>Border Point</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow" />
            <span>Major City</span>
          </div>
        </div>
      </div>

      {/* Selected Driver Panel */}
      {showPanel && selectedDriver && (
        <div className="absolute top-4 right-4 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl z-[1000] overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    {selectedDriver.driverName}
                  </h3>
                  <p className="text-sm text-blue-100">
                    {selectedDriver.vehiclePlate}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setShowPanel(false)}
              >
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Status */}
            <div className="flex items-center gap-3">
              <Badge
                variant={selectedDriver.isOnline ? "default" : "secondary"}
                className={cn(
                  "gap-2 px-3 py-1.5",
                  selectedDriver.isOnline
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600",
                )}
              >
                {selectedDriver.isOnline ? (
                  <>
                    <Wifi className="w-3 h-3" />
                    Online
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3" />
                    Offline
                  </>
                )}
              </Badge>
              <Badge variant="outline" className="gap-2">
                <Activity className="w-3 h-3" />
                {selectedDriver.status}
              </Badge>
            </div>

            {/* Vehicle Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Speed</p>
                <p className="text-lg font-bold text-slate-900">
                  {selectedDriver.speed} km/h
                </p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">Last Update</p>
                <p className="text-sm font-bold text-slate-900">
                  {new Date(selectedDriver.lastUpdate).toLocaleTimeString()}
                </p>
              </div>
            </div>

            {/* Coordinates */}
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-2">
                Location Coordinates
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-slate-400">Latitude</p>
                  <p className="text-sm font-mono font-medium">
                    {selectedDriver.latitude.toFixed(6)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Longitude</p>
                  <p className="text-sm font-mono font-medium">
                    {selectedDriver.longitude.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-2 gap-1"
              >
                <Navigation className="w-4 h-4" />
                <span className="text-[10px]">Navigate</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-2 gap-1"
              >
                <Phone className="w-4 h-4" />
                <span className="text-[10px]">Call</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-2 gap-1"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-[10px]">Message</span>
              </Button>
            </div>

            {/* View on Map */}
            <Button
              variant="default"
              className="w-full gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.setView(
                    [selectedDriver.latitude, selectedDriver.longitude],
                    14,
                  );
                }
              }}
            >
              <MapPin className="w-4 h-4" />
              View on Map
            </Button>
          </div>
        </div>
      )}

      {/* Drivers List Quick Access */}
      <div className="absolute bottom-24 left-4 right-4 md:right-auto md:w-80 z-[999]">
        <Card className="bg-white/95 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Active Drivers ({locations.filter((l) => l.isOnline).length})
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {locations.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="max-h-48 overflow-y-auto">
            <div className="space-y-2">
              {locations.slice(0, 5).map((location) => (
                <div
                  key={location.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-50",
                    selectedDriver?.id === location.id &&
                      "bg-blue-50 border border-blue-200",
                  )}
                  onClick={() => {
                    setSelectedDriver(location);
                    setShowPanel(true);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setView(
                        [location.latitude, location.longitude],
                        14,
                      );
                    }
                  }}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      location.isOnline
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-gray-400",
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {location.driverName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {location.vehiclePlate}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium">{location.speed} km/h</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(location.lastUpdate).toLocaleTimeString()}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>
            {locations.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-blue-600"
              >
                View all {locations.length} drivers
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {locations.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-[1001]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              No Drivers Found
            </h3>
            <p className="text-sm text-slate-500 max-w-xs">
              No drivers are currently sharing their location. Drivers must
              grant location permission in the mobile app.
            </p>
          </div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx global>{`
        .leaflet-container {
          width: 100%;
          height: 100%;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }
        .leaflet-popup-content {
          margin: 0;
        }
        .leaflet-popup-tip {
          box-shadow: none;
        }
        .driver-marker {
          background: transparent !important;
          border: none !important;
        }
        .border-marker {
          background: transparent !important;
          border: none !important;
        }
        .city-marker {
          background: transparent !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
