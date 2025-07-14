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

    // Define multiple search sources with specific queries
    const searchSources = [
      {
        name: 'General Web Search',
        query: `${productName} store Milan Italy buy purchase`,
        limit: 3
      },
      {
        name: 'E-commerce Sites',
        query: `${productName} site:amazon.it OR site:ebay.it OR site:mediaworld.it OR site:unieuro.it`,
        limit: 4
      },
      {
        name: 'Price Comparison',
        query: `${productName} prezzo migliore confronto prezzi site:idealo.it OR site:trovaprezzi.it`,
        limit: 3
      },
      {
        name: 'Electronics Retailers',
        query: `${productName} elettronica negozio online Italia vendita`,
        limit: 3
      },
      {
        name: 'Mobile Carriers',
        query: `${productName} TIM Vodafone WindTre Iliad negozio cellulare`,
        limit: 2
      }
    ];

    const onlineResults = [];

    // Execute all searches in parallel
    const searchPromises = searchSources.map(async (source, sourceIndex) => {
      try {
        console.log(`Starting ${source.name} search...`);
        
        const requestBody = {
          query: source.query,
          limit: source.limit,
          scrapeOptions: {
            formats: ['markdown']
          }
        };
        
        console.log(`${source.name} query:`, source.query);
        
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`${source.name} API error:`, errorText);
          return [];
        }

        const searchResult = await response.json();
        console.log(`${source.name} search result:`, searchResult.data?.length || 0, 'results');

        const sourceResults = [];
        
        if (searchResult.success && searchResult.data && Array.isArray(searchResult.data)) {
          searchResult.data.forEach((result: any, index: number) => {
            if (result.title && result.url) {
              // Determine store type based on URL
              let storeType = 'retail';
              const url = result.url.toLowerCase();
              if (url.includes('amazon') || url.includes('ebay') || url.includes('marketplace')) {
                storeType = 'marketplace';
              } else if (url.includes('mediaworld') || url.includes('unieuro') || url.includes('electronics')) {
                storeType = 'electronics';
              } else if (url.includes('tim.it') || url.includes('vodafone') || url.includes('windtre') || url.includes('iliad')) {
                storeType = 'mobile_carrier';
              }

              // Extract potential price from markdown
              let price = 'Contact store for pricing';
              if (result.markdown) {
                const priceRegex = /€[\d.,]+|[\d.,]+\s*€|\$[\d.,]+/g;
                const priceMatch = result.markdown.match(priceRegex);
                if (priceMatch && priceMatch.length > 0) {
                  price = priceMatch[0];
                }
              }

              sourceResults.push({
                id: `${source.name.toLowerCase().replace(/\s+/g, '-')}-${sourceIndex}-${index}-${Date.now()}`,
                name: result.title,
                store_type: storeType,
                address: 'Online / Italy',
                distance: null,
                latitude: null,
                longitude: null,
                phone: null,
                product: {
                  name: productName,
                  price: price,
                  description: result.markdown ? result.markdown.substring(0, 300) + '...' : `${productName} available`,
                  availability: 'Check website for availability'
                },
                url: result.url,
                isOnline: true,
                source: source.name
              });
            }
          });
        }
        
        return sourceResults;
      } catch (error) {
        console.error(`Error during ${source.name} search:`, error);
        return [];
      }
    });

    // Wait for all searches to complete
    try {
      console.log('Executing parallel searches...');
      const searchResults = await Promise.all(searchPromises);
      
      // Flatten and combine all results
      searchResults.forEach(results => {
        onlineResults.push(...results);
      });
      
      console.log(`Found ${onlineResults.length} total results from all sources`);
    } catch (error) {
      console.error('Error during parallel searches:', error);
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