import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { productName } = await req.json();

    if (!productName) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Searching online stores for:', productName);

    // Popular online retailers to search
    const searchQueries = [
      `site:amazon.com ${productName}`,
      `site:walmart.com ${productName}`,
      `site:target.com ${productName}`,
      `site:bestbuy.com ${productName}`,
      `site:ebay.com ${productName}`
    ];

    const onlineResults = [];

    for (const query of searchQueries) {
      try {
        // Use Firecrawl's search functionality
        const searchResponse = await fetch('https://api.firecrawl.dev/v0/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            pageOptions: {
              onlyMainContent: true
            },
            extractorOptions: {
              extractionSchema: {
                title: "string",
                price: "string",
                description: "string",
                availability: "string",
                url: "string"
              }
            },
            limit: 3
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          
          if (searchData.success && searchData.data) {
            const siteName = query.split(' ')[0].replace('site:', '').replace('.com', '');
            
            searchData.data.forEach((result: any) => {
              if (result.extract && result.extract.title) {
                onlineResults.push({
                  id: `online-${Date.now()}-${Math.random()}`,
                  name: siteName.charAt(0).toUpperCase() + siteName.slice(1),
                  store_type: 'online',
                  address: `${siteName}.com`,
                  distance: null,
                  latitude: null,
                  longitude: null,
                  phone: null,
                  product: {
                    name: result.extract.title || productName,
                    price: result.extract.price || 'Price not available',
                    description: result.extract.description || '',
                    availability: result.extract.availability || 'Check website'
                  },
                  url: result.metadata?.sourceURL || result.extract.url,
                  isOnline: true
                });
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error searching ${query}:`, error);
        // Continue with other searches even if one fails
      }
    }

    console.log(`Found ${onlineResults.length} online results`);

    return new Response(
      JSON.stringify({
        stores: onlineResults,
        searchedProduct: productName,
        totalResults: onlineResults.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in search-online-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});