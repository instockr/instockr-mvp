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

// Helper to build simple, individual Overpass queries with result limit
function buildSimpleOverpassQuery(category: string, userLat: number, userLng: number, radiusMeters: number) {
  const queryRadius = Math.min(radiusMeters, 3000); // Max 3km for Overpass query
  
  if (category === 'shop=*') {
    return `[out:json][limit:30]; (
      node["shop"](around:${queryRadius},${userLat},${userLng});
      way["shop"](around:${queryRadius},${userLat},${userLng});
    ); out center tags;`;
  }
  
  const [key, value] = category.includes('=') ? category.split('=') : [category, ''];
  return `[out:json][limit:30]; (
    node["${key}"${value ? `="${value}"` : ''}](around:${queryRadius},${userLat},${userLng});
    way["${key}"${value ? `="${value}"` : ''}](around:${queryRadius},${userLat},${userLng});
  ); out center tags;`;
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

    console.log('Received request with coordinates:', { userLat, userLng, radius });
    console.log('Categories:', categories);
    console.log('⏱️ Backend search started at:', new Date().toISOString());

    if (userLat == null || userLng == null || !categories || categories.length === 0 || radius == null) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: userLat, userLng, categories' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const storeCategories = Array.isArray(categories) ? categories : [categories];

    // Make parallel queries for each category (much faster than one complex query)
    console.log('🌐 Starting parallel Overpass queries at:', new Date().toISOString());
    const queryStart = Date.now();
    
    const queryPromises = storeCategories.map(async (category, index) => {
      const query = buildSimpleOverpassQuery(category, userLat, userLng, radius);
      console.log(`Query ${index + 1} for ${category}:`, query);
      
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'InStockr-App/1.0 (store-locator)'
          },
          body: query,
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
          console.error(`Query ${index + 1} failed with status:`, response.status);
          // Try alternative server for this specific query
          const altResponse = await fetch('https://overpass.kumi.systems/api/interpreter', {
            method: 'POST',
            headers: {
              'Content-Type': 'text/plain',
              'User-Agent': 'InStockr-App/1.0 (store-locator)'
            },
            body: query,
            signal: AbortSignal.timeout(6000)
          });
          
          if (altResponse.ok) {
            console.log(`Query ${index + 1} succeeded on alternative server`);
            return await altResponse.json();
          } else {
            console.error(`Query ${index + 1} failed on both servers`);
            return { elements: [] };
          }
        }

        const data = await response.json();
        console.log(`✅ Query ${index + 1} completed with ${data.elements?.length || 0} results`);
        return data;
      } catch (error) {
        console.error(`Query ${index + 1} error:`, error);
        return { elements: [] };
      }
    });

    // Wait for all queries to complete
    const queryResults = await Promise.all(queryPromises);
    const queryEnd = Date.now();
    console.log('✅ All parallel queries completed in:', (queryEnd - queryStart), 'ms');
    
    // Combine all results
    const combinedData = {
      elements: queryResults.flatMap(result => result.elements || [])
    };
    
    console.log('🔄 Starting data processing with', combinedData.elements.length, 'total elements');
    return processOverpassData(combinedData, userLat, userLng, radius);

  } catch (error) {
    console.error('Error in search-osm-stores:', error);
    console.error('Error details:', error.message, error.stack);
    return new Response(
      JSON.stringify({ 
        error: `Search failed: ${error.message}. Details: ${error.stack?.slice(0, 200)}`,
        stores: [],
        totalResults: 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Extract data processing into separate function
async function processOverpassData(data: any, userLat: number, userLng: number, radius: number) {
  let results: Store[] = [];

  for (const element of data.elements || []) {
    const lat = element.lat || element.center?.lat;
    const lon = element.lon || element.center?.lon;
    if (!lat || !lon || !element.tags?.name) continue;

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
      distance: 0, // Will be calculated on frontend
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

  console.log(`Found ${uniqueResults.length} stores within ${radius/1000}km`);

  return new Response(
    JSON.stringify({ stores: uniqueResults, totalResults: uniqueResults.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
