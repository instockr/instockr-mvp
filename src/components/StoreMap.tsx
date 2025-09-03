import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StoreInterface } from './ProductSearch';

// Fix for default markers in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

// Create default icon
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Set as default
L.Marker.prototype.options.icon = DefaultIcon;

interface StoreMapProps {
  stores: StoreInterface[];
  highlightedStoreId?: string;
  onStoreHover?: (storeId: string | null) => void;
}

export function StoreMap({ stores, highlightedStoreId, onStoreHover }: StoreMapProps) {
  // Default center - Frankfurt coordinates
  const defaultCenter: [number, number] = [50.1109, 8.6821];
  
  // Calculate center if we have stores
  const getMapCenter = (): [number, number] => {
    if (stores.length === 0) return defaultCenter;
    
    const avgLat = stores.reduce((sum, store) => sum + store.latitude, 0) / stores.length;
    const avgLng = stores.reduce((sum, store) => sum + store.longitude, 0) / stores.length;
    
    return [avgLat, avgLng];
  };

  return (
    <div className="h-full w-full rounded-lg overflow-hidden shadow-lg">
      <MapContainer
        center={getMapCenter()}
        zoom={stores.length > 0 ? 13 : 10}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {stores.map((store) => (
          <Marker
            key={store.id}
            position={[store.latitude, store.longitude]}
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