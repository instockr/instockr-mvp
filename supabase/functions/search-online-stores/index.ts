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

    // Smart product-to-store-type mapping for Italian market
    const getStoreTypesForProduct = (product: string): string[] => {
      const productLower = product.toLowerCase();
      
      // Electronics & Technology
      if (productLower.includes('iphone') || productLower.includes('smartphone') || productLower.includes('cellulare') || productLower.includes('telefono')) {
        return ['negozio telefonia', 'TIM Vodafone WindTre Iliad', 'elettronica'];
      }
      if (productLower.includes('laptop') || productLower.includes('computer') || productLower.includes('pc') || productLower.includes('elettronic')) {
        return ['elettronica', 'informatica', 'mediaworld unieuro'];
      }
      
      // Home & Furniture
      if (productLower.includes('mattress') || productLower.includes('materasso') || productLower.includes('letto') || productLower.includes('bed')) {
        return ['materassi', 'arredamento', 'mobili', 'ikea mondo convenienza'];
      }
      if (productLower.includes('furniture') || productLower.includes('mobili') || productLower.includes('divano') || productLower.includes('tavolo')) {
        return ['arredamento', 'mobili', 'casa'];
      }
      
      // Tools & Hardware
      if (productLower.includes('cacciavite') || productLower.includes('screwdriver') || productLower.includes('martello') || productLower.includes('chiave')) {
        return ['ferramenta', 'bricolage', 'fai da te', 'leroy merlin brico'];
      }
      if (productLower.includes('drill') || productLower.includes('trapano') || productLower.includes('utensili')) {
        return ['ferramenta', 'utensili', 'bricolage'];
      }
      
      // Fashion & Clothing
      if (productLower.includes('shoes') || productLower.includes('scarpe') || productLower.includes('vestiti') || productLower.includes('clothing')) {
        return ['abbigliamento', 'scarpe', 'moda', 'zara hm'];
      }
      
      // Health & Beauty
      if (productLower.includes('medicine') || productLower.includes('medicina') || productLower.includes('vitamina') || productLower.includes('farmaco')) {
        return ['farmacia', 'parafarmacia', 'salute'];
      }
      
      // Food & Grocery
      if (productLower.includes('food') || productLower.includes('cibo') || productLower.includes('pasta') || productLower.includes('bread')) {
        return ['supermercato', 'alimentari', 'coop esselunga'];
      }
      
      // Sports & Recreation
      if (productLower.includes('sport') || productLower.includes('fitness') || productLower.includes('calcio') || productLower.includes('tennis')) {
        return ['articoli sportivi', 'decathlon', 'sport'];
      }
      
      // Books & Media
      if (productLower.includes('book') || productLower.includes('libro') || productLower.includes('cd') || productLower.includes('dvd')) {
        return ['libreria', 'mediastore', 'cultura'];
      }
      
      // Default fallback
      return ['negozio', 'store'];
    };

    const storeTypes = getStoreTypesForProduct(productName);
    
    // Build dynamic search sources based on product and store types
    const searchSources = [
      {
        name: 'General Product Search',
        query: `${productName} negozio Italia comprare vendita online`,
        limit: 4
      },
      {
        name: 'Major E-commerce',
        query: `${productName} site:amazon.it OR site:ebay.it OR site:zalando.it OR site:mediaworld.it`,
        limit: 5
      },
      {
        name: 'Price Comparison',
        query: `${productName} prezzo migliore confronto prezzi site:idealo.it OR site:trovaprezzi.it OR site:kelkoo.it`,
        limit: 3
      }
    ];

    // Add store-type-specific searches
    storeTypes.forEach((storeType, index) => {
      searchSources.push({
        name: `${storeType} Specialist Stores`,
        query: `${productName} ${storeType} Italia negozio online vendita`,
        limit: 3
      });
    });

    // Add location-specific search
    searchSources.push({
      name: 'Local Italian Retailers',
      query: `${productName} negozio italiano online spedizione Italia`,
      limit: 4
    });

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