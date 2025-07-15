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
    const { productName, location, userLat, userLng } = await req.json();
    
    console.log('Searching web for physical stores:', { productName, location });

    // Get API keys from environment
    const googleApiKey = Deno.env.get('GOOGLE_CSE_API_KEY');
    const cseId = Deno.env.get('GOOGLE_CSE_ID');
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

    if (!googleApiKey || !cseId) {
      console.error('Missing Google API credentials');
      return new Response(
        JSON.stringify({ error: 'Google API credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    // Search for store locator pages and store directories
    const searchQueries = [
      `"${productName}" store locator ${location}`,
      `"${productName}" negozi ${location}`,
      `buy "${productName}" ${location} store address`,
      `acquista "${productName}" ${location} negozio`,
      `"${productName}" retailers ${location}`,
      `"${productName}" rivenditori ${location}`
    ];

    for (const query of searchQueries) {
      try {
        // Use Google Custom Search to find store-related pages
        const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=5&gl=it&hl=it`;
        
        console.log('Searching web for:', query);
        
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          console.error('Google API error:', response.status, response.statusText);
          continue;
        }

        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
          for (const item of data.items) {
            // Extract potential store information from search results
            const title = item.title || '';
            const snippet = item.snippet || '';
            const link = item.link || '';
            
            // Look for address patterns in snippet
            const addressMatch = snippet.match(/([A-Za-z\s,]+\d+[A-Za-z\s,]*\d{5}[A-Za-z\s]*)/);
            const phoneMatch = snippet.match(/(\+?\d{1,4}[\s-]?\d{3,4}[\s-]?\d{3,4}[\s-]?\d{3,4})/);
            
            // Extract domain to determine store type
            let domain = '';
            let storeName = '';
            try {
              const url = new URL(link);
              domain = url.hostname.replace('www.', '');
              storeName = domain.split('.')[0];
            } catch (e) {
              domain = item.displayLink || 'unknown';
              storeName = title.split(' ')[0] || domain;
            }

            // Determine store type
            let storeType = 'specialty';
            const lowerDomain = domain.toLowerCase();
            const lowerTitle = title.toLowerCase();
            const lowerSnippet = snippet.toLowerCase();
            
            if (lowerDomain.includes('mediaworld') || lowerDomain.includes('unieuro') || lowerDomain.includes('euronics') || 
                lowerTitle.includes('electronics') || lowerSnippet.includes('elettronica')) {
              storeType = 'electronics';
            } else if (lowerDomain.includes('farmacia') || lowerTitle.includes('pharmacy') || lowerSnippet.includes('farmacia')) {
              storeType = 'pharmacy';
            } else if (lowerDomain.includes('supermercato') || lowerTitle.includes('grocery') || lowerSnippet.includes('supermercato')) {
              storeType = 'grocery';
            } else if (lowerTitle.includes('department') || lowerSnippet.includes('grande magazzino')) {
              storeType = 'department';
            }

            // Create store entry if we found useful information
            if (addressMatch || phoneMatch || title.includes('store') || title.includes('negozio')) {
              const store = {
                id: `web-store-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: storeName.charAt(0).toUpperCase() + storeName.slice(1),
                store_type: storeType,
                address: addressMatch ? addressMatch[0].trim() : `Found via web search - ${domain}`,
                distance: null,
                latitude: null,
                longitude: null,
                phone: phoneMatch ? phoneMatch[0].trim() : null,
                product: {
                  name: productName,
                  price: 'Contact store for pricing',
                  description: `${productName} potentially available - found via web search`,
                  availability: 'Contact store for availability'
                },
                url: link,
                isOnline: false,
                source: 'Web Search',
                webSearchQuery: query,
                snippet: snippet.substring(0, 200)
              };

              results.push(store);
            }
          }
        }
        
        // Small delay between searches to be respectful
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`Error searching for query "${query}":`, error);
        continue;
      }
    }

    // If we have Firecrawl API key, try to crawl some store locator pages
    if (firecrawlApiKey && results.length > 0) {
      console.log('Attempting to crawl store locator pages...');
      
      // Take the first few promising URLs and try to crawl them
      const urlsToCrawl = results
        .filter(store => store.url && (
          store.url.includes('store-locator') || 
          store.url.includes('negozi') || 
          store.url.includes('dove-siamo')
        ))
        .slice(0, 3)
        .map(store => store.url);

      for (const url of urlsToCrawl) {
        try {
          const crawlResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: url,
              pageOptions: {
                onlyMainContent: true,
                includeHtml: false,
                waitFor: 1000
              },
              extractorOptions: {
                mode: 'llm-extraction',
                extractionPrompt: `Extract store locations from this page. For each store, extract: name, address, phone number, and any other contact details. Focus on physical store locations in Italy. Return as a simple list.`
              }
            }),
          });

          if (crawlResponse.ok) {
            const crawlData = await crawlResponse.json();
            console.log(`Crawled store locator page: ${url}`);
            
            // The extracted data would be in crawlData.llm_extraction
            // This is a simplified approach - in production you'd parse this more carefully
            if (crawlData.llm_extraction) {
              console.log('Extracted store data:', crawlData.llm_extraction);
            }
          }
          
          // Delay between crawl requests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error crawling ${url}:`, error);
        }
      }
    }

    // Remove duplicates based on name and address similarity
    const uniqueResults = [];
    for (const store of results) {
      const isDuplicate = uniqueResults.some(existing => 
        existing.name.toLowerCase() === store.name.toLowerCase() ||
        (existing.address && store.address && 
         existing.address.toLowerCase().includes(store.address.toLowerCase().split(',')[0]))
      );
      
      if (!isDuplicate) {
        uniqueResults.push(store);
      }
    }

    console.log(`Found ${uniqueResults.length} unique potential physical stores via web search`);

    return new Response(
      JSON.stringify({
        stores: uniqueResults,
        searchedProduct: productName,
        totalResults: uniqueResults.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-web-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});