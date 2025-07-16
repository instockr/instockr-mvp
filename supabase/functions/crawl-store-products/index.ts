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
  image?: string;
}

// Extract products using OpenAI from the raw HTML content of the search page
async function extractProductsWithAI(url: string, productName: string): Promise<ProductMatch[]> {
  console.log(`🔍 Starting AI extraction for: ${productName} from ${url}`);
  
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    console.error('❌ Missing OpenAI API key');
    throw new Error('Missing OpenAI API key');
  }
  
  console.log('✅ OpenAI API key found, length:', openAIApiKey.length);
  console.log('✅ OpenAI API key preview:', openAIApiKey.substring(0, 10) + '...');

  // Fetch the full HTML content of the search results page
  console.log(`📥 Fetching HTML from: ${url}`);
  try {
    const response = await fetch(url);
    console.log(`📡 Fetch response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch page: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const html = await response.text();
    console.log(`📄 HTML content length: ${html.length} characters`);
    console.log(`📝 HTML preview (first 500 chars): ${html.slice(0, 500)}...`);
    
    // Prepare prompt for OpenAI, with a larger slice of HTML to get more products
    const htmlSlice = html.slice(0, 50000);
    console.log(`🧠 Sending ${htmlSlice.length} chars to OpenAI for product extraction`);
    
    const prompt = `You are a smart product extraction AI. Given the raw HTML content of a search page from an e-commerce website, extract all products clearly matching the term "${productName}". Only include products with actual prices.

Return a JSON array of objects like this:
[
  {
    "name": "iPhone 15 Pro 256GB",
    "price": "1.199,00€",
    "url": "https://...",
    "image": "https://...",
    "availability": "in stock",
    "description": "..."
  },
  ...
]

Here is the page content:

${htmlSlice}
`;

    console.log(`🤖 Calling OpenAI API with prompt length: ${prompt.length} characters`);
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You extract structured product data from raw HTML pages.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 1200,
      }),
    });

    console.log(`🤖 OpenAI API response status: ${aiResponse.status} ${aiResponse.statusText}`);
    
    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`❌ OpenAI API error: ${errorText}`);
      return [];
    }

    const data = await aiResponse.json();
    console.log(`📊 OpenAI response data:`, JSON.stringify(data, null, 2));
    
    const content = data.choices[0].message.content;
    console.log(`💬 OpenAI response content: ${content}`);

    try {
      const match = content.match(/\[.*\]/s);
      if (match) {
        const products = JSON.parse(match[0]);
        console.log(`✅ Successfully extracted ${products.length} products:`, products);
        return products;
      } else {
        console.error('❌ No JSON array found in AI response:', content);
        return [];
      }
    } catch (e) {
      console.error('❌ Failed to parse AI response:', content, e);
      return [];
    }
  } catch (fetchError) {
    console.error('❌ Error fetching HTML:', fetchError);
    return [];
  }
}

serve(async (req) => {
  console.log('🚀🚀🚀 === CRAWL FUNCTION STARTED === 🚀🚀🚀');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', Object.fromEntries(req.headers.entries()));
  
  if (req.method === 'OPTIONS') {
    console.log('📝 OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Crawl request received - processing POST request');

  try {
    const requestBody = await req.json();
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    const { storeName, website, productName }: CrawlRequest = requestBody;

    if (!website || !productName) {
      console.error('❌ Missing required fields - website:', !!website, 'productName:', !!productName);
      return new Response(
        JSON.stringify({ error: 'Missing input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🏪 Crawling ${storeName} for ${productName} at ${website}`);

    // Determine the appropriate search URL based on the website
    let searchUrl: string;
    const baseUrl = new URL(website).origin;
    console.log(`🌐 Base URL: ${baseUrl}`);
    
    if (website.includes('apple.com') && website.includes('/retail/')) {
      // Apple retail stores - try their main product search
      searchUrl = `https://www.apple.com/de/search/${encodeURIComponent(productName)}?tab=products`;
      console.log(`🍎 Apple retail store detected, using Apple search`);
    } else if (website.includes('saturn.de')) {
      // Saturn - use their search endpoint
      searchUrl = `https://www.saturn.de/de/search.html?query=${encodeURIComponent(productName)}`;
      console.log(`🪐 Saturn store detected, using Saturn search`);
    } else if (website.includes('mediamarkt.de')) {
      // MediaMarkt - use their search endpoint  
      searchUrl = `https://www.mediamarkt.de/de/search.html?query=${encodeURIComponent(productName)}`;
      console.log(`📺 MediaMarkt store detected, using MediaMarkt search`);
    } else {
      // Generic approach - try common search patterns
      const domain = new URL(website).hostname;
      if (domain.includes('.de')) {
        searchUrl = `${baseUrl}/de/search?q=${encodeURIComponent(productName)}`;
        console.log(`🇩🇪 German site detected, using DE search pattern`);
      } else {
        searchUrl = `${baseUrl}/search?q=${encodeURIComponent(productName)}`;
        console.log(`🌍 Generic site, using standard search pattern`);
      }
    }

    console.log(`🔗 Final search URL: ${searchUrl}`);

    // Use AI to extract products from the search results page
    console.log(`🚀 Starting product extraction...`);
    const products = await extractProductsWithAI(searchUrl, productName);
    
    console.log(`✅ Extraction complete! Found ${products.length} products`);
    console.log(`📦 Returning products:`, JSON.stringify(products, null, 2));

    return new Response(
      JSON.stringify({ products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Fatal error in crawl function:', error);
    console.error('❌ Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: 'Internal error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});