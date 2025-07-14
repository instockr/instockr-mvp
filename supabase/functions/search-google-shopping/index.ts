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
    const { query, limit = 5 } = await req.json();
    const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching Google Shopping for:', query);

    // Using Google Custom Search API for shopping results - fix the search engine ID
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=004486725648515127932:czqibmg6fks&q=${encodeURIComponent(query)}&gl=it&hl=it&num=${limit}`;

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google Shopping API error:', await response.text());
      return new Response(
        JSON.stringify({ stores: [], searchedProduct: query, totalResults: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const results = [];

    if (data.items && Array.isArray(data.items)) {
      data.items.forEach((item, index) => {
        if (item.title && item.link) {
          // Extract price from snippet or structured data
          let price = 'Contact store for pricing';
          if (item.snippet) {
            const priceRegex = /€[\d.,]+|[\d.,]+\s*€|\$[\d.,]+/g;
            const priceMatch = item.snippet.match(priceRegex);
            if (priceMatch && priceMatch.length > 0) {
              price = priceMatch[0];
            }
          }

          // Determine store type from URL
          let storeType = 'retail';
          const url = item.link.toLowerCase();
          if (url.includes('amazon') || url.includes('ebay') || url.includes('marketplace')) {
            storeType = 'marketplace';
          } else if (url.includes('mediaworld') || url.includes('unieuro') || url.includes('electronics')) {
            storeType = 'electronics';
          }

          results.push({
            id: `google-shopping-${Date.now()}-${index}`,
            name: item.title,
            store_type: storeType,
            address: 'Online / Italy',
            distance: null,
            latitude: null,
            longitude: null,
            phone: null,
            product: {
              name: query,
              price: price,
              description: item.snippet || `${query} available`,
              availability: 'Check website for availability'
            },
            url: item.link,
            isOnline: true,
            source: 'Google Shopping'
          });
        }
      });
    }

    console.log(`Found ${results.length} Google Shopping results`);

    return new Response(
      JSON.stringify({
        stores: results,
        searchedProduct: query,
        totalResults: results.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-google-shopping function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});