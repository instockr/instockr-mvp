import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';
import { OSM_SHOP_CATEGORIES, CATEGORY_DESCRIPTIONS } from '../osm-shop-categories.ts';

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

    // Use Hugging Face for semantic similarity
    const hf = new HfInference(Deno.env.get('HUGGING_FACE_ACCESS_TOKEN'));
    
    // Create embeddings for the product name
    const productEmbedding = await hf.featureExtraction({
      model: 'sentence-transformers/all-MiniLM-L6-v2',
      inputs: productName.toLowerCase()
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
    
    // Fallback to simple keyword matching
    const fallbackCategories = getFallbackCategories(await req.json().then(data => data.productName));
    
    return new Response(JSON.stringify({ 
      categories: fallbackCategories,
      fallback: true 
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