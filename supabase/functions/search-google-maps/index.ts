import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching Google Maps for:', productName, 'near', userLat, userLng);

    // Use Google Maps Places API to search for stores selling the product
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(productName + ' store shop negozio')}&location=${userLat},${userLng}&radius=${radius * 1000}&key=${googleApiKey}`;

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google Maps API error:', await response.text());
      return new Response(
        JSON.stringify({ stores: [], searchedProduct: productName, totalResults: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const results = [];

    if (data.results && Array.isArray(data.results)) {
      // Process results in parallel for better performance
      const processPlace = async (place, index) => {
        if (!place.name || !place.geometry?.location) return null;

        // Calculate distance using Haversine formula
        const lat1 = userLat * Math.PI / 180;
        const lat2 = place.geometry.location.lat * Math.PI / 180;
        const deltaLat = (place.geometry.location.lat - userLat) * Math.PI / 180;
        const deltaLng = (place.geometry.location.lng - userLng) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = 6371 * c; // Earth's radius in km

        // Determine store type
        let storeType = 'retail';
        const types = place.types || [];
        if (types.includes('electronics_store')) {
          storeType = 'electronics';
        } else if (types.includes('home_goods_store') || types.includes('hardware_store')) {
          storeType = 'department';
        } else if (types.includes('pharmacy')) {
          storeType = 'pharmacy';
        } else if (types.includes('grocery_or_supermarket')) {
          storeType = 'grocery';
        }

        // Get photo URL if available
        let photoUrl = '';
        if (place.photos && place.photos.length > 0) {
          const photoReference = place.photos[0].photo_reference;
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${googleApiKey}`;
        }

        console.log('Processing place:', {
          name: place.name,
          place_id: place.place_id,
          hasWebsite: !!place.website
        });

        // Get additional details including website using Place Details API
        let website = null;
        let phone = null;
        try {
          const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=website,formatted_phone_number&key=${googleApiKey}`;
          const detailsResponse = await fetch(detailsUrl);
          const detailsData = await detailsResponse.json();
          
          if (detailsData.status === 'OK' && detailsData.result) {
            website = detailsData.result.website || null;
            phone = detailsData.result.formatted_phone_number || null;
            console.log(`Got details for ${place.name}:`, { website, phone });
          }
        } catch (error) {
          console.error(`Failed to get details for place ${place.name}:`, error);
        }

        return {
          id: `google-maps-${Date.now()}-${index}`,
          name: place.name,
          store_type: storeType,
          address: place.formatted_address || 'Address not available',
          distance: Math.round(distance * 100) / 100,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          phone: phone,
          product: {
            name: productName,
            price: 'Contact store for pricing',
            description: `${productName} potentially available`,
            availability: 'Contact store for availability'
          },
          url: website,
          isOnline: false,
          source: 'Google Maps',
          rating: place.rating || null,
          userRatingsTotal: place.user_ratings_total || null,
          place_id: place.place_id,
          photoUrl: photoUrl || undefined
        };
      };

      // Process all places in parallel
      const processedResults = await Promise.all(
        data.results.map((place, index) => processPlace(place, index))
      );
      
      // Filter out null results
      results.push(...processedResults.filter(result => result !== null));
    }

    console.log(`Found ${results.length} Google Maps results`);

    return new Response(
      JSON.stringify({
        stores: results,
        searchedProduct: productName,
        totalResults: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});