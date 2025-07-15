import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    // Use Google Places API autocomplete for location suggestions
    const autocompleteUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    autocompleteUrl.searchParams.set('input', input.trim());
    autocompleteUrl.searchParams.set('types', '(cities)'); // Focus on cities
    autocompleteUrl.searchParams.set('key', apiKey);

    console.log('Fetching autocomplete suggestions for:', input);
    
    const response = await fetch(autocompleteUrl.toString());
    const data = await response.json();

    if (data.status === 'OK') {
      console.log(`Found ${data.predictions?.length || 0} autocomplete predictions`);
      return new Response(JSON.stringify({ 
        predictions: data.predictions || [],
        status: 'OK'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.error('Google Places API error:', data.status, data.error_message);
      return new Response(JSON.stringify({ 
        predictions: [],
        status: data.status,
        error: data.error_message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in google-places-autocomplete function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      predictions: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});