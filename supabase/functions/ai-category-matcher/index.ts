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
    const { productName } = await req.json();
    console.log('AI Category Matcher - Product:', productName);

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
      return new Response(JSON.stringify({ 
        categories: cachedProduct.categories,
        productName,
        cached: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('No cached categories found, running AI categorization...');

    // Use Hugging Face for semantic similarity
    const hf = new HfInference(Deno.env.get('HUGGING_FACE_ACCESS_TOKEN'));
    
    // Create embeddings for the product name
    const productEmbedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: normalizedProductName
    });

    // Calculate similarity with each category
    const similarities = [];
    
    for (const category of OSM_SHOP_CATEGORIES) {
      const description = CATEGORY_DESCRIPTIONS[category as keyof typeof CATEGORY_DESCRIPTIONS] || category;
      
      try {
        const categoryEmbedding = await hf.featureExtraction({
          model: 'sentence-transformers/all-MiniLM-L6-v2',
          inputs: description
        });

        // Calculate cosine similarity
        const similarity = cosineSimilarity(productEmbedding, categoryEmbedding);
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

    return new Response(JSON.stringify({ 
      categories: topCategories,
      productName,
      similarities: similarities.slice(0, 5).map(s => ({ 
        category: s.category, 
        similarity: s.similarity.toFixed(3) 
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in AI category matcher:', error);
    
    // If AI fails, return empty array (no fallback as per user request)
    return new Response(JSON.stringify({ 
      categories: [],
      productName: '',
      error: 'AI categorization failed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
