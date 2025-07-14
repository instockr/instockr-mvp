import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stores } = await req.json();

    if (!stores || !Array.isArray(stores) || stores.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Stores array is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Processing ${stores.length} stores for deduplication`);

    // Create a detailed prompt for GPT to analyze and deduplicate stores
    const storesData = stores.map((store, index) => ({
      index,
      name: store.name,
      address: store.address,
      url: store.url || 'No URL',
      store_type: store.store_type
    }));

    const prompt = `You are a store deduplication expert. Analyze the following list of stores and identify which ones refer to the same physical location or business. Group stores that are clearly the same entity together.

Stores to analyze:
${storesData.map(store => `${store.index}: "${store.name}" at "${store.address}" (${store.store_type}) - ${store.url}`).join('\n')}

Rules for grouping:
1. Same business name + same city = same store (even if address details differ slightly)
2. Official store websites vs review/article sites about the same store = same store
3. Different products at same location = same store
4. Slight name variations (Apple Store vs Apple Piazza Liberty) at same location = same store

Return a JSON response with this exact structure:
{
  "groups": [
    {
      "consolidated_name": "Best representative name for this store",
      "consolidated_address": "Best address representation",
      "store_type": "store type",
      "store_indices": [array of original store indices that belong to this group],
      "primary_url": "most authoritative URL (prefer official store websites)",
      "source_count": number_of_sources
    }
  ]
}

Focus on accuracy - only group stores you're confident are the same location.`;

    console.log('Sending deduplication request to OpenAI');

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
            content: 'You are a precise store deduplication system. Always return valid JSON with the exact structure requested.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    
    console.log('OpenAI response:', aiResponse);

    let deduplicationResult;
    try {
      deduplicationResult = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Fallback: return original stores without deduplication
      return new Response(
        JSON.stringify({ 
          deduplicatedStores: stores,
          originalCount: stores.length,
          deduplicatedCount: stores.length,
          groups: []
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Process the groups and create deduplicated store list
    const deduplicatedStores = [];
    const usedIndices = new Set();

    // Add grouped stores
    for (const group of deduplicationResult.groups) {
      if (!group.store_indices || group.store_indices.length === 0) continue;
      
      // Get the first store as base and enhance it with consolidated info
      const primaryStoreIndex = group.store_indices[0];
      const primaryStore = stores[primaryStoreIndex];
      
      if (!primaryStore) continue;

      // Mark all indices in this group as used
      group.store_indices.forEach(index => usedIndices.add(index));

      // Create consolidated store entry
      const consolidatedStore = {
        ...primaryStore,
        id: `consolidated-${Date.now()}-${deduplicatedStores.length}`,
        name: group.consolidated_name,
        address: group.consolidated_address,
        url: group.primary_url !== 'No URL' ? group.primary_url : primaryStore.url,
        sourceCount: group.source_count,
        isConsolidated: true,
        originalSources: group.store_indices.map(index => ({
          name: stores[index]?.name,
          url: stores[index]?.url
        }))
      };

      deduplicatedStores.push(consolidatedStore);
    }

    // Add ungrouped stores (stores not part of any group)
    stores.forEach((store, index) => {
      if (!usedIndices.has(index)) {
        deduplicatedStores.push({
          ...store,
          sourceCount: 1,
          isConsolidated: false
        });
      }
    });

    console.log(`Deduplication complete: ${stores.length} -> ${deduplicatedStores.length} stores`);

    return new Response(
      JSON.stringify({
        deduplicatedStores,
        originalCount: stores.length,
        deduplicatedCount: deduplicatedStores.length,
        groups: deduplicationResult.groups
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in deduplicate-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});