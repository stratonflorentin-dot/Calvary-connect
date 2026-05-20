export interface FleetMapDriver {
  id: string;
  driverName: string;
  latitude: number;
  longitude: number;
  speed: number;
  status: string;
  isOnline: boolean;
  vehiclePlate: string;
  lastUpdate: string;
  heading?: number;
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
