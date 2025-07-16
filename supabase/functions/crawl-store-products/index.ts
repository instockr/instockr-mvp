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

// Extract products using OpenAI from a known search URL's raw text
async function extractProductsFromPageWithAI(url: string, productName: string): Promise<ProductMatch[]> {
  console.log(`🔍 Fetching URL: ${url}`);
  
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) throw new Error('Missing OpenAI API Key');

  const html = await fetch(url).then(res => res.text());
  console.log(`📄 HTML length: ${html.length} characters`);
  console.log(`📝 HTML preview (first 1000 chars):\n${html.slice(0, 1000)}`);
  
  const htmlSlice = html.slice(0, 10000);
  const prompt = `You are a smart extraction AI. Given the raw HTML content of a search page from an e-commerce website, extract all products that clearly match the term "${productName}". Only extract real products with actual prices.

Return a JSON array of objects in this format:
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
        { role: 'system', content: 'You extract structured product data from HTML pages.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 1000,
    }),
  });

  console.log(`🤖 OpenAI response status: ${res.status}`);
  const data = await res.json();
  console.log(`🤖 Full OpenAI response:`, JSON.stringify(data, null, 2));
  
  const content = data.choices[0].message.content;
  console.log(`💬 OpenAI content:`, content);
  console.log(`📋 COMPLETE LLM ANSWER (full response):`, JSON.stringify(content));

  try {
    const match = content.match(/\[.*\]/s);
    if (match) {
      console.log(`✅ Found JSON match: ${match[0]}`);
      const products = JSON.parse(match[0]);
      console.log(`✅ Parsed ${products.length} products:`, products);
      return products;
    } else {
      console.log(`❌ No JSON array found in response`);
      return [];
    }
  } catch (error) {
    console.error('❌ Failed to parse JSON:', error);
    console.error('❌ Content was:', content);
    return [];
  }
}

// Main HTTP handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();

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