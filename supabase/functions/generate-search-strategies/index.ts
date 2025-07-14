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
      console.log('OpenAI API key not configured, using fallback strategies');
      // Fallback to basic strategies when OpenAI is not available
      const fallbackStrategies = generateFallbackStrategies(productName);
      return new Response(
        JSON.stringify({
          strategies: fallbackStrategies,
          productName: productName,
          fallback: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
            content: `You are a search strategy expert for finding PHYSICAL STORES in Italy. Given a product, generate multiple targeted search strategies to find physical retail locations that sell this product.

Return a JSON object with this structure:
{
  "strategies": [
    {
      "name": "Strategy Name",
      "query": "search query in Italian/English for physical stores",
      "channels": ["google_maps", "firecrawl"],
      "storeTypes": ["specific physical store types"],
      "priority": 1-5
    }
  ]
}

Focus ONLY on physical stores:
- Italian retail chains and local stores
- Specialized physical retailers
- Department stores, supermarkets, pharmacies
- Electronics stores, hardware stores, etc.
- Use terms like "negozio", "punto vendita", "store", "shop"
- Include specific Italian retail chain names
- Geographic terms for Italian cities/regions

Channels available:
- google_maps: Google Maps Places API (primary for physical stores)
- firecrawl: Web scraping for store finder pages

Generate 6-8 diverse strategies covering different types of physical retailers.`
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
    
    // Fallback to basic strategies if OpenAI fails
    console.log('OpenAI failed, using fallback strategies');
    const fallbackStrategies = generateFallbackStrategies(productName);
    return new Response(
      JSON.stringify({
        strategies: fallbackStrategies,
        productName: productName,
        fallback: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fallback strategy generator when OpenAI is not available
function generateFallbackStrategies(productName: string) {
  const productLower = productName.toLowerCase();
  
  const strategies = [
    {
      name: "General Physical Stores",
      query: `${productName} negozio fisico Italia punto vendita`,
      channels: ["google_maps"],
      storeTypes: ["generale"],
      priority: 5
    },
    {
      name: "Major Retail Chains",
      query: `${productName} MediaWorld Unieuro Trony Euronics negozio`,
      channels: ["google_maps"],
      storeTypes: ["catena"],
      priority: 5
    },
    {
      name: "Local Stores",
      query: `${productName} negozio locale vendita`,
      channels: ["google_maps"],
      storeTypes: ["locale"],
      priority: 4
    }
  ];

  // Add product-specific strategies
  if (productLower.includes('materasso') || productLower.includes('mattress') || productLower.includes('letto')) {
    strategies.push({
      name: "Furniture Stores",
      query: `${productName} materassi negozio arredamento ikea mondo convenienza`,
      channels: ["google_maps"],
      storeTypes: ["arredamento"],
      priority: 5
    });
  }
  
  if (productLower.includes('iphone') || productLower.includes('smartphone') || productLower.includes('telefono')) {
    strategies.push({
      name: "Mobile Stores", 
      query: `${productName} negozio telefonia TIM Vodafone WindTre`,
      channels: ["google_maps"],
      storeTypes: ["telefonia"],
      priority: 5
    });
  }

  if (productLower.includes('cacciavite') || productLower.includes('martello') || productLower.includes('utensili')) {
    strategies.push({
      name: "Hardware Stores",
      query: `${productName} ferramenta negozio bricolage leroy merlin`,
      channels: ["google_maps"],
      storeTypes: ["ferramenta"],
      priority: 5
    });
  }

  return strategies;
}