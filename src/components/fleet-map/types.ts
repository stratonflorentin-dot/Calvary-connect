export interface FleetMapDriver {
  id: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  status: "LIVE" | "DELAYED" | "STALE" | "OFFLINE";
  isOnline: boolean;
  vehiclePlate: string;
  lastUpdate: string;
  heading?: number;
  accuracy: number | null;
  altitude: number | null;
  altitudeAccuracy: number | null;
  vehicleType: string;
  vehiclePhotoUrl?: string | null;
  engineOn?: boolean | null;
}

export interface FleetMapViewProps {
  locations: FleetMapDriver[];
  defaultCenter: [number, number];
  isLoading?: boolean;
  showEmptyOverlay?: boolean;
  loadError?: string | null;
  driversWithoutGps?: string[];
  onRefresh?: () => void;
}
