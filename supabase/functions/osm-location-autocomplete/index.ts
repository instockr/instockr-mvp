import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-ignore
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
    const { input } = await req.json();

    if (!input || input.trim().length < 3) {
      return new Response(JSON.stringify({ predictions: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Fetching autocomplete suggestions for:', input);

    // Use Nominatim (OpenStreetMap) for location autocomplete
    const autocompleteUrl = new URL('https://nominatim.openstreetmap.org/search');
    autocompleteUrl.searchParams.set('format', 'json');
    autocompleteUrl.searchParams.set('q', input.trim());
    autocompleteUrl.searchParams.set('limit', '5');
    autocompleteUrl.searchParams.set('addressdetails', '1');
    autocompleteUrl.searchParams.set('extratags', '1');
    // Remove featuretype filter to allow all address types including streets

    const response = await fetch(autocompleteUrl.toString(), {
      headers: {
        'User-Agent': 'InStockr-App/1.0 (store-locator)'
      }
    });

    const data = await response.json();

    if (response.ok && data && Array.isArray(data)) {
      // Transform Nominatim response to match Google Places format
      const predictions = data
        .map(item => {
          // Build display name from address components for all address types
          let displayName = '';
          if (item.address) {
            const parts: String[] = [];
            
            // Add street info if available
            if (item.address.house_number && item.address.road) {
              parts.push(`${item.address.house_number} ${item.address.road}`);
            } else if (item.address.road) {
              parts.push(item.address.road);
            }
            
            // Add area info
            if (item.address.suburb || item.address.city_district) {
              parts.push(item.address.suburb || item.address.city_district);
            }
            
            // Add city info
            if (item.address.city || item.address.town || item.address.village) {
              parts.push(item.address.city || item.address.town || item.address.village);
            }

            if (item.address.state) parts.push(item.address.state);
            if (item.address.country) parts.push(item.address.country);

            displayName = parts.join(', ');
          }

          if (!displayName) {
            displayName = item.display_name;
          }

          return {
            description: displayName,
            place_id: `osm-${item.place_id}`,
            structured_formatting: {
              main_text: item.address?.road || item.address?.city || item.address?.town || item.address?.village || item.name,
              secondary_text: item.address?.city || item.address?.state || item.address?.country || ''
            }
          };
        })
        .slice(0, 5); // Limit to 5 results

      console.log(`Found ${predictions.length} autocomplete predictions`);
      return new Response(JSON.stringify({
        predictions: predictions,
        status: 'OK'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log('No results from Nominatim');
      return new Response(JSON.stringify({
        predictions: [],
        status: 'ZERO_RESULTS'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in osm-location-autocomplete function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      predictions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});