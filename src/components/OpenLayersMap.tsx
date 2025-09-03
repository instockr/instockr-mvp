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
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLocationRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        },
        (error) => {
          console.log('Geolocation error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    // Default center - Frankfurt coordinates
    const defaultCenter = fromLonLat([8.6821, 50.1109]);
    
    // Calculate center - prioritize user location, then stores
    const getMapCenter = () => {
      // If we have user location, center on that
      if (userLocationRef.current) {
        return fromLonLat([userLocationRef.current.lng, userLocationRef.current.lat]);
      }
      // Otherwise, center on stores if available
      if (stores.length > 0) {
        const avgLng = stores.reduce((sum, store) => sum + store.longitude, 0) / stores.length;
        const avgLat = stores.reduce((sum, store) => sum + store.latitude, 0) / stores.length;
        return fromLonLat([avgLng, avgLat]);
      }
      // Default to Frankfurt
      return defaultCenter;
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

    // Create vector layer for markers
    const vectorSource = new VectorSource();
    
    // Add store markers
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
              <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path fill="#3B82F6" stroke="#1E40AF" stroke-width="2" d="M12 0C5.4 0 0 5.4 0 12c0 12 12 24 12 24s12-12 12-24C24 5.4 18.6 0 12 0z"/>
                <circle fill="white" cx="12" cy="12" r="6"/>
                <circle fill="#1E40AF" cx="12" cy="12" r="3"/>
              </svg>
            `),
            scale: 1,
          }),
        })
      );

      vectorSource.addFeature(marker);
    });

    // Add user location marker if we have it
    if (userLocationRef.current) {
      const userMarker = new Feature({
        geometry: new Point(fromLonLat([userLocationRef.current.lng, userLocationRef.current.lat])),
        isUserLocation: true,
      });

      userMarker.setStyle(
        new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml;base64,' + btoa(`
              <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path fill="#10B981" stroke="#059669" stroke-width="2" d="M12 0C5.4 0 0 5.4 0 12c0 12 12 24 12 24s12-12 12-24C24 5.4 18.6 0 12 0z"/>
                <circle fill="white" cx="12" cy="12" r="6"/>
                <circle fill="#059669" cx="12" cy="12" r="3">
                  <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
                </circle>
              </svg>
            `),
            scale: 1.1,
          }),
        })
      );

      vectorSource.addFeature(userMarker);
    }

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
        zoom: userLocationRef.current ? 14 : (stores.length > 0 ? 13 : 10),
      }),
    });

    mapInstanceRef.current = map;

    // Handle click events
    map.on('click', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (feature) => feature);
      
      if (feature && !feature.get('isUserLocation')) {
        const store = feature.get('store') as Store;
        const coordinate = evt.coordinate;
        
        // Show popup
        overlay.setPosition(coordinate);
        
        // Update popup content
        if (overlayRef.current) {
          overlayRef.current.innerHTML = `
            <div class="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-gray-200 min-w-[220px] max-w-[280px] relative">
              <div class="absolute -top-2 left-6 w-4 h-4 bg-white/95 backdrop-blur-sm border-l border-t border-gray-200 rotate-45"></div>
              <div class="space-y-2">
                <h3 class="font-semibold text-base text-gray-900 leading-tight">${store.name}</h3>
                <div class="flex items-start gap-2 text-sm text-gray-600">
                  <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                  </svg>
                  <span class="leading-tight">${store.address}</span>
                </div>
                <div class="flex items-center gap-2 text-sm font-medium text-blue-600">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  <span>${store.distance.toFixed(1)} km away</span>
                </div>
                ${store.phone ? `
                  <div class="flex items-center gap-2 text-sm text-gray-600 pt-1 border-t border-gray-100">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span>${store.phone}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }
      } else if (feature && feature.get('isUserLocation')) {
        const coordinate = evt.coordinate;
        
        // Show user location popup
        overlay.setPosition(coordinate);
        
        if (overlayRef.current) {
          overlayRef.current.innerHTML = `
            <div class="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-2xl border border-green-200 min-w-[180px] relative">
              <div class="absolute -top-2 left-6 w-4 h-4 bg-white/95 backdrop-blur-sm border-l border-t border-green-200 rotate-45"></div>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <h3 class="font-semibold text-base text-green-800">Your Location</h3>
                </div>
                <p class="text-sm text-green-600">You are here</p>
              </div>
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
      
      if (feature && !feature.get('isUserLocation')) {
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
      
      // Skip non-store features (like user location marker)
      if (!store) return;
      
      const isHighlighted = store.id === highlightedStoreId;
      
      feature.setStyle(
        new Style({
          image: new Icon({
            anchor: [0.5, 1],
            src: 'data:image/svg+xml;base64=' + btoa(`
              <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path fill="${isHighlighted ? '#EF4444' : '#3B82F6'}" stroke="${isHighlighted ? '#DC2626' : '#1E40AF'}" stroke-width="2" d="M12 0C5.4 0 0 5.4 0 12c0 12 12 24 12 24s12-12 12-24C24 5.4 18.6 0 12 0z"/>
                <circle fill="white" cx="12" cy="12" r="6"/>
                <circle fill="${isHighlighted ? '#DC2626' : '#1E40AF'}" cx="12" cy="12" r="3"/>
              </svg>
            `),
            scale: isHighlighted ? 1.2 : 1,
          }),
        })
      );
    });
  }, [highlightedStoreId]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden shadow-xl border border-border/20 bg-gradient-to-br from-background to-muted/20 relative">
      <div ref={mapRef} className="h-full w-full" />
      <div ref={overlayRef} className="absolute pointer-events-none" />
      
      {/* Map overlay gradient for better visual depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/5 via-transparent to-transparent" />
      
      {/* Stylish corner badge */}
      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground border border-border/40 shadow-sm">
        {stores.length} {stores.length === 1 ? 'store' : 'stores'}
      </div>
    </div>
  );
}
