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
              <svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="markerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" />
                  </linearGradient>
                  <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.25"/>
                  </filter>
                </defs>
                <path fill="url(#markerGradient)" stroke="#1E40AF" stroke-width="2" filter="url(#shadow)" d="M16 0C7.2 0 0 7.2 0 16c0 16 16 32 16 32s16-16 16-32C32 7.2 24.8 0 16 0z"/>
                <circle fill="white" cx="16" cy="16" r="8"/>
                <circle fill="#3B82F6" cx="16" cy="16" r="4"/>
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
        
        // Update popup content with enhanced styling
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
            src: 'data:image/svg+xml;base64=' + btoa(`
              <svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="markerGradient${isHighlighted ? 'Highlighted' : ''}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" style="stop-color:${isHighlighted ? '#EF4444' : '#3B82F6'};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${isHighlighted ? '#DC2626' : '#1E40AF'};stop-opacity:1" />
                  </linearGradient>
                  <filter id="shadow${isHighlighted ? 'Highlighted' : ''}" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="${isHighlighted ? '4' : '2'}" stdDeviation="${isHighlighted ? '6' : '3'}" flood-color="#000000" flood-opacity="${isHighlighted ? '0.4' : '0.25'}"/>
                  </filter>
                </defs>
                <path fill="url(#markerGradient${isHighlighted ? 'Highlighted' : ''})" stroke="${isHighlighted ? '#DC2626' : '#1E40AF'}" stroke-width="2" filter="url(#shadow${isHighlighted ? 'Highlighted' : ''})" d="M16 0C7.2 0 0 7.2 0 16c0 16 16 32 16 32s16-16 16-32C32 7.2 24.8 0 16 0z"/>
                <circle fill="white" cx="16" cy="16" r="8"/>
                <circle fill="${isHighlighted ? '#EF4444' : '#3B82F6'}" cx="16" cy="16" r="4">
                  ${isHighlighted ? '<animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite"/>' : ''}
                </circle>
              </svg>
            `),
            scale: isHighlighted ? 1.3 : 1,
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