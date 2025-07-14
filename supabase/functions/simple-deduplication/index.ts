import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Store {
  id: string;
  name: string;
  store_type: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string | null;
  product: {
    name: string;
    price?: string;
    description?: string;
    availability?: string;
    category?: string;
  };
  url?: string | null;
  isOnline: boolean;
  source: string;
  distance?: number;
  rating?: number;
  userRatingsTotal?: number;
  verification?: any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;]/g, '')
    .replace(/\b(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd)\b/g, '')
    .trim();
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { stores } = await req.json();
    
    if (!stores || !Array.isArray(stores)) {
      console.error('Invalid input: stores must be an array');
      return new Response(
        JSON.stringify({ error: 'Invalid input: stores must be an array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Simple deduplication: processing ${stores.length} stores`);

    // Simple address-based deduplication
    const seenAddresses = new Set<string>();
    const deduplicatedStores: Store[] = [];

    for (const store of stores) {
      if (!store.address) {
        // If no address, keep the store
        deduplicatedStores.push(store);
        continue;
      }

      const normalizedAddress = normalizeAddress(store.address);
      
      if (seenAddresses.has(normalizedAddress)) {
        // Skip this store as we already have one with the same address
        console.log(`Skipping duplicate address: ${store.address}`);
        continue;
      }

      // Add the normalized address to our set and keep the store
      seenAddresses.add(normalizedAddress);
      deduplicatedStores.push(store);
    }

    console.log(`Simple deduplication: reduced from ${stores.length} to ${deduplicatedStores.length} stores`);

    return new Response(
      JSON.stringify({ 
        deduplicatedStores,
        summary: {
          originalCount: stores.length,
          deduplicatedCount: deduplicatedStores.length,
          removedCount: stores.length - deduplicatedStores.length
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in simple deduplication:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error during simple deduplication' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
