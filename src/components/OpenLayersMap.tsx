import { useEffect, useRef } from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import { Style, Icon } from 'ol/style';
import Overlay from 'ol/Overlay';
import 'ol/ol.css';

interface Store {
  id: string;
  name: string;
  store_type: string;
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  phone: string | null;
  url: string;
  source: string;
  place_id: string;
  openingHours: any[];
}

interface OpenLayersMapProps {
  stores: Store[];
  highlightedStoreId?: string;
  onStoreHover?: (storeId: string | null) => void;
}

export function OpenLayersMap({ stores, highlightedStoreId, onStoreHover }: OpenLayersMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Map | null>(null);
  const overlayInstanceRef = useRef<Overlay | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default center - Frankfurt coordinates
    const defaultCenter = fromLonLat([8.6821, 50.1109]);
    
    // Calculate center if we have stores
    const getMapCenter = () => {
      if (stores.length === 0) return defaultCenter;
      
      const avgLng = stores.reduce((sum, store) => sum + store.longitude, 0) / stores.length;
      const avgLat = stores.reduce((sum, store) => sum + store.latitude, 0) / stores.length;
      
      return fromLonLat([avgLng, avgLat]);
    };

    // Create popup overlay
    const overlay = new Overlay({
      element: overlayRef.current!,
      autoPan: {
        animation: {
          duration: 250,
        },
      },
    });
    overlayInstanceRef.current = overlay;

    // Create vector layer for markers
    const vectorSource = new VectorSource();
    
    stores.forEach((store) => {
      const marker = new Feature({
        geometry: new Point(fromLonLat([store.longitude, store.latitude])),
        store: store,
      });

      marker.setStyle(
        new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml;base64,' + btoa(`
              <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                <path fill="#3B82F6" stroke="#1E40AF" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
                <circle fill="white" cx="12.5" cy="12.5" r="6"/>
              </svg>
            `),
            scale: 1,
          }),
        })
      );

      vectorSource.addFeature(marker);
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    // Create map
    const map = new Map({
      target: mapRef.current,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        vectorLayer,
      ],
      overlays: [overlay],
      view: new View({
        center: getMapCenter(),
        zoom: stores.length > 0 ? 13 : 10,
      }),
    });

    mapInstanceRef.current = map;

    // Handle click events
    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
      
      if (feature) {
        const store = feature.get('store') as Store;
        const coordinate = evt.coordinate;
        
        // Show popup
        overlay.setPosition(coordinate);
        
        // Update popup content
        if (overlayRef.current) {
          overlayRef.current.innerHTML = `
            <div class="bg-white p-3 rounded-lg shadow-lg border min-w-[200px]">
              <h3 class="font-semibold text-sm mb-1">${store.name}</h3>
              <p class="text-xs text-gray-600 mb-1">${store.address}</p>
              <p class="text-xs text-gray-600 mb-2">
                ${store.distance.toFixed(1)} km away
              </p>
              ${store.phone ? `<p class="text-xs text-gray-600">📞 ${store.phone}</p>` : ''}
            </div>
          `;
        }
      } else {
        overlay.setPosition(undefined);
      }
    });

    // Handle hover events
    map.on('pointermove', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
      
      if (feature) {
        const store = feature.get('store') as Store;
        onStoreHover?.(store.id);
        const target = map.getTarget() as HTMLElement;
        if (target) target.style.cursor = 'pointer';
      } else {
        onStoreHover?.(null);
        const target = map.getTarget() as HTMLElement;
        if (target) target.style.cursor = '';
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined);
      }
    };
  }, [stores, onStoreHover]);

  // Handle highlighted store
  useEffect(() => {
    if (!mapInstanceRef.current || !highlightedStoreId) return;

    const vectorLayer = mapInstanceRef.current.getLayers().getArray()[1] as VectorLayer<VectorSource>;
    const source = vectorLayer.getSource();
    
    source?.forEachFeature((feature) => {
      const store = feature.get('store') as Store;
      const isHighlighted = store.id === highlightedStoreId;
      
      feature.setStyle(
        new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml;base64,' + btoa(`
              <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                <path fill="${isHighlighted ? '#EF4444' : '#3B82F6'}" stroke="${isHighlighted ? '#DC2626' : '#1E40AF'}" stroke-width="2" d="M12.5 0C5.6 0 0 5.6 0 12.5c0 12.5 12.5 28.5 12.5 28.5s12.5-16 12.5-28.5C25 5.6 19.4 0 12.5 0z"/>
                <circle fill="white" cx="12.5" cy="12.5" r="6"/>
              </svg>
            `),
            scale: isHighlighted ? 1.2 : 1,
          }),
        })
      );
    });
  }, [highlightedStoreId]);

  return (
    <div className="h-full w-full rounded-lg overflow-hidden shadow-lg relative">
      <div ref={mapRef} className="h-full w-full" />
      <div ref={overlayRef} className="absolute pointer-events-none" />
    </div>
  );
}