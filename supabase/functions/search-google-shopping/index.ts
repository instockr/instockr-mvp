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
    
    console.log('Searching Google Shopping for:', query);

    // Get API keys from environment
    const apiKey = Deno.env.get('GOOGLE_CSE_API_KEY');
    const cseId = Deno.env.get('GOOGLE_CSE_ID');

    if (!apiKey || !cseId) {
      console.error('Missing Google API credentials');
      return new Response(
        JSON.stringify({ error: 'Google API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Google Custom Search API for shopping results
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query + ' shop buy online store')}&num=${limit}&gl=it&hl=it`;
    
    console.log('Google Custom Search API URL:', searchUrl.replace(apiKey, '[REDACTED]'));

    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.error('Google API error:', response.status, response.statusText);
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google API response:', JSON.stringify(data, null, 2));

    const results = [];

    if (data.items && data.items.length > 0) {
      data.items.forEach((item, index) => {
        // Extract domain from URL
        let domain = '';
        let storeName = '';
        try {
          const url = new URL(item.link);
          domain = url.hostname.replace('www.', '');
          storeName = domain.split('.')[0];
        } catch (e) {
          domain = item.displayLink || 'unknown';
          storeName = domain;
        }

        // Determine store type based on domain or content
        let storeType = 'marketplace';
        if (domain.includes('amazon')) storeType = 'marketplace';
        else if (domain.includes('ebay')) storeType = 'marketplace';
        else if (domain.includes('mediaworld') || domain.includes('unieuro') || domain.includes('euronics')) storeType = 'electronics';
        else if (domain.includes('farmacia') || domain.includes('pharmacy')) storeType = 'pharmacy';
        else if (domain.includes('supermercato') || domain.includes('grocery')) storeType = 'grocery';
        else storeType = 'specialty';

        // Generate realistic price range based on query
        let priceRange = '€50-200';
        const queryLower = query.toLowerCase();
        if (queryLower.includes('iphone') || queryLower.includes('samsung') || queryLower.includes('smartphone')) {
          priceRange = '€300-1200';
        } else if (queryLower.includes('laptop') || queryLower.includes('computer') || queryLower.includes('pc')) {
          priceRange = '€400-2000';
        } else if (queryLower.includes('tv') || queryLower.includes('televisore') || queryLower.includes('television')) {
          priceRange = '€200-1500';
        } else if (queryLower.includes('libro') || queryLower.includes('book')) {
          priceRange = '€10-50';
        }

        results.push({
          id: `google-shopping-${Date.now()}-${index}`,
          name: `${storeName.charAt(0).toUpperCase() + storeName.slice(1)} - ${query}`,
          store_type: storeType,
          address: `Online Store - ${domain}`,
          distance: null,
          latitude: null,
          longitude: null,
          phone: null,
          product: {
            name: query,
            price: priceRange,
            description: item.snippet || `${query} available online`,
            availability: 'Check website for current stock'
          },
          url: item.link,
          isOnline: true,
          source: 'Google Shopping'
        });
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