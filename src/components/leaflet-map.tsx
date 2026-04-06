'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Leaflet CSS - REQUIRED for tiles to display correctly
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom driver icon
const driverIcon = (isOnline: boolean) => L.divIcon({
  className: 'custom-driver-marker',
  html: `<div style="
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: white;
    border: 3px solid ${isOnline ? '#10b981' : '#6b7280'};
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isOnline ? '#10b981' : '#6b7280'}" stroke-width="2">
      <polygon points="12 2 2 22 22 22 12 2"></polygon>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

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

function MapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { 
    map.setView(center, map.getZoom()); 
  }, [center, map]);
  return null;
}

interface LeafletMapProps {
  locations: DriverLocation[];
  defaultCenter: [number, number];
}

export function LeafletMap({ locations, defaultCenter }: LeafletMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-full h-full bg-gray-100 flex items-center justify-center">Loading map...</div>;
  }

  return (
    <div className="w-full h-full absolute inset-0">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapCenter center={defaultCenter} />
      
      {locations?.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={driverIcon(loc.isOnline)}
        >
          <Popup>
            <div className="p-1 min-w-[140px]">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-0.5">Asset Status</p>
              <p className="text-xs font-headline text-primary mb-1">{loc.vehiclePlate || 'Unknown'}</p>
              <p className="text-[9px] text-muted-foreground mb-1">{loc.driverName || 'Unknown Driver'}</p>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-emerald-600 font-bold">{loc.speed || 0} KM/H</p>
                <Badge className={cn("text-[9px] h-4 px-1 border-none", loc.isOnline ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700")}>
                  {loc.isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className="text-[9px] text-muted-foreground mt-2 border-t pt-1">Status: {loc.status || 'Unknown'}</p>
              <p className="text-[9px] text-muted-foreground">Last Update: {loc.lastUpdate ? new Date(loc.lastUpdate).toLocaleTimeString() : 'Unknown'}</p>
            </div>
          </Popup>
        </Marker>
      ))}
      </MapContainer>
    </div>
  );
}
