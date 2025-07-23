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
    const { productName, userLat, userLng, radius = 50, location, searchTerms } = await req.json();

    if (!productName || !userLat || !userLng) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: productName, userLat, userLng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching OpenStreetMap for:', productName, 'near', userLat, userLng);

    // Use AI to determine the best shop categories for the product
    let storeCategories: string[] = [];
    
    try {
      console.log('Using AI to match product categories for:', productName);
      const categoryResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-category-matcher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
        },
        body: JSON.stringify({ productName })
      });

      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        storeCategories = categoryData.categories || [];
        console.log('AI-selected categories:', storeCategories);
      } else {
        console.log('AI category matching failed, using fallback');
        storeCategories = getFallbackCategories(productName);
      }
    } catch (error) {
      console.error('Error calling AI category matcher:', error);
      storeCategories = getFallbackCategories(productName);
    }

    if (storeCategories.length === 0) {
      console.log('No categories found, using default fallback');
      storeCategories = ['shop=electronics', 'shop=general', 'shop=department_store'];
    }

    console.log('Final OSM categories to search:', storeCategories);

    const results = [];
    const radiusMeters = radius * 1000;

    // Search for each store category using Overpass API
    for (const category of storeCategories) {
      try {
        console.log(`Searching OSM for category: ${category}`);
        // Build Overpass query for stores in the area
        let overpassQuery;
        if (category === 'shop=*') {
          // Special query for any shop
          overpassQuery = `
            [out:json][timeout:25];
            (
              node["shop"](around:${radiusMeters},${userLat},${userLng});
              way["shop"](around:${radiusMeters},${userLat},${userLng});
              relation["shop"](around:${radiusMeters},${userLat},${userLng});
            );
            out center tags;
          `;
        } else {
          // Parse the category to extract key and value (e.g., "shop=mobile_phone" -> key="shop", value="mobile_phone")
          const [key, value] = category.includes('=') ? category.split('=') : [category, ''];
          
          if (value) {
            overpassQuery = `
              [out:json][timeout:25];
              (
                node["${key}"="#{value}"](around:${radiusMeters},${userLat},${userLng});
                way["${key}"="#{value}"](around:${radiusMeters},${userLat},${userLng});
                relation["${key}"="#{value}"](around:${radiusMeters},${userLat},${userLng});
              );
              out center tags;
            `.replace(/#{value}/g, value);
          } else {
            overpassQuery = `
              [out:json][timeout:25];
              (
                node["${key}"](around:${radiusMeters},${userLat},${userLng});
                way["${key}"](around:${radiusMeters},${userLat},${userLng});
                relation["${key}"](around:${radiusMeters},${userLat},${userLng});
              );
              out center tags;
            `;
          }
        }
        
        console.log(`Overpass query: ${overpassQuery.trim()}`);

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
        console.log(`OSM response for ${category}:`, JSON.stringify(data, null, 2));
        
        if (data.elements && Array.isArray(data.elements)) {
          console.log(`Found ${data.elements.length} elements for ${category}`);
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

    console.log(`Found ${results.length} results from OverPass API`);

    // Remove duplicates based on name and location proximity
    const uniqueResults = [];
    const seenStores = new Set();

    for (const store of results) {
      // Limit to 50 results to prevent frontend crashes
      if (uniqueResults.length >= 50) break;
      
      const key = `${store.name}-${Math.round(store.latitude * 1000)}-${Math.round(store.longitude * 1000)}`;
      if (!seenStores.has(key)) {
        seenStores.add(key);
        uniqueResults.push(store);
      }
    }

    // Sort by distance
    uniqueResults.sort((a, b) => a.distance - b.distance);

    console.log(`Found ${uniqueResults.length} total results (OpenStreetMap + OpenCorporates)`);

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

function mapTermsToOSMCategories(searchTerms: string[]): string[] {
  const osmCategories: string[] = [];
  
  for (const term of searchTerms) {
    const lowerTerm = term.toLowerCase();
    
    // If the term is already in OSM format (shop=X or amenity=X), use it directly
    if (lowerTerm.includes('shop=') || lowerTerm.includes('amenity=')) {
      osmCategories.push(term);
      continue;
    }
    
    // Electronics & Technology
    if (lowerTerm.includes('elektronik') || lowerTerm.includes('elettronica') || 
        lowerTerm.includes('électronique') || lowerTerm.includes('electrónica') || 
        lowerTerm.includes('electronics')) {
      osmCategories.push('shop=electronics');
    }
    
    if (lowerTerm.includes('handyladen') || lowerTerm.includes('telefonia') || 
        lowerTerm.includes('téléphonie') || lowerTerm.includes('telefonía') || 
        lowerTerm.includes('mobile')) {
      osmCategories.push('shop=mobile_phone');
    }
    
    if (lowerTerm.includes('computer') || lowerTerm.includes('informatica') || 
        lowerTerm.includes('informatique') || lowerTerm.includes('informática')) {
      osmCategories.push('shop=computer');
    }
    
    // Hardware & Tools  
    if (lowerTerm.includes('baumarkt') || lowerTerm.includes('ferramenta') || 
        lowerTerm.includes('quincaillerie') || lowerTerm.includes('ferretería') || 
        lowerTerm.includes('hardware')) {
      osmCategories.push('shop=hardware');
      osmCategories.push('shop=doityourself');
    }
    
    if (lowerTerm.includes('eisenwaren') || lowerTerm.includes('bricolage') || 
        lowerTerm.includes('bricolaje') || lowerTerm.includes('tools') || 
        lowerTerm.includes('werkzeug') || lowerTerm.includes('outillage') || 
        lowerTerm.includes('herramientas')) {
      osmCategories.push('shop=hardware');
    }
    
    // Health & Medicine
    if (lowerTerm.includes('apotheke') || lowerTerm.includes('farmacia') || 
        lowerTerm.includes('pharmacie') || lowerTerm.includes('pharmacy')) {
      osmCategories.push('shop=pharmacy');
      osmCategories.push('amenity=pharmacy');
    }
    
    if (lowerTerm.includes('drogerie') || lowerTerm.includes('parafarmacia') || 
        lowerTerm.includes('parapharmacie') || lowerTerm.includes('drugstore')) {
      osmCategories.push('shop=chemist');
    }
    
    // Books & Stationery
    if (lowerTerm.includes('buchhandlung') || lowerTerm.includes('libreria') || 
        lowerTerm.includes('librairie') || lowerTerm.includes('librería') || 
        lowerTerm.includes('bookstore')) {
      osmCategories.push('shop=books');
    }
    
    if (lowerTerm.includes('schreibwaren') || lowerTerm.includes('cartoleria') || 
        lowerTerm.includes('papeterie') || lowerTerm.includes('papelería') || 
        lowerTerm.includes('stationery')) {
      osmCategories.push('shop=stationery');
    }
    
    // Food & Groceries
    if (lowerTerm.includes('supermarkt') || lowerTerm.includes('supermercato') || 
        lowerTerm.includes('supermarché') || lowerTerm.includes('supermercado') || 
        lowerTerm.includes('supermarket') || lowerTerm.includes('grocery')) {
      osmCategories.push('shop=supermarket');
    }
    
    if (lowerTerm.includes('lebensmittel') || lowerTerm.includes('alimentari') || 
        lowerTerm.includes('alimentation') || lowerTerm.includes('alimentación')) {
      osmCategories.push('shop=convenience');
    }
  }
  
  // Fallback: if no categories found, add some general ones
  if (osmCategories.length === 0) {
    osmCategories.push('shop=general', 'shop=variety_store');
  }
  
  // Remove duplicates and return
  return [...new Set(osmCategories)];
}

function getFallbackCategories(productName: string): string[] {
  const lowerProduct = productName.toLowerCase();
  const categories: string[] = [];
  
  // Electronics
  if (lowerProduct.includes('phone') || lowerProduct.includes('iphone') || lowerProduct.includes('samsung')) {
    categories.push('shop=mobile_phone');
  }
  if (lowerProduct.includes('laptop') || lowerProduct.includes('computer') || lowerProduct.includes('pc')) {
    categories.push('shop=computer');
  }
  if (lowerProduct.includes('electronics') || lowerProduct.includes('gadget')) {
    categories.push('shop=electronics');
  }
  
  // Always add some broad categories as fallback
  if (categories.length === 0) {
    categories.push('shop=electronics', 'shop=general', 'shop=department_store');
  }
  
  return categories;
}