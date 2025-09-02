import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StoreInterface } from './ProductSearch';

// Fix for default markers in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.divIcon({
  html: `<div class="w-6 h-6 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center">
    <div class="w-3 h-3 bg-white rounded-full"></div>
  </div>`,
  className: 'custom-div-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

let HighlightedIcon = L.divIcon({
  html: `<div class="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-xl flex items-center justify-center animate-pulse">
    <div class="w-4 h-4 bg-white rounded-full"></div>
  </div>`,
  className: 'custom-div-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface StoreMapProps {
  stores: StoreInterface[];
  highlightedStoreId?: string;
  onStoreHover?: (storeId: string | null) => void;
}

export function StoreMap({ stores, highlightedStoreId, onStoreHover }: StoreMapProps) {
  const mapRef = useRef<L.Map>(null);

  // Calculate center and bounds for the map
  const getMapCenter = () => {
    if (stores.length === 0) return [40.7128, -74.0060]; // Default to NYC
    
    const avgLat = stores.reduce((sum, store) => sum + store.latitude, 0) / stores.length;
    const avgLng = stores.reduce((sum, store) => sum + store.longitude, 0) / stores.length;
    
    return [avgLat, avgLng];
  };

  const getMapBounds = () => {
    if (stores.length === 0) return undefined;
    
    const bounds = L.latLngBounds(
      stores.map(store => [store.latitude, store.longitude])
    );
    
    // Add some padding
    return bounds.pad(0.1);
  };

  useEffect(() => {
    if (mapRef.current && stores.length > 0) {
      const bounds = getMapBounds();
      if (bounds) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [stores]);

  return (
    <div className="h-full w-full rounded-lg overflow-hidden shadow-lg">
      <MapContainer
        ref={mapRef}
        center={getMapCenter() as [number, number]}
        zoom={13}
        className="h-full w-full z-0"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {stores.map((store) => (
          <Marker
            key={store.id}
            position={[store.latitude, store.longitude]}
            icon={highlightedStoreId === store.id ? HighlightedIcon : DefaultIcon}
            eventHandlers={{
              mouseover: () => onStoreHover?.(store.id),
              mouseout: () => onStoreHover?.(null),
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-sm mb-1">{store.name}</h3>
                <p className="text-xs text-muted-foreground mb-1">{store.address}</p>
                <p className="text-xs text-muted-foreground mb-2">
                  {store.distance.toFixed(1)} km away
                </p>
                {store.phone && (
                  <p className="text-xs text-muted-foreground">📞 {store.phone}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}