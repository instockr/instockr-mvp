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
    const { productName, location } = await req.json();
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openAIApiKey) {
      console.log('OpenAI API key not found, using fallback search terms');
      return new Response(JSON.stringify(generateFallbackSearchTerms(productName, location)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating search terms for:', productName, 'in location:', location);

    const prompt = `Given the product "${productName}" and location "${location}", identify the types of physical stores in that location that would sell this product.

Return ONLY store categories, NOT the product name itself.
Maximum 2 categories.
Use the local language appropriate for the location provided.

Guidelines:
- If location is in Italy: use Italian terms
- If location is in France: use French terms  
- If location is in Germany: use German terms
- If location is in Spain: use Spanish terms
- If location is in English-speaking countries (US, UK, etc.): use English terms
- For other locations: use English as default

Examples:
For Italy:
- "smartphone" → ["elettronica", "telefonia"]
- "cacciavite" → ["ferramenta", "bricolage"]
- "medicina" → ["farmacia", "parafarmacia"]

For France:
- "smartphone" → ["électronique", "téléphonie"]
- "tournevis" → ["quincaillerie", "bricolage"]
- "médicament" → ["pharmacie", "parapharmacie"]

For Germany:
- "smartphone" → ["elektronik", "handy"]
- "schraubendreher" → ["baumarkt", "eisenwaren"]
- "medizin" → ["apotheke", "drogerie"]

For English-speaking countries:
- "smartphone" → ["electronics", "phone store"]
- "screwdriver" → ["hardware", "tools"]
- "medicine" → ["pharmacy", "drugstore"]

Return a JSON object with this structure:
{
  "searchTerms": ["category1", "category2"]
}

Product: ${productName}
Location: ${location}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
          {
            role: 'system',
            content: 'You are a search term generator for finding physical stores worldwide. Return only valid JSON with store categories in the appropriate local language.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify(generateFallbackSearchTerms(productName, location)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('OpenAI response:', data);
    
    let parsedContent;
    try {
      parsedContent = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      parsedContent = generateFallbackSearchTerms(productName, location);
    }
    
    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-search-strategies function:', error);
    return new Response(JSON.stringify(generateFallbackSearchTerms(productName, location)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackSearchTerms(productName: string, location?: string): any {
  console.log('Generating fallback search terms for:', productName);
  
  const productSpecificTerms: string[] = [];
  const lowerProductName = productName.toLowerCase();

  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('cellulare')) {
    productSpecificTerms.push("elettronica", "telefonia");
  }
  else if (lowerProductName.includes('computer') || lowerProductName.includes('laptop') || lowerProductName.includes('pc')) {
    productSpecificTerms.push("informatica", "elettronica");
  }
  else if (lowerProductName.includes('book') || lowerProductName.includes('libro')) {
    productSpecificTerms.push("libreria", "cartoleria");
  }
  else if (lowerProductName.includes('medicine') || lowerProductName.includes('farmaco') || lowerProductName.includes('aspirina')) {
    productSpecificTerms.push("farmacia", "parafarmacia");
  }
  else if (lowerProductName.includes('tool') || lowerProductName.includes('cacciavite') || lowerProductName.includes('martello')) {
    productSpecificTerms.push("ferramenta", "bricolage");
  }
  else if (lowerProductName.includes('food') || lowerProductName.includes('cibo')) {
    productSpecificTerms.push("supermercato", "alimentari");
  }
  else if (lowerProductName.includes('materasso') || lowerProductName.includes('mattress')) {
    productSpecificTerms.push("arredamento", "materassi");
  }
  else {
    productSpecificTerms.push("elettronica", "negozi");
  }

  // Return only store categories, max 2
  return {
    searchTerms: productSpecificTerms.slice(0, 2)
  };
}