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
3. Use the local language appropriate for the location - THIS IS CRITICAL
4. Maximum 2 categories that are the MOST likely to have this product

Language Guidelines:
- Germany/Austria/Switzerland (German areas): Use German store category terms
- Italy: Use Italian store category terms
- France/Belgium (French areas): Use French store category terms
- Spain: Use Spanish store category terms
- English-speaking countries: Use English terms
- Other locations: Use English as default

DETAILED EXAMPLES by product type and location:

Electronics & Technology:
- "iPhone" in Germany → ["elektronik", "handyladen"]
- "smartphone" in Italy → ["elettronica", "telefonia"]
- "laptop" in France → ["informatique", "électronique"]
- "headphones" in Germany → ["elektronik", "multimedia"]

Hardware & Tools:
- "duct tape" in Germany → ["baumarkt", "eisenwaren"]
- "nastro adesivo" in Italy → ["ferramenta", "bricolage"]
- "tournevis" in France → ["quincaillerie", "bricolage"] 
- "drill" in English → ["hardware", "tools"]

Health & Medicine:
- "aspirin" in Germany → ["apotheke", "drogerie"]
- "aspirina" in Italy → ["farmacia", "parafarmacia"]
- "vitamines" in France → ["pharmacie", "parapharmacie"]

Home & Garden:
- "paint" in Germany → ["baumarkt", "farben"]
- "paint" in English → ["hardware", "paint store"]
- "vernice" in Italy → ["ferramenta", "vernici"]

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
  console.log('Generating fallback search terms for:', productName, 'in location:', location);
  
  // Determine language based on location
  const isGerman = location && (location.includes('Germany') || location.includes('Deutschland') || location.includes('Austria') || location.includes('Switzerland') || location.includes('Frankfurt') || location.includes('Berlin') || location.includes('München'));
  const isItalian = location && (location.includes('Italy') || location.includes('Italia') || location.includes('Rome') || location.includes('Milan') || location.includes('Milano'));
  const isFrench = location && (location.includes('France') || location.includes('Paris') || location.includes('Lyon') || location.includes('Belgium') || location.includes('Belgique'));
  const isSpanish = location && (location.includes('Spain') || location.includes('España') || location.includes('Madrid') || location.includes('Barcelona'));
  
  const productSpecificTerms: string[] = [];
  const lowerProductName = productName.toLowerCase();

  // Electronics & Technology
  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('iphone') || lowerProductName.includes('cellulare')) {
    if (isGerman) {
      productSpecificTerms.push("elektronik", "handyladen");
    } else if (isItalian) {
      productSpecificTerms.push("elettronica", "telefonia");
    } else if (isFrench) {
      productSpecificTerms.push("électronique", "téléphonie");
    } else if (isSpanish) {
      productSpecificTerms.push("electrónica", "telefonía");
    } else {
      productSpecificTerms.push("electronics", "mobile");
    }
  }
  else if (lowerProductName.includes('computer') || lowerProductName.includes('laptop') || lowerProductName.includes('pc')) {
    if (isGerman) {
      productSpecificTerms.push("elektronik", "computer");
    } else if (isItalian) {
      productSpecificTerms.push("informatica", "elettronica");
    } else if (isFrench) {
      productSpecificTerms.push("informatique", "électronique");
    } else if (isSpanish) {
      productSpecificTerms.push("informática", "electrónica");
    } else {
      productSpecificTerms.push("electronics", "computer");
    }
  }
  
  // Hardware & Tools
  else if (lowerProductName.includes('tape') || lowerProductName.includes('duct') || lowerProductName.includes('nastro') || lowerProductName.includes('adesivo')) {
    if (isGerman) {
      productSpecificTerms.push("baumarkt", "eisenwaren");
    } else if (isItalian) {
      productSpecificTerms.push("ferramenta", "bricolage");
    } else if (isFrench) {
      productSpecificTerms.push("quincaillerie", "bricolage");
    } else if (isSpanish) {
      productSpecificTerms.push("ferretería", "bricolaje");
    } else {
      productSpecificTerms.push("hardware", "tools");
    }
  }
  else if (lowerProductName.includes('tool') || lowerProductName.includes('hammer') || lowerProductName.includes('drill')) {
    if (isGerman) {
      productSpecificTerms.push("baumarkt", "werkzeug");
    } else if (isItalian) {
      productSpecificTerms.push("ferramenta", "bricolage");
    } else if (isFrench) {
      productSpecificTerms.push("quincaillerie", "outillage");
    } else if (isSpanish) {
      productSpecificTerms.push("ferretería", "herramientas");
    } else {
      productSpecificTerms.push("hardware", "tools");
    }
  }
  
  // Health & Medicine
  else if (lowerProductName.includes('medicine') || lowerProductName.includes('aspirin') || lowerProductName.includes('farmaco') || lowerProductName.includes('aspirina')) {
    if (isGerman) {
      productSpecificTerms.push("apotheke", "drogerie");
    } else if (isItalian) {
      productSpecificTerms.push("farmacia", "parafarmacia");
    } else if (isFrench) {
      productSpecificTerms.push("pharmacie", "parapharmacie");
    } else if (isSpanish) {
      productSpecificTerms.push("farmacia", "parafarmacia");
    } else {
      productSpecificTerms.push("pharmacy", "drugstore");
    }
  }
  
  // Books & Stationery
  else if (lowerProductName.includes('book') || lowerProductName.includes('libro') || lowerProductName.includes('pen') || lowerProductName.includes('notebook')) {
    if (isGerman) {
      productSpecificTerms.push("buchhandlung", "schreibwaren");
    } else if (isItalian) {
      productSpecificTerms.push("libreria", "cartoleria");
    } else if (isFrench) {
      productSpecificTerms.push("librairie", "papeterie");
    } else if (isSpanish) {
      productSpecificTerms.push("librería", "papelería");
    } else {
      productSpecificTerms.push("bookstore", "stationery");
    }
  }
  
  // Food & Groceries
  else if (lowerProductName.includes('food') || lowerProductName.includes('bread') || lowerProductName.includes('cibo') || lowerProductName.includes('pane')) {
    if (isGerman) {
      productSpecificTerms.push("supermarkt", "lebensmittel");
    } else if (isItalian) {
      productSpecificTerms.push("supermercato", "alimentari");
    } else if (isFrench) {
      productSpecificTerms.push("supermarché", "alimentation");
    } else if (isSpanish) {
      productSpecificTerms.push("supermercado", "alimentación");
    } else {
      productSpecificTerms.push("grocery", "supermarket");
    }
  }
  
  // Default fallback
  else {
    if (isGerman) {
      productSpecificTerms.push("baumarkt", "supermarkt");
    } else if (isItalian) {
      productSpecificTerms.push("ferramenta", "supermercato");
    } else if (isFrench) {
      productSpecificTerms.push("quincaillerie", "supermarché");
    } else if (isSpanish) {
      productSpecificTerms.push("ferretería", "supermercado");
    } else {
      productSpecificTerms.push("hardware", "store");
    }
  }

  // Return only store categories, max 2
  return {
    searchTerms: productSpecificTerms.slice(0, 2)
  };
}