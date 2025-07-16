// Saturn iPhone scraper using native HTML parsing (no Firecrawl or GPT)
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrawlRequest {
  storeName: string;
  website: string;
  productName: string;
}

interface ProductMatch {
  name: string;
  price: string;
  description?: string;
  availability?: string;
  url?: string;
  image?: string;
}

function extractProductsFromHTML(html: string, baseUrl: string): ProductMatch[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc) return [];

  const productEls = doc.querySelectorAll('[data-test="mms-search-product"]');
  const products: ProductMatch[] = [];

  productEls.forEach(el => {
    const name = el.querySelector('[data-test="product-title"]')?.textContent?.trim() || "";
    const price = el.querySelector('[data-test="product-price"]')?.textContent?.trim() || "";
    const urlRel = el.querySelector('a')?.getAttribute('href') || "";
    const image = el.querySelector('img')?.getAttribute('src') || "";

    if (name.toLowerCase().includes("iphone") && price) {
      products.push({
        name,
        price,
        url: urlRel.startsWith("http") ? urlRel : baseUrl + urlRel,
        image: image.startsWith("http") ? image : baseUrl + image,
      });
    }
  });

  return products;
}

// Main HTTP handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();

    if (!website || !productName) {
      return new Response(JSON.stringify({ error: 'Missing input' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchUrl = `${website.replace(/\/$/, '')}/de/search.html?query=${encodeURIComponent(productName)}`;
    const baseUrl = new URL(website).origin;
    const html = await fetch(searchUrl).then(res => res.text());

    const products = extractProductsFromHTML(html, baseUrl);

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal error', products: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});