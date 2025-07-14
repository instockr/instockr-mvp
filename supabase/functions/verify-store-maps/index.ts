import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StoreVerificationRequest {
  storeName: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

interface StoreVerificationResult {
  verified: boolean;
  isOpen?: boolean;
  openingHours?: string[];
  googlePlaceId?: string;
  rating?: number;
  userRatingsTotal?: number;
  photoUrl?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, address, latitude, longitude }: StoreVerificationRequest = await req.json();
    
    const googleMapsApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    console.log(`Verifying store: ${storeName} at ${address}`);

    // First, try to find the place using text search
    const searchQuery = `${storeName} ${address}`;
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${googleMapsApiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' || !searchData.results || searchData.results.length === 0) {
      console.log(`No results found for: ${searchQuery}`);
      return new Response(JSON.stringify({
        verified: false
      } as StoreVerificationResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the first result (most relevant)
    const place = searchData.results[0];
    const placeId = place.place_id;

    console.log(`Found place: ${place.name} with ID: ${placeId}`);

    // Get detailed place information including opening hours and photos
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,opening_hours,rating,user_ratings_total,photos&key=${googleMapsApiKey}`;
    
    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK') {
      console.log(`Failed to get place details for ID: ${placeId}`);
      return new Response(JSON.stringify({
        verified: true,
        googlePlaceId: placeId,
        rating: place.rating,
        userRatingsTotal: place.user_ratings_total
      } as StoreVerificationResult), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const placeDetails = detailsData.result;
    const openingHours = placeDetails.opening_hours;

    // Get the first photo if available
    let photoUrl = '';
    if (placeDetails.photos && placeDetails.photos.length > 0) {
      const photoReference = placeDetails.photos[0].photo_reference;
      photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photoReference}&key=${googleMapsApiKey}`;
    }

    const result: StoreVerificationResult = {
      verified: true,
      googlePlaceId: placeId,
      rating: placeDetails.rating,
      userRatingsTotal: placeDetails.user_ratings_total,
      openingHours: openingHours?.weekday_text,
      isOpen: openingHours?.open_now,
      photoUrl: photoUrl || undefined
    };

    console.log(`Store verification result:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in verify-store-maps function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      verified: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});