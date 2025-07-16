import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('🚀🚀🚀 === CRAWL FUNCTION STARTED === 🚀🚀🚀');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('📝 OPTIONS request - returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Processing POST request');

  try {
    const requestBody = await req.json();
    console.log('📋 Request body:', JSON.stringify(requestBody, null, 2));
    
    // Return some test products for now
    const testProducts = [
      {
        name: "Test iPhone 15",
        price: "999€",
        description: "This is a test product to verify the function works",
        availability: "in stock",
        url: "https://example.com",
        image: "https://example.com/image.jpg"
      }
    ];
    
    console.log('✅ Returning test products:', testProducts);

    return new Response(
      JSON.stringify({ products: testProducts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});