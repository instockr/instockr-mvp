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

    // Categorize the product first
    function categorizeProduct(productName: string): string {
      const product = productName.toLowerCase();
      
      if (product.includes('iphone') || product.includes('samsung') || product.includes('phone') || 
          product.includes('laptop') || product.includes('computer') || product.includes('tablet') ||
          product.includes('tv') || product.includes('camera') || product.includes('headphone')) {
        return 'electronics';
      } else if (product.includes('pillow') || product.includes('sofa') || product.includes('furniture') ||
                 product.includes('table') || product.includes('chair') || product.includes('bed') ||
                 product.includes('lamp') || product.includes('curtain') || product.includes('decoration')) {
        return 'home_goods';
      } else if (product.includes('shirt') || product.includes('pants') || product.includes('dress') ||
                 product.includes('shoes') || product.includes('jacket') || product.includes('clothing')) {
        return 'clothing';
      } else if (product.includes('food') || product.includes('grocery') || product.includes('milk') ||
                 product.includes('bread') || product.includes('pasta') || product.includes('wine')) {
        return 'grocery';
      }
      return 'general';
    }

    const productCategory = categorizeProduct(productName);
    console.log('Product category:', productCategory);

    // Milan store chains mapped by category
    const storeChainsByCategory: Record<string, Array<{name: string, searchUrl: string}>> = {
      electronics: [
        { name: 'Unieuro Milano', searchUrl: 'https://www.unieuro.it/online/cerca?text=' },
        { name: 'MediaWorld Milano', searchUrl: 'https://www.mediaworld.it/mw/search?q=' },
        { name: 'Euronics Milano', searchUrl: 'https://www.euronics.it/search?q=' }
      ],
      home_goods: [
        { name: 'IKEA Milano', searchUrl: 'https://www.ikea.com/it/it/search/products/?q=' },
        { name: 'Leroy Merlin Milano', searchUrl: 'https://www.leroymerlin.it/ricerca/?term=' }
      ],
      clothing: [
        { name: 'Zara Milano', searchUrl: 'https://www.zara.com/it/it/search?searchTerm=' },
        { name: 'H&M Milano', searchUrl: 'https://www2.hm.com/it_it/search-results.html?q=' }
      ],
      grocery: [
        { name: 'Esselunga Milano', searchUrl: 'https://www.esselunga.it/cms/ricerca/risultati.html?q=' },
        { name: 'Coop Milano', searchUrl: 'https://www.coopshop.it/ricerca?q=' }
      ],
      general: [
        { name: 'Amazon.it', searchUrl: 'https://www.amazon.it/s?k=' }
      ]
    };

    const storeChains = storeChainsByCategory[productCategory] || storeChainsByCategory.general;

    const onlineResults = [];

    // Create a timeout promise that resolves after 10 seconds
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Search timeout')), 10000);
    });

    try {
      // Use Promise.race to ensure we don't wait too long
      await Promise.race([
        (async () => {
          for (const store of storeChains) {
            try {
              const searchUrl = `${store.searchUrl}${encodeURIComponent(productName)}`;
              
              // Use Firecrawl to scrape the store's product page with timeout
              const crawlPromise = fetch('https://api.firecrawl.dev/v1/scrape', {
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
                            milan_stores: { type: "string" },
                            store_location_milan: { type: "string" },
                            in_stock: { type: "boolean" }
                          }
                        }
                      }
                    }
                  },
                  onlyMainContent: true
                }),
              });

              // Add 5 second timeout per request
              const storeTimeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error(`${store.name} timeout`)), 5000);
              });

              const crawlResponse = await Promise.race([crawlPromise, storeTimeoutPromise]);
              console.log(`Crawling ${store.name} - Status: ${crawlResponse.status}`);

              if (crawlResponse.ok) {
                const crawlData = await crawlResponse.json();
                
                if (crawlData.success && crawlData.extract?.products) {
                  crawlData.extract.products.slice(0, 1).forEach((product: any, index: number) => {
                    onlineResults.push({
                      id: `online-${store.name.toLowerCase()}-${Date.now()}-${index}`,
                      name: store.name,
                      store_type: 'department',
                      address: `${store.name} - Milan location`,
                      distance: null,
                      latitude: null,
                      longitude: null,
                      phone: null,
                      product: {
                        name: product.name || productName,
                        price: product.price || 'Price varies by location',
                        description: `Available at ${store.name} in Milan`,
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
        })(),
        timeoutPromise
      ]);
    } catch (error) {
      console.log('Search completed with timeout or error:', error);
      // Continue anyway with whatever results we have
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