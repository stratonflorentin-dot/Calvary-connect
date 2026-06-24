import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { useContext, memo } from 'react';
import { FleetMapContext } from '@/context/FleetMapContext';
import L from 'leaflet';

// Custom icons based on status and selection
const createIcon = (color: string, selected = false) =>
  L.divIcon({
    className: '',
    html: `
      <div class="relative">
        <div class="w-6 h-6 rounded-full bg-${color}-500 border-2 border-white"></div>
        ${selected ? '<div class="absolute inset-0 rounded-full border-2 border-blue-400 animate-pulse"></div>' : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

export const MapCanvas = memo(() => {
  const { drivers, selectedId, setSelectedId, mapRef } = useContext(FleetMapContext);

  const handleMarkerClick = (id: string) => {
    setSelectedId(id);
    const driver = drivers.find(d => d.id === id);
    if (driver && mapRef.current) {
      mapRef.current.flyTo([driver.lat, driver.lng], 14, { duration: 0.6 });
    }
  };

  return (
    <MapContainer
      ref={mapRef}
      center={[0, 0]}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='© OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {drivers.map(driver => (
        <Marker
          key={driver.id}
          position={[driver.lat, driver.lng]}
          icon={createIcon(driver.status === 'online' ? 'green' : 'gray', driver.id === selectedId)}
          eventHandlers={{ click: () => handleMarkerClick(driver.id) }}
        >
          <Popup>
            <div className="text-sm">
              <strong>{driver.name}</strong>
              <br />
              {driver.vehicle_type} • {driver.speed} km/h
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
});
