import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlRequest {
  storeName: string;
  website: string;
  productName: string;
}

interface ProductMatch {
  name: string;
  price: string;
  description?: string;
  availability?: string;
  url?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();
    
    if (!storeName || !productName) {
      return new Response(
        JSON.stringify({ error: 'Store name and product name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Crawling ${storeName} for ${productName}`);

    // If no website provided, return empty results
    if (!website || website === 'undefined' || website === 'null') {
      console.log('No website provided for crawling');
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and validate website URL
    let cleanWebsite = website;
    if (!cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = 'https://' + cleanWebsite;
    }

    console.log(`Scraping website: ${cleanWebsite}`);

    // Use Firecrawl to scrape the store's website
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanWebsite,
        pageOptions: {
          onlyMainContent: true,
          includeHtml: true
        },
        extractorOptions: {
          mode: 'llm-extraction',
          extractionPrompt: `Extract product information from this ${storeName} webpage. 
            Focus on products related to "${productName}". 
            For each product found, extract:
            - Product name
            - Price (if available)
            - Brief description (if available)
            - Availability status (if mentioned)
            - Product page URL (if different from main page)
            
            Return as JSON array with objects containing: name, price, description, availability, url`
        }
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl scraping failed:', errorText);
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    console.log('Firecrawl response:', scrapeData);

    let products: ProductMatch[] = [];

    // Try to parse the extracted data
    if (scrapeData.data?.llm_extraction) {
      try {
        // The LLM extraction might return a string that needs parsing
        const extractedData = typeof scrapeData.data.llm_extraction === 'string' 
          ? JSON.parse(scrapeData.data.llm_extraction)
          : scrapeData.data.llm_extraction;
        
        if (Array.isArray(extractedData)) {
          products = extractedData.map((item: any) => ({
            name: item.name || 'Unknown Product',
            price: item.price || 'Price not available',
            description: item.description,
            availability: item.availability,
            url: item.url ? (item.url.startsWith('http') ? item.url : cleanWebsite + item.url) : cleanWebsite
          }));
        }
      } catch (parseError) {
        console.error('Error parsing LLM extraction:', parseError);
      }
    }

    // If no products found via LLM extraction, try basic text search
    if (products.length === 0 && scrapeData.data?.markdown) {
      console.log('No LLM extraction found, trying basic text search');
      
      const markdown = scrapeData.data.markdown.toLowerCase();
      const productLower = productName.toLowerCase();
      
      // Simple keyword matching for product relevance
      if (markdown.includes(productLower) || 
          markdown.includes(productLower.split(' ')[0]) ||
          markdown.includes('price') || 
          markdown.includes('€') || 
          markdown.includes('$')) {
        
        products.push({
          name: `${productName} - Available at ${storeName}`,
          price: 'Contact store for pricing',
          description: 'Product may be available - contact store for details',
          availability: 'Contact store for availability',
          url: cleanWebsite
        });
      }
    }

    console.log(`Found ${products.length} product matches`);

    return new Response(
      JSON.stringify({ products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in crawl-store-products function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});