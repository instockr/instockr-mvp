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
    const { productName, location, searchRadius, physicalOnly } = await req.json();

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

    console.log('Searching for physical stores selling:', productName);
    console.log('Location:', location, 'Physical only:', physicalOnly);

    // Generate searches for physical stores that sell this product
    const searchSources = [
      {
        name: 'Physical Store Search',
        query: `${productName} negozio fisico punto vendita Italia indirizzo telefono`,
        limit: 5
      },
      {
        name: 'Store Locator Search',
        query: `${productName} "dove comprare" "trova negozio" "store locator" Italia`,
        limit: 4
      },
      {
        name: 'Chain Stores Search',
        query: `${productName} MediaWorld Unieuro Trony Euronics "punti vendita" negozi`,
        limit: 4
      },
      {
        name: 'Local Retailers',
        query: `${productName} negozio locale rivenditore autorizzato Italia`,
        limit: 3
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
              // Skip results that are clearly online-only if physicalOnly flag is set
              if (physicalOnly) {
                const content = (result.markdown || result.title || '').toLowerCase();
                const isOnlineOnly = content.includes('spedizione gratuita') || 
                                   content.includes('consegna a domicilio') ||
                                   content.includes('acquista online') ||
                                   content.includes('e-commerce') ||
                                   (content.includes('online') && !content.includes('negozio') && !content.includes('store'));
                
                // Skip if it's clearly online-only
                if (isOnlineOnly) {
                  return;
                }
              }

              // Look for physical location indicators
              const hasPhysicalIndicators = result.markdown && 
                (result.markdown.includes('indirizzo') || 
                 result.markdown.includes('via ') || 
                 result.markdown.includes('corso ') ||
                 result.markdown.includes('piazza ') ||
                 result.markdown.includes('telefono') ||
                 result.markdown.includes('orari apertura') ||
                 result.markdown.includes('store locator') ||
                 result.markdown.includes('punti vendita'));

              // Determine store type based on URL and content
              let storeType = 'retail';
              const url = result.url.toLowerCase();
              if (url.includes('mediaworld') || url.includes('unieuro') || url.includes('trony') || url.includes('euronics')) {
                storeType = 'electronics';
              } else if (url.includes('ferramenta') || url.includes('leroy') || url.includes('bricolage')) {
                storeType = 'hardware';
              } else if (url.includes('farmacia')) {
                storeType = 'pharmacy';
              }

              // Extract potential address and phone from markdown
              let address = 'Address not available';
              let phone = null;
              
              if (result.markdown) {
                // Look for Italian addresses
                const addressRegex = /(via|corso|piazza|viale)\s+[^,\n]+(?:,\s*\d{5}\s*[a-zA-Z]+)?/i;
                const addressMatch = result.markdown.match(addressRegex);
                if (addressMatch) {
                  address = addressMatch[0];
                }
                
                // Look for phone numbers
                const phoneRegex = /(\+39\s*)?[\d\s\-]{8,15}/g;
                const phoneMatch = result.markdown.match(phoneRegex);
                if (phoneMatch) {
                  phone = phoneMatch[0];
                }
              }

              sourceResults.push({
                id: `${source.name.toLowerCase().replace(/\s+/g, '-')}-${sourceIndex}-${index}-${Date.now()}`,
                name: result.title,
                store_type: storeType,
                address: address,
                distance: null,
                latitude: null,
                longitude: null,
                phone: phone,
                product: {
                  name: productName,
                  price: 'Contact store for pricing',
                  description: result.markdown ? result.markdown.substring(0, 200) + '...' : `${productName} available`,
                  availability: 'Contact store for availability'
                },
                url: result.url,
                isOnline: !hasPhysicalIndicators, // Mark as online if no physical indicators found
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