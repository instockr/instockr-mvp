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

// AI-powered website analysis
async function analyzeWebsiteForSearch(html: string, markdown: string, productName: string, storeName: string): Promise<{
  searchUrl?: string;
  searchStrategy: string;
  products: ProductMatch[];
}> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const prompt = `Analyze this ${storeName} website and help me find "${productName}" products.

WEBSITE CONTENT:
${markdown.substring(0, 3000)}

HTML STRUCTURE (first 2000 chars):
${html.substring(0, 2000)}

TASK: I need to find "${productName}" on this ${storeName} website. Please:

1. Look for any search functionality (search boxes, search URLs, product category links)
2. Identify if there are direct product listings visible
3. Extract any products related to "${productName}" that are already visible
4. Suggest the best strategy to find this product

RESPOND IN THIS EXACT JSON FORMAT:
{
  "searchUrl": "URL_if_search_form_found_or_null",
  "searchStrategy": "description_of_best_approach",
  "visibleProducts": [
    {
      "name": "product_name",
      "price": "price_with_currency",
      "description": "brief_description",
      "availability": "in_stock_or_available_or_null",
      "url": "product_url_or_website_url"
    }
  ]
}

Focus on finding actual "${productName}" products with real prices and availability.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: 'You are an expert web scraper that analyzes e-commerce websites to find specific products. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      // Fallback to basic analysis
      analysis = {
        searchUrl: null,
        searchStrategy: "Manual search required - AI parsing failed",
        visibleProducts: []
      };
    }

    return {
      searchUrl: analysis.searchUrl,
      searchStrategy: analysis.searchStrategy,
      products: analysis.visibleProducts || []
    };

  } catch (error) {
    console.error('AI analysis failed:', error);
    return {
      searchStrategy: "AI analysis failed - falling back to basic search",
      products: []
    };
  }
}

// Smart product search using AI-guided approach
async function searchForProducts(website: string, productName: string, storeName: string): Promise<ProductMatch[]> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  console.log(`Starting smart search for "${productName}" on ${storeName}`);

  // Step 1: Scrape the main website to understand structure
  const mainScrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firecrawlApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: website,
      pageOptions: {
        onlyMainContent: true,
        includeHtml: true
      }
    }),
  });

  if (!mainScrapeResponse.ok) {
    throw new Error(`Failed to scrape main website: ${mainScrapeResponse.statusText}`);
  }

  const mainScrapeData = await mainScrapeResponse.json();
  const html = mainScrapeData.data?.html || '';
  const markdown = mainScrapeData.data?.markdown || '';

  console.log('Analyzing website structure with AI...');

  // Step 2: Use AI to analyze the website and find products
  const analysis = await analyzeWebsiteForSearch(html, markdown, productName, storeName);
  
  console.log('AI Analysis:', {
    strategy: analysis.searchStrategy,
    foundProducts: analysis.products.length,
    searchUrl: analysis.searchUrl
  });

  let allProducts = [...analysis.products];

  // Step 3: If AI found a search URL, try to search there
  if (analysis.searchUrl && allProducts.length === 0) {
    console.log(`Attempting targeted search at: ${analysis.searchUrl}`);
    
    try {
      // Try to construct search URL with product name
      let searchUrlWithProduct = analysis.searchUrl;
      if (!searchUrlWithProduct.includes('?') && !searchUrlWithProduct.includes('=')) {
        // Simple URL, try appending search parameter
        searchUrlWithProduct = `${analysis.searchUrl}?q=${encodeURIComponent(productName)}`;
      }

      const searchScrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: searchUrlWithProduct,
          pageOptions: {
            onlyMainContent: true,
            includeHtml: true
          }
        }),
      });

      if (searchScrapeResponse.ok) {
        const searchData = await searchScrapeResponse.json();
        if (searchData.data?.markdown) {
          const searchAnalysis = await analyzeWebsiteForSearch(
            searchData.data.html || '', 
            searchData.data.markdown, 
            productName, 
            storeName
          );
          allProducts.push(...searchAnalysis.products);
        }
      }
    } catch (searchError) {
      console.error('Search attempt failed:', searchError);
    }
  }

  // Step 4: If still no products, try common e-commerce patterns
  if (allProducts.length === 0) {
    console.log('Trying common e-commerce URL patterns...');
    
    const commonPatterns = [
      `/search?q=${encodeURIComponent(productName)}`,
      `/products?search=${encodeURIComponent(productName)}`,
      `/shop?q=${encodeURIComponent(productName)}`,
      `/?s=${encodeURIComponent(productName)}`
    ];

    for (const pattern of commonPatterns) {
      try {
        const patternUrl = new URL(pattern, website).toString();
        console.log(`Trying pattern: ${patternUrl}`);

        const patternResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: patternUrl,
            pageOptions: {
              onlyMainContent: true,
              includeHtml: true
            }
          }),
        });

        if (patternResponse.ok) {
          const patternData = await patternResponse.json();
          if (patternData.data?.markdown) {
            const patternAnalysis = await analyzeWebsiteForSearch(
              patternData.data.html || '', 
              patternData.data.markdown, 
              productName, 
              storeName
            );
            if (patternAnalysis.products.length > 0) {
              allProducts.push(...patternAnalysis.products);
              break; // Found products, stop searching
            }
          }
        }
      } catch (patternError) {
        console.error(`Pattern ${pattern} failed:`, patternError);
        continue;
      }
    }
  }

  // Remove duplicates and return
  const uniqueProducts = allProducts.filter((product, index, self) => 
    index === self.findIndex(p => p.name === product.name && p.price === product.price)
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
    const products = await searchForProducts(cleanWebsite, productName, storeName);

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