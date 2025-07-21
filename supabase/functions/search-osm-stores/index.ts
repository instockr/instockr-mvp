import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName, userLat, userLng, radius = 50 } = await req.json();

    if (!productName || !userLat || !userLng) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: productName, userLat, userLng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching OpenStreetMap for:', productName, 'near', userLat, userLng);

    // Define store categories to search for
    const storeCategories = [
      'shop=supermarket',
      'shop=convenience', 
      'shop=department_store',
      'shop=electronics',
      'shop=mobile_phone',
      'shop=computer',
      'shop=hardware',
      'shop=doityourself',
      'shop=pharmacy',
      'shop=chemist',
      'shop=general',
      'shop=variety_store',
      'amenity=pharmacy'
    ];

    const results = [];
    const radiusMeters = radius * 1000;

    // Search for each store category using Overpass API
    for (const category of storeCategories) {
      try {
        // Build Overpass query for stores in the area
        const overpassQuery = `
          [out:json][timeout:25];
          (
            node["${category}"](around:${radiusMeters},${userLat},${userLng});
            way["${category}"](around:${radiusMeters},${userLat},${userLng});
            relation["${category}"](around:${radiusMeters},${userLat},${userLng});
          );
          out center tags;
        `;

        const overpassUrl = 'https://overpass-api.de/api/interpreter';
        const response = await fetch(overpassUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'InStockr-App/1.0 (store-locator)'
          },
          body: overpassQuery
        });

        if (!response.ok) {
          console.log(`Overpass API error for ${category}:`, response.status);
          continue;
        }

        const data = await response.json();
        
        if (data.elements && Array.isArray(data.elements)) {
          for (const element of data.elements) {
            const lat = element.lat || element.center?.lat;
            const lon = element.lon || element.center?.lon;
            
            if (!lat || !lon || !element.tags?.name) continue;

            // Calculate distance using Haversine formula
            const lat1 = userLat * Math.PI / 180;
            const lat2 = lat * Math.PI / 180;
            const deltaLat = (lat - userLat) * Math.PI / 180;
            const deltaLng = (lon - userLng) * Math.PI / 180;

            const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                      Math.cos(lat1) * Math.cos(lat2) *
                      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = 6371 * c; // Earth's radius in km

            // Skip if outside radius
            if (distance > radius) continue;

            // Determine store type
            let storeType = 'retail';
            if (category.includes('electronics') || category.includes('mobile_phone') || category.includes('computer')) {
              storeType = 'electronics';
            } else if (category.includes('supermarket') || category.includes('convenience')) {
              storeType = 'grocery';
            } else if (category.includes('pharmacy') || category.includes('chemist')) {
              storeType = 'pharmacy';
            } else if (category.includes('department_store') || category.includes('hardware') || category.includes('doityourself')) {
              storeType = 'department';
            }

            // Build address from available tags
            let address = 'Address not available';
            const addrTags = element.tags;
            if (addrTags) {
              const addressParts = [];
              if (addrTags['addr:housenumber'] && addrTags['addr:street']) {
                addressParts.push(`${addrTags['addr:housenumber']} ${addrTags['addr:street']}`);
              } else if (addrTags['addr:street']) {
                addressParts.push(addrTags['addr:street']);
              }
              if (addrTags['addr:city']) addressParts.push(addrTags['addr:city']);
              if (addrTags['addr:postcode']) addressParts.push(addrTags['addr:postcode']);
              if (addressParts.length > 0) {
                address = addressParts.join(', ');
              }
            }

            results.push({
              id: `osm-${element.type}-${element.id}`,
              name: element.tags.name,
              store_type: storeType,
              address: address,
              distance: Math.round(distance * 100) / 100,
              latitude: lat,
              longitude: lon,
              phone: element.tags.phone || element.tags['contact:phone'] || null,
              product: {
                name: productName,
                price: 'Contact store for pricing',
                description: `${productName} potentially available`,
                availability: 'Contact store for availability'
              },
              url: element.tags.website || element.tags['contact:website'] || null,
              isOnline: false,
              source: 'OpenStreetMap',
              rating: null,
              userRatingsTotal: null,
              place_id: `osm-${element.type}-${element.id}`,
              photoUrl: undefined,
              isOpen: null,
              openingHours: element.tags.opening_hours ? [element.tags.opening_hours] : []
            });
          }
        }
      } catch (error) {
        console.error(`Error searching category ${category}:`, error);
        continue;
      }
    }

    // Remove duplicates based on name and location proximity
    const uniqueResults = [];
    const seenStores = new Set();

    for (const store of results) {
      const key = `${store.name}-${Math.round(store.latitude * 1000)}-${Math.round(store.longitude * 1000)}`;
      if (!seenStores.has(key)) {
        seenStores.add(key);
        uniqueResults.push(store);
      }
    }

    // Sort by distance
    uniqueResults.sort((a, b) => a.distance - b.distance);

    console.log(`Found ${uniqueResults.length} OpenStreetMap results`);

    return new Response(
      JSON.stringify({
        stores: uniqueResults,
        searchedProduct: productName,
        totalResults: uniqueResults.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-osm-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});