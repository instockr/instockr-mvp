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
    console.log('Generating search terms for:', productName, 'in location:', location);
    
    // Use direct mapping to valid OSM shop categories
    const searchTerms = generateOSMSearchTerms(productName, location);
    
    return new Response(JSON.stringify({ searchTerms }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-search-strategies function:', error);
    return new Response(JSON.stringify({ searchTerms: ['shop=electronics', 'shop=mobile_phone'] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateOSMSearchTerms(productName: string, location?: string): string[] {
  console.log('Generating OSM search terms for:', productName, 'in location:', location);
  
  const lowerProductName = productName.toLowerCase();
  const searchTerms: string[] = [];

  // Electronics & Technology
  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('iphone') || lowerProductName.includes('cellulare')) {
    searchTerms.push('shop=mobile_phone', 'shop=electronics');
  }
  else if (lowerProductName.includes('computer') || lowerProductName.includes('laptop') || lowerProductName.includes('pc')) {
    searchTerms.push('shop=computer', 'shop=electronics');
  }
  else if (lowerProductName.includes('camera') || lowerProductName.includes('photo')) {
    searchTerms.push('shop=camera', 'shop=electronics');
  }
  else if (lowerProductName.includes('tv') || lowerProductName.includes('television') || lowerProductName.includes('hifi')) {
    searchTerms.push('shop=hifi', 'shop=electronics');
  }
  else if (lowerProductName.includes('video') || lowerProductName.includes('games') || lowerProductName.includes('gaming')) {
    searchTerms.push('shop=video_games', 'shop=electronics');
  }
  
  // Hardware & Tools
  else if (lowerProductName.includes('tool') || lowerProductName.includes('hammer') || lowerProductName.includes('drill') || lowerProductName.includes('tape') || lowerProductName.includes('duct')) {
    searchTerms.push('shop=hardware', 'shop=doityourself');
  }
  else if (lowerProductName.includes('paint') || lowerProductName.includes('vernice')) {
    searchTerms.push('shop=paint', 'shop=hardware');
  }
  
  // Health & Medicine
  else if (lowerProductName.includes('medicine') || lowerProductName.includes('aspirin') || lowerProductName.includes('farmaco') || lowerProductName.includes('aspirina') || lowerProductName.includes('pharmacy')) {
    searchTerms.push('amenity=pharmacy', 'shop=chemist');
  }
  
  // Books & Stationery
  else if (lowerProductName.includes('book') || lowerProductName.includes('libro')) {
    searchTerms.push('shop=books', 'shop=stationery');
  }
  else if (lowerProductName.includes('pen') || lowerProductName.includes('notebook') || lowerProductName.includes('paper')) {
    searchTerms.push('shop=stationery', 'shop=books');
  }
  
  // Clothing & Fashion
  else if (lowerProductName.includes('cloth') || lowerProductName.includes('shirt') || lowerProductName.includes('dress') || lowerProductName.includes('fashion')) {
    searchTerms.push('shop=clothes', 'shop=fashion');
  }
  else if (lowerProductName.includes('shoes') || lowerProductName.includes('boots')) {
    searchTerms.push('shop=shoes', 'shop=clothes');
  }
  
  // Food & Groceries
  else if (lowerProductName.includes('food') || lowerProductName.includes('bread') || lowerProductName.includes('cibo') || lowerProductName.includes('pane') || lowerProductName.includes('grocery')) {
    searchTerms.push('shop=supermarket', 'shop=convenience');
  }
  else if (lowerProductName.includes('coffee') || lowerProductName.includes('caffè')) {
    searchTerms.push('shop=coffee', 'amenity=cafe');
  }
  else if (lowerProductName.includes('alcohol') || lowerProductName.includes('wine') || lowerProductName.includes('beer')) {
    searchTerms.push('shop=alcohol', 'shop=wine');
  }
  
  // Sports & Outdoor
  else if (lowerProductName.includes('sport') || lowerProductName.includes('bike') || lowerProductName.includes('fitness')) {
    searchTerms.push('shop=sports', 'shop=bicycle');
  }
  
  // Automotive
  else if (lowerProductName.includes('car') || lowerProductName.includes('auto') || lowerProductName.includes('tire')) {
    searchTerms.push('shop=car', 'shop=car_parts');
  }
  
  // Beauty & Personal Care
  else if (lowerProductName.includes('cosmetic') || lowerProductName.includes('beauty') || lowerProductName.includes('perfume')) {
    searchTerms.push('shop=cosmetics', 'shop=perfumery');
  }
  else if (lowerProductName.includes('hairdresser') || lowerProductName.includes('hair')) {
    searchTerms.push('shop=hairdresser', 'shop=beauty');
  }
  
  // Home & Garden
  else if (lowerProductName.includes('furniture') || lowerProductName.includes('mobili')) {
    searchTerms.push('shop=furniture', 'shop=interior_decoration');
  }
  else if (lowerProductName.includes('garden') || lowerProductName.includes('plant') || lowerProductName.includes('flower')) {
    searchTerms.push('shop=garden_centre', 'shop=florist');
  }
  
  // Jewelry & Watches
  else if (lowerProductName.includes('jewelry') || lowerProductName.includes('watch') || lowerProductName.includes('ring')) {
    searchTerms.push('shop=jewelry', 'shop=watches');
  }
  
  // Musical Instruments
  else if (lowerProductName.includes('music') || lowerProductName.includes('instrument') || lowerProductName.includes('guitar')) {
    searchTerms.push('shop=musical_instrument', 'shop=music');
  }
  
  // Toys & Games
  else if (lowerProductName.includes('toy') || lowerProductName.includes('game') || lowerProductName.includes('children')) {
    searchTerms.push('shop=toys', 'shop=games');
  }
  
  // Default fallback to general categories
  if (searchTerms.length === 0) {
    searchTerms.push('shop=department_store', 'shop=general');
  }

  // Return only the first 2 categories
  return searchTerms.slice(0, 2);
}

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