import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    
    // Use AI-powered category matching
    const searchTerms = await generateAISearchTerms(productName, location);
    
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

async function generateAISearchTerms(productName: string, location?: string): Promise<string[]> {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call AI category matcher
    const { data, error } = await supabase.functions.invoke('ai-category-matcher', {
      body: { productName }
    });

    if (error) {
      console.error('AI category matcher error:', error);
      return getFallbackCategories(productName);
    }

    console.log('AI matched categories:', data.categories);
    return data.categories || getFallbackCategories(productName);

  } catch (error) {
    console.error('Error calling AI category matcher:', error);
    return getFallbackCategories(productName);
  }
}

function getFallbackCategories(productName: string): string[] {
  const lowerProductName = productName.toLowerCase();
  
  // Simple keyword-based fallback
  if (lowerProductName.includes('phone') || lowerProductName.includes('smartphone') || lowerProductName.includes('iphone')) {
    return ['shop=mobile_phone', 'shop=electronics'];
  }
  if (lowerProductName.includes('computer') || lowerProductName.includes('laptop')) {
    return ['shop=computer', 'shop=electronics'];
  }
  if (lowerProductName.includes('tool') || lowerProductName.includes('hammer') || lowerProductName.includes('tape')) {
    return ['shop=hardware', 'shop=doityourself'];
  }
  if (lowerProductName.includes('medicine') || lowerProductName.includes('aspirin')) {
    return ['amenity=pharmacy', 'shop=chemist'];
  }
  if (lowerProductName.includes('book')) {
    return ['shop=books', 'shop=stationery'];
  }
  if (lowerProductName.includes('clothes') || lowerProductName.includes('shirt')) {
    return ['shop=clothes', 'shop=fashion'];
  }
  if (lowerProductName.includes('food') || lowerProductName.includes('grocery')) {
    return ['shop=supermarket', 'shop=convenience'];
  }
  
  // Default fallback
  return ['shop=department_store', 'shop=general'];
}
