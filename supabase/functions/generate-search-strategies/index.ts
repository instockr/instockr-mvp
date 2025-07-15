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

    const prompt = `You are an expert at identifying which types of physical stores sell specific products. 

Given the product "${productName}" and location "${location}", identify the 2 most relevant types of physical stores that would actually sell this specific product.

CRITICAL RULES:
1. Think carefully about what the product actually IS and where it would realistically be sold
2. Return ONLY specific store categories, NOT generic terms like "negozi" (stores) or "shops"
3. Use the local language appropriate for the location
4. Maximum 2 categories that are the MOST likely to have this product

Language Guidelines:
- Italy: Use Italian store category terms
- France: Use French store category terms
- Germany: Use German store category terms
- Spain: Use Spanish store category terms
- English-speaking countries: Use English terms
- Other locations: Use English as default

DETAILED EXAMPLES by product type:

Electronics & Technology:
- "smartphone" (Italy) → ["elettronica", "telefonia"]
- "laptop" (France) → ["informatique", "électronique"]
- "headphones" (Germany) → ["elektronik", "multimedia"]

Hardware & Tools:
- "nastro adesivo/duct tape" (Italy) → ["ferramenta", "bricolage"]
- "tournevis/screwdriver" (France) → ["quincaillerie", "bricolage"] 
- "hammer" (Germany) → ["baumarkt", "eisenwaren"]
- "drill" (English) → ["hardware", "tools"]

Health & Medicine:
- "aspirina" (Italy) → ["farmacia", "parafarmacia"]
- "vitamines" (France) → ["pharmacie", "parapharmacie"]
- "pain reliever" (English) → ["pharmacy", "drugstore"]

Home & Garden:
- "paint" → ["paint store", "hardware"] (English) / ["vernici", "ferramenta"] (Italy)
- "soil" → ["garden center", "nursery"] (English) / ["vivaio", "giardinaggio"] (Italy)

Automotive:
- "car battery" → ["auto parts", "automotive"] (English) / ["ricambi auto", "autofficina"] (Italy)
- "motor oil" → ["auto shop", "gas station"] (English) / ["stazione servizio", "ricambi auto"] (Italy)

Books & Stationery:
- "notebook" → ["stationery", "bookstore"] (English) / ["cartoleria", "libreria"] (Italy)
- "pen" → ["office supplies", "stationery"] (English) / ["cartoleria", "ufficio"] (Italy)

Food & Groceries:
- "bread" → ["bakery", "grocery"] (English) / ["panetteria", "supermercato"] (Italy)
- "meat" → ["butcher", "grocery"] (English) / ["macelleria", "supermercato"] (Italy)

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
        messages: [
          {
            role: 'system',
            content: 'You are a search term generator for finding physical stores worldwide. Return only valid JSON with store categories in the appropriate local language.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
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

  // Electronics & Technology
  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('cellulare')) {
    productSpecificTerms.push("elettronica", "telefonia");
  }
  else if (lowerProductName.includes('computer') || lowerProductName.includes('laptop') || lowerProductName.includes('pc')) {
    productSpecificTerms.push("informatica", "elettronica");
  }
  
  // Hardware & Tools - INCLUDING TAPE/ADHESIVES
  else if (lowerProductName.includes('nastro') || lowerProductName.includes('adesivo') || lowerProductName.includes('tape') || lowerProductName.includes('duct')) {
    productSpecificTerms.push("ferramenta", "bricolage");
  }
  else if (lowerProductName.includes('tool') || lowerProductName.includes('cacciavite') || lowerProductName.includes('martello') || lowerProductName.includes('chiave')) {
    productSpecificTerms.push("ferramenta", "bricolage");
  }
  else if (lowerProductName.includes('viti') || lowerProductName.includes('bulloni') || lowerProductName.includes('chiodi')) {
    productSpecificTerms.push("ferramenta", "bricolage");
  }
  
  // Health & Medicine
  else if (lowerProductName.includes('medicine') || lowerProductName.includes('farmaco') || lowerProductName.includes('aspirina')) {
    productSpecificTerms.push("farmacia", "parafarmacia");
  }
  
  // Books & Stationery
  else if (lowerProductName.includes('book') || lowerProductName.includes('libro')) {
    productSpecificTerms.push("libreria", "cartoleria");
  }
  else if (lowerProductName.includes('penna') || lowerProductName.includes('matita') || lowerProductName.includes('quaderno')) {
    productSpecificTerms.push("cartoleria", "libreria");
  }
  
  // Food & Groceries
  else if (lowerProductName.includes('food') || lowerProductName.includes('cibo') || lowerProductName.includes('pasta') || lowerProductName.includes('pane')) {
    productSpecificTerms.push("supermercato", "alimentari");
  }
  
  // Home & Furniture
  else if (lowerProductName.includes('materasso') || lowerProductName.includes('mattress')) {
    productSpecificTerms.push("arredamento", "materassi");
  }
  else if (lowerProductName.includes('mobili') || lowerProductName.includes('furniture')) {
    productSpecificTerms.push("arredamento", "mobili");
  }
  
  // Clothing
  else if (lowerProductName.includes('vestiti') || lowerProductName.includes('clothes') || lowerProductName.includes('maglietta')) {
    productSpecificTerms.push("abbigliamento", "moda");
  }
  
  // Default fallback - use more general but still specific terms
  else {
    productSpecificTerms.push("ferramenta", "supermercato");
  }

  // Return only store categories, max 2
  return {
    searchTerms: productSpecificTerms.slice(0, 2)
  };
}