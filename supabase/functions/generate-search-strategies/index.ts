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

    const prompt = `
    You are an expert at finding physical stores in Italy that sell specific products.
    Given a product name, generate a list of search terms that will help find physical stores selling this product.
    
    Product: ${productName}
    
    Return a JSON object with this structure:
    {
      "searchTerms": ["term1", "term2", "term3", ...]
    }
    
    Generate 3-5 search terms that represent:
    1. Different store types (e.g., "ferramenta" for tools, "farmacia" for medicine)
    2. Product categories (e.g., "elettronica" for electronics)
    3. Specific Italian store chains that might sell this product
    
    Keep terms simple and focused on physical store types in Italy.
    Examples:
    - For "cacciavite": ["ferramenta", "bricolage", "fai da te", "elettronica"]
    - For "aspirina": ["farmacia", "parafarmacia"]
    - For "smartphone": ["elettronica", "telefonia", "negozi di cellulari"]
  `;

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
  
  const baseTerms = [productName, "negozi"];
  const productSpecificTerms: string[] = [];
  const lowerProductName = productName.toLowerCase();

  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('cellulare')) {
    productSpecificTerms.push("telefonia", "negozi di cellulari", "elettronica");
  }

  if (lowerProductName.includes('computer') || lowerProductName.includes('laptop') || lowerProductName.includes('pc')) {
    productSpecificTerms.push("computer", "informatica", "elettronica");
  }

  if (lowerProductName.includes('book') || lowerProductName.includes('libro')) {
    productSpecificTerms.push("librerie", "libri");
  }

  if (lowerProductName.includes('medicine') || lowerProductName.includes('farmaco') || lowerProductName.includes('aspirina')) {
    productSpecificTerms.push("farmacia", "parafarmacia");
  }

  if (lowerProductName.includes('tool') || lowerProductName.includes('cacciavite') || lowerProductName.includes('martello')) {
    productSpecificTerms.push("ferramenta", "bricolage", "fai da te");
  }

  if (lowerProductName.includes('food') || lowerProductName.includes('cibo')) {
    productSpecificTerms.push("supermercato", "alimentari");
  }

  if (lowerProductName.includes('materasso') || lowerProductName.includes('mattress')) {
    productSpecificTerms.push("arredamento", "materassi", "mobili");
  }

  // Add general electronics term if no specific category found
  if (productSpecificTerms.length === 0) {
    productSpecificTerms.push("elettronica", "negozi specializzati");
  }

  return {
    searchTerms: [...baseTerms, ...productSpecificTerms]
  };
}