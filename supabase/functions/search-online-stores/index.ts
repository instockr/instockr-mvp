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

    const onlineResults = [];

    try {
      // Use Firecrawl's search endpoint to find stores selling the product in Milan
      const searchQuery = `${productName} store Milan Italy buy purchase`;
      
      console.log('Using Firecrawl search for:', searchQuery);
      
      const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery,
          pageOptions: {
            fetchPageContent: true
          },
          extractorOptions: {
            extractionSchema: {
              stores: {
                type: "array",
                items: {
                  type: "object", 
                  properties: {
                    store_name: { type: "string" },
                    address: { type: "string" },
                    phone: { type: "string" },
                    website: { type: "string" },
                    product_price: { type: "string" },
                    availability: { type: "string" },
                    location_milan: { type: "boolean" }
                  }
                }
              }
            }
          },
          limit: 10
        }),
      });

      console.log('Firecrawl search response status:', searchResponse.status);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log('Firecrawl search data:', JSON.stringify(searchData, null, 2));
        
        if (searchData.success && searchData.data) {
          // Process search results
          searchData.data.forEach((result: any, index: number) => {
            // Extract store information from the search result
            const extractedData = result.extract?.stores || [];
            
            if (extractedData.length > 0) {
              extractedData.forEach((store: any, storeIndex: number) => {
                if (store.location_milan || store.address?.toLowerCase().includes('milan')) {
                  onlineResults.push({
                    id: `search-result-${index}-${storeIndex}-${Date.now()}`,
                    name: store.store_name || result.title || `Store ${index + 1}`,
                    store_type: 'retail',
                    address: store.address || 'Milan, Italy',
                    distance: null,
                    latitude: null,
                    longitude: null,
                    phone: store.phone || null,
                    product: {
                      name: productName,
                      price: store.product_price || 'Contact store for pricing',
                      description: `${productName} available at this location`,
                      availability: store.availability || 'Contact store for availability'
                    },
                    url: store.website || result.url,
                    isOnline: true
                  });
                }
              });
            } else {
              // Fallback: create result from basic search data
              if (result.title && result.url) {
                onlineResults.push({
                  id: `search-fallback-${index}-${Date.now()}`,
                  name: result.title,
                  store_type: 'retail',
                  address: 'Milan, Italy',
                  distance: null,
                  latitude: null,
                  longitude: null,
                  phone: null,
                  product: {
                    name: productName,
                    price: 'Contact store for pricing',
                    description: result.description || `${productName} available`,
                    availability: 'Contact store for availability'
                  },
                  url: result.url,
                  isOnline: true
                });
              }
            }
          });
        }
      } else {
        console.error('Firecrawl search failed:', searchResponse.status, await searchResponse.text());
      }
    } catch (error) {
      console.error('Error during Firecrawl search:', error);
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