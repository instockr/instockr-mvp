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

// Simple AI extraction using cheap model
async function extractProductsWithAI(content: string, productName: string, websiteUrl: string): Promise<ProductMatch[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheapest model that can handle this task
        messages: [
          {
            role: 'system',
            content: `Extract products related to "${productName}" from this webpage content. Return a JSON array of products found. Each product should have: name, price, description (optional), availability (optional). Only include actual products with real information.`
          },
          {
            role: 'user',
            content: content.substring(0, 4000) // Limit content to save tokens
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const content_result = data.choices[0].message.content;
    
    try {
      const products = JSON.parse(content_result);
      return Array.isArray(products) ? products.map(p => ({
        ...p,
        url: websiteUrl
      })) : [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', content_result);
      return [];
    }

  } catch (error) {
    console.error('AI extraction failed:', error);
    return [];
  }
}

// Generate multiple search URL patterns to try
function generateSearchUrls(baseUrl: string, productName: string): string[] {
  const encodedProduct = encodeURIComponent(productName);
  const productWords = productName.toLowerCase().split(' ');
  const firstWord = productWords[0];
  
  const patterns = [
    // Common search patterns
    `/search?q=${encodedProduct}`,
    `/search/?q=${encodedProduct}`,
    `/search?query=${encodedProduct}`,
    `/search/?query=${encodedProduct}`,
    `/search?search=${encodedProduct}`,
    `/search?keyword=${encodedProduct}`,
    `/products/search?q=${encodedProduct}`,
    `/shop/search?q=${encodedProduct}`,
    `/?s=${encodedProduct}`,
    `/?search=${encodedProduct}`,
    `/suche?q=${encodedProduct}`, // German
    `/recherche?q=${encodedProduct}`, // French
    
    // Product category patterns
    `/products/${firstWord}`,
    `/shop/${firstWord}`,
    `/category/${firstWord}`,
    `/categories/${firstWord}`,
    
    // Brand-specific patterns (for iPhone, Samsung, etc.)
    ...(firstWord === 'iphone' ? ['/apple', '/iphone', '/smartphones', '/telefone'] : []),
    ...(firstWord === 'samsung' ? ['/samsung', '/smartphones', '/telefone'] : []),
    ...(firstWord === 'laptop' ? ['/computers', '/laptops', '/notebooks'] : []),
  ];

  return patterns.map(pattern => {
    try {
      return new URL(pattern, baseUrl).toString();
    } catch {
      return null;
    }
  }).filter(Boolean) as string[];
}

// Smart multi-URL crawling approach
async function smartProductSearch(website: string, productName: string, storeName: string): Promise<ProductMatch[]> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  console.log(`Starting smart multi-URL search for "${productName}" on ${storeName}`);
  
  const searchUrls = generateSearchUrls(website, productName);
  console.log(`Generated ${searchUrls.length} search URLs to try`);
  
  let allProducts: ProductMatch[] = [];

  // Try each search URL
  for (let i = 0; i < Math.min(searchUrls.length, 5); i++) { // Limit to 5 attempts to avoid costs
    const searchUrl = searchUrls[i];
    console.log(`Trying search URL ${i + 1}: ${searchUrl}`);
    
    try {
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: searchUrl,
          pageOptions: {
            onlyMainContent: true,
            includeHtml: false // Just get text content to save processing
          }
        }),
      });

      if (scrapeResponse.ok) {
        const scrapeData = await scrapeResponse.json();
        if (scrapeData.data?.markdown) {
          console.log(`Got content from ${searchUrl}, analyzing...`);
          
          // Use AI to extract products from this search result page
          const products = await extractProductsWithAI(
            scrapeData.data.markdown, 
            productName, 
            searchUrl
          );
          
          console.log(`Found ${products.length} products from ${searchUrl}`);
          allProducts.push(...products);
          
          // If we found products, we can stop searching (or continue for more results)
          if (products.length > 0) {
            console.log('Found products, continuing to search more URLs for better results...');
          }
        }
      } else {
        console.log(`Search URL ${searchUrl} failed: ${scrapeResponse.status}`);
      }
    } catch (error) {
      console.error(`Error trying ${searchUrl}:`, error);
      continue;
    }
    
    // Small delay between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Remove duplicates
  const uniqueProducts = allProducts.filter((product, index, self) => 
    index === self.findIndex(p => 
      p.name === product.name && p.price === product.price
    )
  );

  console.log(`Smart search completed: ${uniqueProducts.length} unique products found`);
  return uniqueProducts;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();
    
    console.log(`Starting smart crawl for ${storeName} - Product: ${productName} - Website: ${website}`);
    
    if (!storeName || !productName) {
      return new Response(
        JSON.stringify({ error: 'Store name and product name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no website provided, return empty results
    if (!website || website === 'undefined' || website === 'null') {
      console.log('No website provided for crawling');
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and validate website URL
    let cleanWebsite = website;
    if (!cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = 'https://' + cleanWebsite;
    }

    console.log(`Starting smart product search on: ${cleanWebsite}`);

    // Use the new smart search approach
    const products = await smartProductSearch(cleanWebsite, productName, storeName);

    console.log(`Smart crawl completed: Found ${products.length} products`);

    return new Response(
      JSON.stringify({ products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart crawl-store-products function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});