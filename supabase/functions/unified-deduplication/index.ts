import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Store {
  id: string;
  name: string;
  url?: string;
  product?: {
    name: string;
    price: string;
  };
  source?: string;
  [key: string]: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stores } = await req.json();

    if (!Array.isArray(stores) || stores.length === 0) {
      return new Response(
        JSON.stringify({ stores: [], totalResults: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deduplicating ${stores.length} stores from all sources`);

    // Simplified conservative deduplication logic
    const deduplicatedStores: Store[] = [];

    for (const store of stores) {
      if (!store.name || !store.url) {
        deduplicatedStores.push(store);
        continue;
      }

      const currentUrl = store.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
      const currentDomain = extractDomain(store.url);
      const currentName = normalizeStoreName(store.name);
      
      let isDuplicate = false;
      let duplicateIndex = -1;

      // Check against already processed stores
      for (let i = 0; i < deduplicatedStores.length; i++) {
        const existing = deduplicatedStores[i];
        if (!existing.url || !existing.name) continue;
        
        const existingUrl = existing.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
        const existingDomain = extractDomain(existing.url);
        const existingName = normalizeStoreName(existing.name);
        
        // Only mark as duplicate if:
        // 1. Exact URL match, OR
        // 2. Same domain AND exact name match after normalization
        if (currentUrl === existingUrl || 
            (currentDomain === existingDomain && currentName === existingName && 
             currentDomain !== '' && currentName !== '' && currentDomain.length > 3)) {
          isDuplicate = true;
          duplicateIndex = i;
          break;
        }
      }

      if (isDuplicate && duplicateIndex >= 0) {
        // Merge with existing store
        const existing = deduplicatedStores[duplicateIndex];
        const merged = mergeDuplicateStores(existing, store);
        deduplicatedStores[duplicateIndex] = merged;
      } else {
        // Add as new store
        deduplicatedStores.push(store);
      }
    }

    console.log(`Deduplicated from ${stores.length} to ${deduplicatedStores.length} stores`);

    return new Response(
      JSON.stringify({
        stores: deduplicatedStores,
        totalResults: deduplicatedStores.length,
        originalCount: stores.length,
        duplicatesRemoved: stores.length - deduplicatedStores.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in unified-deduplication function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function mergeDuplicateStores(existing: Store, newStore: Store): Store {
  const merged = { ...existing };
  
  // Track sources
  if (!merged.originalSources) {
    merged.originalSources = [{
      name: existing.name,
      url: existing.url
    }];
  }
  
  merged.originalSources.push({
    name: newStore.name,
    url: newStore.url
  });
  
  // Count occurrences
  merged.sourceCount = (merged.sourceCount || 1) + 1;
  merged.isConsolidated = true;
  
  // Use better price if available
  if (newStore.product?.price && newStore.product.price !== 'Contact store for pricing') {
    if (!merged.product?.price || merged.product.price === 'Contact store for pricing') {
      merged.product = { ...merged.product, ...newStore.product };
    }
  }
  
  // Prefer more detailed descriptions
  if (newStore.product?.description && newStore.product.description.length > (merged.product?.description?.length || 0)) {
    merged.product = { ...merged.product, description: newStore.product.description };
  }
  
  // Update ID to reflect consolidation
  merged.id = `consolidated-${Date.now()}-${merged.sourceCount}`;
  
  return merged;
}