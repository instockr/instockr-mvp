import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('🚀 EDGE FUNCTION MODULE LOADED');

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
  image?: string;
}

// Extract products using OpenAI from a known search URL's raw text
async function extractProductsFromPageWithAI(url: string, productName: string): Promise<ProductMatch[]> {
  console.log(`🔍 Fetching URL: ${url}`);
  
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) throw new Error('Missing OpenAI API Key');

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`❌ Failed to fetch URL: ${response.status} ${response.statusText}`);
      return [];
    }

    const html = await response.text();
    console.log(`📄 HTML length: ${html.length} characters`);
    console.log(`📝 HTML preview (first 1000 chars):\n${html.slice(0, 1000)}`);
    
    // Check if we got a meaningful page (not an error page)
    if (html.includes('404') || html.includes('Not Found') || html.includes('Page Not Found') || html.length < 1000) {
      console.log(`❌ Received error page or page too small`);
      return [];
    }
    
    const htmlSlice = html.slice(0, 50000);
    const prompt = `You are a product extraction specialist. Analyze this HTML from an e-commerce website and extract ONLY real products that match "${productName}".

CRITICAL RULES:
- Extract ONLY products that actually exist on this page
- If no matching products are found, return an empty array []
- Do NOT invent or create fake products
- Do NOT use placeholder URLs or made-up prices
- Extract actual URLs, prices, and product names from the HTML

Return ONLY a JSON array. If no products found, return [].

Required format for found products:
[
  {
    "name": "exact product name from page",
    "price": "exact price from page", 
    "url": "actual product URL from page",
    "image": "actual image URL from page",
    "availability": "stock status if available",
    "description": "product description if available"
  }
]

HTML content:
${htmlSlice}`;

    console.log(`🤖 Sending prompt to OpenAI (${prompt.length} chars)`);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a precise data extractor. Only extract real data that exists in the provided HTML. Never invent or hallucinate data.' 
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 1500,
      }),
    });

    console.log(`🤖 OpenAI response status: ${res.status}`);
    
    if (!res.ok) {
      const errorData = await res.json();
      console.log(`❌ OpenAI API error:`, errorData);
      if (res.status === 429) {
        console.log(`❌ Rate limit exceeded`);
      }
      return [];
    }

    const data = await res.json();
    console.log(`🤖 Full OpenAI response:`, JSON.stringify(data, null, 2));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.log(`❌ Invalid OpenAI response structure`);
      return [];
    }
    
    const content = data.choices[0].message.content;
    console.log(`💬 OpenAI content:`, content);
    console.log(`📋 COMPLETE LLM ANSWER (full response):`, JSON.stringify(content));

    try {
      const match = content.match(/\[.*\]/s);
      if (match) {
        console.log(`✅ Found JSON match: ${match[0]}`);
        const products = JSON.parse(match[0]);
        console.log(`✅ Parsed ${products.length} products:`, products);
        
        // Validate that products have real URLs and aren't fake
        const validProducts = products.filter((product: any) => {
          const hasValidUrl = product.url && 
            typeof product.url === 'string' && 
            product.url.startsWith('http') &&
            !product.url.includes('...') &&
            !product.url.includes('example.com');
            
          const hasValidPrice = product.price && 
            typeof product.price === 'string' &&
            product.price.trim() !== '';
            
          return hasValidUrl && hasValidPrice;
        });
        
        console.log(`✅ Filtered to ${validProducts.length} valid products`);
        return validProducts;
      } else {
        console.log(`❌ No JSON array found in response`);
        return [];
      }
    } catch (error) {
      console.error('❌ Failed to parse JSON:', error);
      console.error('❌ Content was:', content);
      return [];
    }
  } catch (error) {
    console.error('❌ Error in extractProductsFromPageWithAI:', error);
    return [];
  }
}

// Main HTTP handler
serve(async (req) => {
  console.log('🔥🔥🔥 EDGE FUNCTION CALLED - This should appear in logs!');
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();
    console.log(`🚀 NEW VERSION: Processing request for store: ${storeName}, website: ${website}, product: ${productName}`);

    if (!website || !productName) {
      return new Response(JSON.stringify({ error: 'Missing input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct search URL based on the store
    let searchUrl: string;
    
    if (website.includes('home24.de')) {
      // For home24, use the main website search
      searchUrl = `https://www.home24.de/search/?q=${encodeURIComponent(productName)}`;
    } else if (website.includes('saturn.de')) {
      // For Saturn, use the store-specific search
      searchUrl = `${website.replace(/\/$/, '')}/de/search.html?query=${encodeURIComponent(productName)}`;
    } else {
      // Default fallback: try to use the main domain for search
      const domain = new URL(website).origin;
      searchUrl = `${domain}/search?q=${encodeURIComponent(productName)}`;
    }
    
    console.log(`🔗 Constructed search URL: ${searchUrl}`);
    const products = await extractProductsFromPageWithAI(searchUrl, productName);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', products: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});