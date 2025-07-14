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
      console.log('OpenAI API key not found, using fallback search terms');
      return new Response(JSON.stringify(generateFallbackSearchTerms(productName)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating search terms for:', productName);

    const prompt = `Given the product "${productName}", identify the types of physical stores in Italy that would sell this product.

Return ONLY store categories, NOT the product name itself.
Maximum 2 categories.
Use Italian terms for store types.

Examples:
- "smartphone" → ["elettronica", "telefonia"]
- "cacciavite" → ["ferramenta", "bricolage"]
- "medicina" → ["farmacia", "parafarmacia"]
- "libro" → ["libreria", "cartoleria"]

Return a JSON object with this structure:
{
  "searchTerms": ["category1", "category2"]
}

Product: ${productName}`;

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
            content: 'You are a search term generator for finding physical stores in Italy. Return only valid JSON.'
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
      return new Response(JSON.stringify(generateFallbackSearchTerms(productName)), {
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
      parsedContent = generateFallbackSearchTerms(productName);
    }
    
    return new Response(JSON.stringify(parsedContent), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-search-strategies function:', error);
    return new Response(JSON.stringify(generateFallbackSearchTerms(productName)), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateFallbackSearchTerms(productName: string): any {
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