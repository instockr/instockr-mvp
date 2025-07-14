import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { productName, userLat, userLng, radius = 50 } = await req.json();

    if (!productName || !userLat || !userLng) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: productName, userLat, userLng' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Search for products matching the name
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${productName}%`);

    if (productError) {
      console.error('Product search error:', productError);
      return new Response(
        JSON.stringify({ error: 'Failed to search products' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ stores: [], message: 'No products found matching your search' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const productIds = products.map(p => p.id);

    // Get all stores with their inventory for the found products
    const { data: storeData, error: storeError } = await supabase
      .from('inventory')
      .select(`
        *,
        stores!inner(*),
        products!inner(*)
      `)
      .in('product_id', productIds)
      .eq('in_stock', true);

    if (storeError) {
      console.error('Store search error:', storeError);
      return new Response(
        JSON.stringify({ error: 'Failed to search stores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distances and filter by radius
    const storesWithDistance = storeData?.map(item => {
      const store = item.stores;
      const product = item.products;
      
      // Calculate distance using Haversine formula (approximate)
      const lat1 = userLat * Math.PI / 180;
      const lat2 = store.latitude * Math.PI / 180;
      const deltaLat = (store.latitude - userLat) * Math.PI / 180;
      const deltaLng = (store.longitude - userLng) * Math.PI / 180;

      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = 6371 * c; // Earth's radius in km

      return {
        store: {
          id: store.id,
          name: store.name,
          address: store.address,
          phone: store.phone,
          store_type: store.store_type,
          latitude: store.latitude,
          longitude: store.longitude
        },
        product: {
          id: product.id,
          name: product.name,
          brand: product.brand,
          category: product.category
        },
        price: item.price,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        last_updated: item.last_updated
      };
    }).filter(item => item.distance <= radius) // Filter by radius
     .sort((a, b) => a.distance - b.distance); // Sort by distance

    return new Response(
      JSON.stringify({ 
        stores: storesWithDistance || [],
        searchedProduct: productName,
        totalResults: storesWithDistance?.length || 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in search-stores function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});