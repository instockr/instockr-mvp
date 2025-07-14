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
    
    console.log('FireCrawl API key exists:', !!firecrawlApiKey);
    console.log('FireCrawl API key length:', firecrawlApiKey?.length || 0);
    
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
      console.log('Starting FireCrawl search...');
      
      // Use direct API call instead of SDK for better debugging
      const searchQuery = `${productName} store Milan Italy buy purchase`;
      console.log('Search query:', searchQuery);
      
      const requestBody = {
        query: searchQuery,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown']
        }
      };
      
      console.log('Request body:', JSON.stringify(requestBody, null, 2));
      
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('FireCrawl API response status:', response.status);
      console.log('FireCrawl API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FireCrawl API error:', errorText);
        throw new Error(`FireCrawl API error: ${response.status} - ${errorText}`);
      }

      const searchResult = await response.json();
      console.log('FireCrawl search result:', JSON.stringify(searchResult, null, 2));

      if (searchResult.success && searchResult.data && Array.isArray(searchResult.data)) {
        console.log(`Processing ${searchResult.data.length} search results`);
        
        searchResult.data.forEach((result: any, index: number) => {
          console.log(`Processing result ${index}:`, result.title, result.url);
          
          // Create a result for each found page
          if (result.title && result.url) {
            // Determine if this is actually a physical store or online
            const isPhysicalStore = result.title.toLowerCase().includes('apple store') || 
                                  result.title.toLowerCase().includes('piazza liberty') ||
                                  result.url.includes('tripadvisor.com') ||
                                  result.url.includes('apple.com/newsroom') ||
                                  (result.markdown && result.markdown.toLowerCase().includes('address'));
                                  
            onlineResults.push({
              id: `search-result-${index}-${Date.now()}`,
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
                description: result.markdown ? result.markdown.substring(0, 200) + '...' : `${productName} available`,
                availability: 'Contact store for availability'
              },
              url: result.url,
              isOnline: !isPhysicalStore // Mark as physical store if it looks like one
            });
          }
        });
      } else {
        console.error('Unexpected FireCrawl response structure:', searchResult);
      }
    } catch (error) {
      console.error('Error during Firecrawl search:', error);
      console.error('Error details:', error.message, error.stack);
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