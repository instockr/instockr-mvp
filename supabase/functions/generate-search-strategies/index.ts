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
    const { productName } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating search strategies for:', productName);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are a search strategy expert for the Italian market. Given a product, generate multiple targeted search strategies to find where that product is sold online in Italy.

Return a JSON object with this structure:
{
  "strategies": [
    {
      "name": "Strategy Name",
      "query": "search query in Italian/English",
      "channels": ["google_shopping", "firecrawl", "google_maps"],
      "storeTypes": ["specific store types"],
      "priority": 1-5
    }
  ]
}

Focus on:
- Italian market specifics
- Different types of stores that sell this product
- Major Italian e-commerce sites
- Specialized retailers
- Price comparison sites
- Local store chains
- Generic and specific search terms

Channels available:
- firecrawl: Web scraping
- google_shopping: Google Shopping API
- google_maps: Google Maps Places API
- price_comparison: Price comparison sites

Generate 8-12 diverse strategies covering different angles.`
          },
          {
            role: 'user',
            content: `Product: ${productName}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate search strategies' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const strategies = JSON.parse(data.choices[0].message.content);
    
    console.log('Generated strategies:', strategies.strategies?.length || 0);

    return new Response(
      JSON.stringify({
        strategies: strategies.strategies || [],
        productName: productName
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-search-strategies function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});