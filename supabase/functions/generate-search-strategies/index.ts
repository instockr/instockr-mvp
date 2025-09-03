import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { OSM_SHOP_CATEGORIES, CATEGORY_DESCRIPTIONS } from '../osm-shop-categories.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

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
    console.log('Generating search terms for:', productName);

    // Use AI-powered category matching
    const searchTerms = await generateAISearchTerms(productName, location);

    return new Response(JSON.stringify({ searchTerms }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-search-strategies function:', error);
    return new Response(JSON.stringify({
      error: 'Unable to process product name. Please try a different product.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function generateAISearchTerms(productName: string, location?: string): Promise<string[]> {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      // @deno-types
      Deno.env.get('SUPABASE_URL') ?? '',
      // @deno-types
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Normalize product name for consistent matching
    const normalizedProductName = productName.toLowerCase().trim();

    // Check if we have cached categories for this product
    const { data: cachedProduct, error: cacheError } = await supabase
      .from('product_categories')
      .select('categories')
      .eq('product_name_normalized', normalizedProductName)
      .maybeSingle();

    if (cachedProduct && !cacheError) {
      console.log(`Found cached categories for "${productName}":`, cachedProduct.categories);
      return cachedProduct.categories;
    }

    console.log('No cached categories found, running AI categorization...');

    // Check if HF token exists
    const hfToken = Deno.env.get('HUGGING_FACE_ACCESS_TOKEN');
    if (!hfToken) {
      console.error('HUGGING_FACE_ACCESS_TOKEN not found');
      return [];
    }
    console.log('HF Token available:', hfToken.substring(0, 10) + '...');

    // Use Hugging Face for semantic similarity
    const hf = new HfInference(hfToken);

    console.log('Generating similarities for:', normalizedProductName);

    // Use sentence similarity with timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('HF API timeout')), 10000) // 10 second timeout
    );

    const similarityPromise = hf.sentenceSimilarity({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: {
        source_sentence: normalizedProductName,
        sentences: OSM_SHOP_CATEGORIES.map(category =>
          CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS] || category
        )
      }
    });

    const similarities = await Promise.race([similarityPromise, timeoutPromise]);

    console.log('Similarities received:', similarities);

    // Sort and select top 3
    const scored = OSM_SHOP_CATEGORIES.map((category, i) => ({
      category,
      similarity: similarities[i],
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    const topCategories = scored.slice(0, 3).map(item => item.category);

    console.log(`Top categories for "${productName}":`, topCategories);

    // Save to cache for future use
    try {
      const { error: insertError } = await supabase
        .from('product_categories')
        .insert({
          product_name: productName,
          product_name_normalized: normalizedProductName,
          categories: topCategories
        });

      if (insertError) {
        console.log('Error saving to cache:', insertError);
      } else {
        console.log('Successfully cached categories for future use');
      }
    } catch (insertError) {
      console.log('Error inserting cache:', insertError);
    }

    return topCategories;

  } catch (error) {
    console.error('Error in AI categorization:', error);
    // If AI fails or times out, return fallback categories based on common products
    console.log('Using fallback categories for:', productName);
    
    const productLower = productName.toLowerCase();
    if (productLower.includes('phone') || productLower.includes('iphone') || productLower.includes('samsung')) {
      return ['shop=mobile_phone', 'shop=electronics'];
    } else if (productLower.includes('laptop') || productLower.includes('computer') || productLower.includes('pc')) {
      return ['shop=computer', 'shop=electronics'];  
    } else if (productLower.includes('tv') || productLower.includes('tablet')) {
      return ['shop=electronics'];
    } else {
      // Generic fallback
      return ['shop=electronics', 'shop=mobile_phone', 'shop=computer'];
    }
  }
}

