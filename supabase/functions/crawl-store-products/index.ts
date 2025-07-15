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
}

// Enhanced product extraction function
function extractProductsFromText(text: string, html: string, productName: string, websiteUrl: string): ProductMatch[] {
  const products: ProductMatch[] = [];
  const productLower = productName.toLowerCase();
  const searchTerms = [productLower, ...productLower.split(' ')];
  
  // Price patterns (€, $, USD, EUR, etc.)
  const pricePatterns = [
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*€/g,
    /€\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g,
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*EUR/g,
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*\$$/g,
    /\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g,
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*USD/g
  ];
  
  // Split text into potential product sections
  const sections = text.split(/\n\s*\n/).filter(section => section.trim().length > 10);
  
  for (const section of sections) {
    const sectionLower = section.toLowerCase();
    
    // Check if this section contains our product
    const relevantSection = searchTerms.some(term => 
      sectionLower.includes(term) || 
      sectionLower.includes(term.replace(/\s+/g, '')) ||
      sectionLower.includes(term.replace(/\s+/g, '-'))
    );
    
    if (relevantSection) {
      // Extract price from this section
      let foundPrice = 'Contact store for pricing';
      for (const pattern of pricePatterns) {
        const match = section.match(pattern);
        if (match) {
          foundPrice = match[0];
          break;
        }
      }
      
      // Extract product name from section
      const lines = section.split('\n').filter(line => line.trim());
      let productNameCandidate = lines.find(line => {
        const lineLower = line.toLowerCase();
        return searchTerms.some(term => lineLower.includes(term));
      });
      
      if (!productNameCandidate) {
        productNameCandidate = lines[0]; // Use first line as fallback
      }
      
      // Clean up product name
      const cleanName = productNameCandidate
        ?.replace(/^\W+|\W+$/g, '')
        .replace(/\s+/g, ' ')
        .trim() || `${productName} - Available`;
      
      // Extract description (use next few lines)
      const descLines = lines.slice(1, 4).filter(line => 
        line.trim().length > 5 && 
        !line.match(/^\d+[.,]\d+/) && // Skip price lines
        !line.toLowerCase().includes('add to cart')
      );
      
      const description = descLines.length > 0 ? descLines.join(' ').substring(0, 200) : undefined;
      
      // Check for availability keywords
      let availability = undefined;
      const availabilityKeywords = ['in stock', 'available', 'out of stock', 'sold out', 'limited', 'preorder'];
      for (const keyword of availabilityKeywords) {
        if (sectionLower.includes(keyword)) {
          availability = keyword;
          break;
        }
      }
      
      products.push({
        name: cleanName,
        price: foundPrice,
        description,
        availability,
        url: websiteUrl
      });
    }
  }
  
  return products;
}

// Enhanced HTML parsing for structured data
function extractProductsFromHTML(html: string, productName: string, websiteUrl: string): ProductMatch[] {
  const products: ProductMatch[] = [];
  const productLower = productName.toLowerCase();
  
  // Common product container selectors
  const productSelectors = [
    'div[class*="product"]',
    'div[class*="item"]',
    'article[class*="product"]',
    'li[class*="product"]',
    '[data-product]',
    '.product-card',
    '.product-item',
    '.product-tile'
  ];
  
  // Try to find structured product data
  const productPattern = new RegExp(`<[^>]*class[^>]*product[^>]*>([\\s\\S]*?)</[^>]*>`, 'gi');
  const matches = html.match(productPattern);
  
  if (matches) {
    for (const match of matches) {
      const matchLower = match.toLowerCase();
      if (matchLower.includes(productLower)) {
        // Extract price
        const priceMatch = match.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*[€$]|[€$]\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/);
        const price = priceMatch ? (priceMatch[1] || priceMatch[2]) : 'Contact store for pricing';
        
        // Extract product name from title, h1, h2, etc.
        const titleMatch = match.match(/<(?:h[1-6]|title|[^>]*title[^>]*)>([^<]+)</i);
        const name = titleMatch ? titleMatch[1].trim() : `${productName} - Available`;
        
        products.push({
          name: name,
          price: price.includes('€') || price.includes('$') ? price : `${price} €`,
          description: `Product available at ${websiteUrl}`,
          url: websiteUrl
        });
      }
    }
  }
  
  return products;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();
    
    console.log(`Starting crawl for ${storeName} - Product: ${productName} - Website: ${website}`);
    
    if (!storeName || !productName) {
      return new Response(
        JSON.stringify({ error: 'Store name and product name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no website provided, return empty results
    if (!website || website === 'undefined' || website === 'null') {
      console.log('No website provided for crawling');
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      console.error('FIRECRAWL_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Firecrawl API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean and validate website URL
    let cleanWebsite = website;
    if (!cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = 'https://' + cleanWebsite;
    }

    console.log(`Scraping website: ${cleanWebsite}`);

    // Use Firecrawl to scrape the store's website
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: cleanWebsite,
        pageOptions: {
          onlyMainContent: true,
          includeHtml: true
        }
      }),
    });

    if (!scrapeResponse.ok) {
      const errorText = await scrapeResponse.text();
      console.error('Firecrawl scraping failed:', errorText);
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const scrapeData = await scrapeResponse.json();
    console.log('Firecrawl response received, data keys:', Object.keys(scrapeData.data || {}));

    let products: ProductMatch[] = [];

    // Strategy 1: Extract from markdown/text content
    if (scrapeData.data?.markdown) {
      console.log('Trying text extraction...');
      const textProducts = extractProductsFromText(
        scrapeData.data.markdown, 
        scrapeData.data.html || '', 
        productName, 
        cleanWebsite
      );
      products.push(...textProducts);
    }

    // Strategy 2: Extract from HTML structure
    if (products.length === 0 && scrapeData.data?.html) {
      console.log('Trying HTML extraction...');
      const htmlProducts = extractProductsFromHTML(
        scrapeData.data.html, 
        productName, 
        cleanWebsite
      );
      products.push(...htmlProducts);
    }

    // Strategy 3: Basic keyword matching fallback
    if (products.length === 0 && scrapeData.data?.markdown) {
      console.log('Using basic keyword matching fallback...');
      
      const markdown = scrapeData.data.markdown.toLowerCase();
      const productLower = productName.toLowerCase();
      
      // Check for product mentions and commerce indicators
      const hasProductMention = markdown.includes(productLower) || 
                              markdown.includes(productLower.split(' ')[0]) ||
                              productLower.split(' ').some(term => markdown.includes(term));
      
      const hasCommerceIndicators = markdown.includes('price') || 
                                  markdown.includes('€') || 
                                  markdown.includes('$') ||
                                  markdown.includes('buy') ||
                                  markdown.includes('shop') ||
                                  markdown.includes('order');
      
      if (hasProductMention || hasCommerceIndicators) {
        products.push({
          name: `${productName} - Available at ${storeName}`,
          price: 'Contact store for pricing',
          description: 'Product may be available - contact store for details and current pricing',
          availability: 'Contact store for availability',
          url: cleanWebsite
        });
      }
    }

    // Remove duplicates
    const uniqueProducts = products.filter((product, index, self) => 
      index === self.findIndex(p => p.name === product.name)
    );

    console.log(`Found ${uniqueProducts.length} unique product matches`);

    return new Response(
      JSON.stringify({ products: uniqueProducts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in crawl-store-products function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});