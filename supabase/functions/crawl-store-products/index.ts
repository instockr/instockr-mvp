// AI-powered Saturn iPhone scraper using only OpenAI (no Firecrawl)
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
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) throw new Error('Missing OpenAI API Key');

  const html = await fetch(url).then(res => res.text());
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

${html.slice(0, 10000)}`;

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

  const data = await res.json();
  const content = data.choices[0].message.content;

  try {
    const match = content.match(/\[.*\]/s);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    console.error('Failed to parse:', content);
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

    // Construct direct search URL (works for Saturn)
    const searchUrl = `${website.replace(/\/$/, '')}/de/search.html?query=${encodeURIComponent(productName)}`;
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