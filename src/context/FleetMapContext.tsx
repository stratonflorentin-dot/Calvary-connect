import { createContext, useRef, useState, ReactNode } from 'react';
import { useFleetRealtime } from '@/components/fleet-map/useFleetRealtime';
import { DriverProfile } from '@/components/fleet-map/useFleetRealtime';
import L from 'leaflet';

export const FleetMapContext = createContext<{
  drivers: DriverProfile[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  mapRef: React.RefObject<L.Map | null>;
}>({
  drivers: [],
  selectedId: null,
  setSelectedId: () => {},
  mapRef: { current: null },
});

export function FleetMapProvider({ children }: { children: ReactNode }) {
  const drivers = useFleetRealtime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapRef = useRef<L.Map>(null);

  return (
    <FleetMapContext.Provider value={{ drivers, selectedId, setSelectedId, mapRef }}>
      {children}
    </FleetMapContext.Provider>
  );
}
