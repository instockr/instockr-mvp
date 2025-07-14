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

    // Enhanced deduplication logic
    const deduplicatedStores: Store[] = [];
    const seenStores = new Map<string, Store>();

    for (const store of stores) {
      if (!store.name || !store.url) continue;

      // Create multiple matching keys for robust deduplication
      const keys = [
        // Exact URL match
        store.url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
        // Domain + name match
        `${extractDomain(store.url)}-${normalizeStoreName(store.name)}`,
        // Name similarity match
        normalizeStoreName(store.name)
      ];

      let isDuplicate = false;
      let existingStore: Store | null = null;

      // Check if any key matches existing stores
      for (const key of keys) {
        if (seenStores.has(key)) {
          isDuplicate = true;
          existingStore = seenStores.get(key)!;
          break;
        }
      }

      if (isDuplicate && existingStore) {
        // Merge duplicates - combine information
        const merged = mergeDuplicateStores(existingStore, store);
        
        // Update all keys to point to merged store
        keys.forEach(key => seenStores.set(key, merged));
        
        // Update in results array
        const index = deduplicatedStores.findIndex(s => s.id === existingStore.id);
        if (index !== -1) {
          deduplicatedStores[index] = merged;
        }
      } else {
        // New store - add to results
        deduplicatedStores.push(store);
        
        // Register all keys
        keys.forEach(key => seenStores.set(key, store));
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