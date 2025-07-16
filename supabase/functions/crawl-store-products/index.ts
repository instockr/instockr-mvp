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
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('Missing OpenAI API key');
  }

  // Fetch the full HTML content of the search results page
  const html = await fetch(url).then(res => res.text());

  // Prepare prompt for OpenAI, with a larger slice of HTML to get more products
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

${html.slice(0, 50000)}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
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

  if (!response.ok) {
    console.error('OpenAI API error:', await response.text());
    return [];
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  try {
    const match = content.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    } else {
      console.error('No JSON array found in AI response:', content);
      return [];
    }
  } catch (e) {
    console.error('Failed to parse AI response:', content, e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();

    if (!website || !productName) {
      return new Response(
        JSON.stringify({ error: 'Missing input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct the search URL for Saturn
    const searchUrl = `${website.replace(/\/$/, '')}/de/search.html?query=${encodeURIComponent(productName)}`;

    // Use AI to extract products from the search results page
    const products = await extractProductsWithAI(searchUrl, productName);

    return new Response(
      JSON.stringify({ products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});