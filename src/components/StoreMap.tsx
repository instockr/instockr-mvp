import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StoreInterface } from './ProductSearch';

// Fix for default markers in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

// Create proper default icon
let DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Create highlighted icon (red version) - using a simple red marker SVG
let HighlightedIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iNDEiIHZpZXdCb3g9IjAgMCAyNSA0MSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHA+YXRoIGQ9Ik0xMi41IDBDNS41OTY0NCAwIDAgNS41OTY0NCAwIDEyLjVDMCAyMi41IDEyLjUgNDEgMTIuNSA0MUMyNS4wIDQxIDI1IDIyLjUgMjUgMTIuNUMyNSA1LjU5NjQ0IDE5LjQwMzYgMCAxMi41IDBaIiBmaWxsPSIjZWY0NDQ0Ii8+CjxjaXJjbGUgY3g9IjEyLjUiIGN5PSIxMi41IiByPSI3IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Set default icon for all markers
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