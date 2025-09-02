// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface Store {
  id: string;
  name: string;
  store_type: string;
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  phone: string | null;
  url: string | null;
  source: string;
  place_id: string;
  openingHours: string[];
}

// Helper
function buildOverpassQuery(categories: string[], userLat: number, userLng: number, radiusMeters: number) {
  const blocks = categories.map(category => {
    if (category === 'shop=*') {
      return `
        node["shop"](around:${radiusMeters},${userLat},${userLng});
        way["shop"](around:${radiusMeters},${userLat},${userLng});
        relation["shop"](around:${radiusMeters},${userLat},${userLng});
      `;
    }
    const [key, value] = category.includes('=') ? category.split('=') : [category, ''];
    return `
      node["${key}"${value ? `="${value}"` : ''}](around:${radiusMeters},${userLat},${userLng});
      way["${key}"${value ? `="${value}"` : ''}](around:${radiusMeters},${userLat},${userLng});
      relation["${key}"${value ? `="${value}"` : ''}](around:${radiusMeters},${userLat},${userLng});
    `;
  });

  return `[out:json][timeout:25]; (${blocks.join('\n')}); out center tags;`;
}

async function reverseGeocode(
  lat: number,
  lon: number,
  storeName?: string
): Promise<string> {
  try {
    // Build Nominatim API URL
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=en`;

    // Create a timeout in case Nominatim is slow
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), 2000) // 2 seconds
    );

    const fetchPromise = fetch(url, {
      headers: {
        'User-Agent': 'InStockr-App/1.0 (store-locator)' // required by Nominatim
      }
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.display_name) {
      // Take first 3–4 parts for a short address
      const parts = data.display_name.split(', ');
      return parts.slice(0, Math.min(4, parts.length)).join(', ');
    }

    return `Location: ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  } catch (error) {
    console.error(`Reverse geocoding failed for ${storeName || 'unknown'}:`, error.message);
    return `Location: ${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }
}

/**
 * Deduplicate stores by normalized address (and keep first occurrence).
 */
function normalizeAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');
}

function deduplicateStores(stores: Store[], maxResults = 50): Store[] {
  const seenAddresses = new Set<string>();
  const deduplicatedStores: Store[] = [];

  for (const store of stores) {
    if (deduplicatedStores.length >= maxResults) break;

    if (!store.address) {
      deduplicatedStores.push(store);
      continue;
    }

    const normalizedAddress = normalizeAddress(store.address);

    if (seenAddresses.has(normalizedAddress)) {
      // skip duplicate
      continue;
    }

    seenAddresses.add(normalizedAddress);
    deduplicatedStores.push(store);
  }

  // sort by distance
  return deduplicatedStores.sort((a, b) => a.distance - b.distance);
}


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { userLat, userLng, radius, categories } = await req.json();

    console.log(req)

    if (userLat == null || userLng == null || !categories || categories.length === 0 || radius == null) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: userLat, userLng, categories' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storeCategories = Array.isArray(categories) ? categories : [categories];

    // Build a single Overpass query for all categories
    const overpassQuery = buildOverpassQuery(storeCategories, userLat, userLng, radius);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'InStockr-App/1.0 (store-locator)'
      },
      body: overpassQuery,
      signal: AbortSignal.timeout(30000) // 30s timeout for multiple categories
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Overpass API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    let results: Store[] = [];

    for (const element of data.elements || []) {
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      if (!lat || !lon || !element.tags?.name) continue;

      // Haversine distance
      const lat1 = userLat * Math.PI / 180;
      const lat2 = lat * Math.PI / 180;
      const deltaLat = (lat - userLat) * Math.PI / 180;
      const deltaLng = (lon - userLng) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371 * c; // km
      if (distance > radius) continue;

      // Address
      let address = 'Address not available';
      const addrTags = element.tags;
      if (addrTags) {
        const addressParts: string[] = [];
        if (addrTags['addr:housenumber'] && addrTags['addr:street']) {
          addressParts.push(`${addrTags['addr:housenumber']} ${addrTags['addr:street']}`);
        } else if (addrTags['addr:street']) {
          addressParts.push(addrTags['addr:street']);
        }
        if (addrTags['addr:city']) addressParts.push(addrTags['addr:city']);
        if (addrTags['addr:postcode']) addressParts.push(addrTags['addr:postcode']);
        if (addressParts.length > 0) address = addressParts.join(', ');
      }

      if (address === 'Address not available' || address.length < 5) {
        address = await reverseGeocode(lat, lon, element.tags.name);
      }

      const storeType = element.tags.shop || element.tags['amenity'] || 'unknown';

      results.push({
        id: `osm-${element.type}-${element.id}`,
        name: element.tags.name,
        store_type: storeType,
        address,
        distance: Math.round(distance * 100) / 100,
        latitude: lat,
        longitude: lon,
        phone: element.tags.phone || element.tags['contact:phone'] || null,
        url: element.tags.website || element.tags['contact:website'] || null,
        source: 'OpenStreetMap',
        place_id: `osm-${element.type}-${element.id}`,
        openingHours: element.tags.opening_hours ? [element.tags.opening_hours] : [],
      });
    }

    const uniqueResults = deduplicateStores(results, 50);
    uniqueResults.sort((a, b) => a.distance - b.distance);

    return new Response(
      JSON.stringify({ stores: uniqueResults, totalResults: uniqueResults.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-osm-stores:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
