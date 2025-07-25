import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';
import { OSM_SHOP_CATEGORIES, CATEGORY_DESCRIPTIONS } from '../osm-shop-categories.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Normalize product name for consistent matching
    const normalizedProductName = productName.toLowerCase().trim();

    // Check if we have cached categories for this product
    const { data: cachedProduct, error: cacheError } = await supabase
      .from('product_categories')
      .select('categories')
      .eq('product_name_normalized', normalizedProductName)
      .single();

    if (cachedProduct && !cacheError) {
      console.log(`Found cached categories for "${productName}":`, cachedProduct.categories);
      return cachedProduct.categories;
    }

    console.log('No cached categories found, running AI categorization...');

    // Use Hugging Face for semantic similarity
    const hf = new HfInference(Deno.env.get('HUGGING_FACE_ACCESS_TOKEN'));
    
    console.log('Generating embeddings for:', normalizedProductName);
    
    // Create embeddings for the product name
    const productEmbedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: [normalizedProductName]
    });
    
    console.log('Product embedding shape:', Array.isArray(productEmbedding) ? productEmbedding.length : 'not array');

    // Calculate similarity with each category
    const similarities = [];
    
    for (const category of OSM_SHOP_CATEGORIES) {
      const description = CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS] || category;
      
      try {
        const categoryEmbedding = await hf.featureExtraction({
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          inputs: [description]
        });

        // Ensure embeddings are in the right format (flatten if needed)
        const productVec = Array.isArray(productEmbedding[0]) ? productEmbedding[0] : productEmbedding;
        const categoryVec = Array.isArray(categoryEmbedding[0]) ? categoryEmbedding[0] : categoryEmbedding;

        // Calculate cosine similarity
        const similarity = cosineSimilarity(productVec, categoryVec);
        similarities.push({ category, similarity, description });
      } catch (error) {
        console.log(`Error processing category ${category}:`, error);
        continue;
      }
    }

    // Sort by similarity and take top 3
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topCategories = similarities.slice(0, 3).map(item => item.category);

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
    // If AI fails, return empty array (no fallback as per user request)
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
