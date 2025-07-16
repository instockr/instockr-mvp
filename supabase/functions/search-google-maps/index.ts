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
      data.results.forEach((place, index) => {
        if (place.name && place.geometry?.location) {
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
            website: place.website,
            hasWebsite: !!place.website
          });

          results.push({
            id: `google-maps-${Date.now()}-${index}`,
            name: place.name,
            store_type: storeType,
            address: place.formatted_address || 'Address not available',
            distance: Math.round(distance * 100) / 100,
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng,
            phone: null, // Would need Place Details API call for phone
            product: {
              name: productName,
              price: 'Contact store for pricing',
              description: `${productName} potentially available`,
              availability: 'Contact store for availability'
            },
            url: place.website || null,
            isOnline: false,
            source: 'Google Maps',
            rating: place.rating || null,
            userRatingsTotal: place.user_ratings_total || null,
            place_id: place.place_id, // Add place_id for verification object
            photoUrl: photoUrl || undefined // Add photo URL
          });
        }
      });
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