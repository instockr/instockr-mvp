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

    // Physical store chains to search for location data
    const storeChains = [
      { name: 'IKEA', searchUrl: 'https://www.ikea.com/us/en/search/products/?q=' },
      { name: 'Target', searchUrl: 'https://www.target.com/s?searchTerm=' },
      { name: 'Walmart', searchUrl: 'https://www.walmart.com/search?q=' },
      { name: 'Best Buy', searchUrl: 'https://www.bestbuy.com/site/searchpage.jsp?st=' },
      { name: 'Home Depot', searchUrl: 'https://www.homedepot.com/s/' }
    ];

    const onlineResults = [];

    for (const store of storeChains) {
      try {
        const searchUrl = `${store.searchUrl}${encodeURIComponent(productName)}`;
        
        // Use Firecrawl to scrape the store's product page
        const crawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: searchUrl,
            formats: ['extract'],
            extract: {
              schema: {
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      price: { type: "string" },
                      availability: { type: "string" },
                      store_locations: { type: "string" },
                      in_stock: { type: "boolean" }
                    }
                  }
                }
              }
            },
            onlyMainContent: true
          }),
        });

        console.log(`Crawling ${store.name} - Status: ${crawlResponse.status}`);

        if (crawlResponse.ok) {
          const crawlData = await crawlResponse.json();
          
          if (crawlData.success && crawlData.extract?.products) {
            crawlData.extract.products.slice(0, 2).forEach((product: any, index: number) => {
              onlineResults.push({
                id: `online-${store.name.toLowerCase()}-${Date.now()}-${index}`,
                name: store.name,
                store_type: 'department',
                address: `${store.name} - Check store locator`,
                distance: null,
                latitude: null,
                longitude: null,
                phone: null,
                product: {
                  name: product.name || productName,
                  price: product.price || 'Price varies by location',
                  description: `Available at ${store.name} locations`,
                  availability: product.availability || (product.in_stock ? 'In Stock' : 'Check local stores')
                },
                url: searchUrl,
                isOnline: true
              });
            });
          }
        } else {
          console.error(`Failed to crawl ${store.name}: ${crawlResponse.status}`);
        }
      } catch (error) {
        console.error(`Error crawling ${store.name}:`, error);
        // Continue with other stores even if one fails
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