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

interface BrowsingAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'extract';
  selector?: string;
  text?: string;
  url?: string;
  description: string;
}

// AI-powered browsing planner
async function planBrowsingActions(website: string, productName: string): Promise<BrowsingAction[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  try {
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
            content: `You are an AI that plans web browsing actions to search for products on e-commerce websites. 
            Plan a sequence of actions to find "${productName}" on ${website}.
            
            Available actions:
            - navigate: Go to a URL
            - click: Click an element (provide CSS selector)
            - type: Type text into an input field (provide selector and text)
            - scroll: Scroll the page
            - wait: Wait for content to load
            - extract: Extract product information from current page
            
            Return a JSON array of actions. Be smart about common e-commerce patterns:
            - Look for search boxes (input[type="search"], input[name="q"], .search-input)
            - Try navigation menus and category links
            - Handle cookie/popup dialogs
            - Consider mobile vs desktop layouts
            
            Example response:
            [
              {"type": "navigate", "url": "${website}", "description": "Go to homepage"},
              {"type": "click", "selector": ".cookie-accept", "description": "Accept cookies if popup appears"},
              {"type": "click", "selector": "input[name='search']", "description": "Click search box"},
              {"type": "type", "selector": "input[name='search']", "text": "${productName}", "description": "Type product name"},
              {"type": "click", "selector": "button[type='submit']", "description": "Submit search"},
              {"type": "wait", "description": "Wait for search results"},
              {"type": "extract", "description": "Extract product information"}
            ]`
          },
          {
            role: 'user',
            content: `Plan actions to search for "${productName}" on ${website}`
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
      const actions = JSON.parse(content);
      return Array.isArray(actions) ? actions : [];
    } catch (parseError) {
      console.error('Failed to parse AI browsing plan:', content);
      return [];
    }

  } catch (error) {
    console.error('AI planning failed:', error);
    return [];
  }
}

// Execute browsing actions using browser automation simulation
async function executeBrowsingPlan(actions: BrowsingAction[], productName: string): Promise<ProductMatch[]> {
  console.log(`Executing ${actions.length} browsing actions...`);
  
  let currentPageContent = '';
  let products: ProductMatch[] = [];
  
  for (const action of actions) {
    console.log(`Executing: ${action.description}`);
    
    try {
      switch (action.type) {
        case 'navigate':
          if (action.url) {
            currentPageContent = await scrapePageWithFirecrawl(action.url);
          }
          break;
          
        case 'click':
        case 'type':
          // For click/type actions, we need to simulate the result
          // In a real implementation, this would use Playwright
          console.log(`Simulating ${action.type} action: ${action.description}`);
          
          // If this is a search action, try to construct search URL
          if (action.description.toLowerCase().includes('search') && action.text === productName) {
            const searchUrls = await generateIntelligentSearchUrls(currentPageContent, productName);
            if (searchUrls.length > 0) {
              currentPageContent = await scrapePageWithFirecrawl(searchUrls[0]);
            }
          }
          break;
          
        case 'wait':
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
          
        case 'extract':
          if (currentPageContent) {
            products = await extractProductsWithAI(currentPageContent, productName);
            console.log(`Extracted ${products.length} products from current page`);
          }
          break;
          
        case 'scroll':
          // Simulate scrolling by getting more content
          console.log('Simulating scroll action');
          break;
      }
    } catch (error) {
      console.error(`Error executing action "${action.description}":`, error);
      continue;
    }
    
    // Small delay between actions
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return products;
}

// Scrape page content using Firecrawl
async function scrapePageWithFirecrawl(url: string): Promise<string> {
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key not configured');
  }

  try {
    const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        pageOptions: {
          onlyMainContent: true,
          includeHtml: false
        }
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.data?.markdown || '';
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
  }
  
  return '';
}

// Generate intelligent search URLs based on page content analysis
async function generateIntelligentSearchUrls(pageContent: string, productName: string): Promise<string[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    return [];
  }

  try {
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
            content: `Analyze this webpage content and generate likely search URLs for "${productName}". 
            Look for patterns in the page structure, navigation, and URL patterns.
            Return a JSON array of probable search URLs.`
          },
          {
            role: 'user',
            content: pageContent.substring(0, 2000)
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        const urls = JSON.parse(content);
        return Array.isArray(urls) ? urls : [];
      } catch {
        return [];
      }
    }
  } catch (error) {
    console.error('Error generating intelligent search URLs:', error);
  }
  
  return [];
}

// Extract products using AI
async function extractProductsWithAI(content: string, productName: string): Promise<ProductMatch[]> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    return [];
  }

  try {
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
            content: `Extract products related to "${productName}" from this webpage content. 
            Return a JSON array of products found. Each product should have: name, price, description (optional), availability (optional). 
            Only include actual products with real pricing information. Be strict about what qualifies as a product.`
          },
          {
            role: 'user',
            content: content.substring(0, 4000)
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const contentResult = data.choices[0].message.content;
    
    try {
      const products = JSON.parse(contentResult);
      return Array.isArray(products) ? products : [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', contentResult);
      return [];
    }

  } catch (error) {
    console.error('AI extraction failed:', error);
    return [];
  }
}

// Main AI-powered browsing function
async function aiPoweredProductSearch(website: string, productName: string, storeName: string): Promise<ProductMatch[]> {
  console.log(`Starting AI-powered browsing for "${productName}" on ${storeName}`);
  
  try {
    // Step 1: Plan browsing actions using AI
    const actions = await planBrowsingActions(website, productName);
    console.log(`AI planned ${actions.length} browsing actions`);
    
    if (actions.length === 0) {
      console.log('No actions planned, falling back to direct search');
      return [];
    }
    
    // Step 2: Execute the browsing plan
    const products = await executeBrowsingPlan(actions, productName);
    
    console.log(`AI browsing completed: Found ${products.length} products`);
    return products;
    
  } catch (error) {
    console.error('AI browsing failed:', error);
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storeName, website, productName }: CrawlRequest = await req.json();
    
    console.log(`Starting smart crawl for ${storeName} - Product: ${productName} - Website: ${website}`);
    
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

    // Clean and validate website URL
    let cleanWebsite = website;
    if (!cleanWebsite.startsWith('http://') && !cleanWebsite.startsWith('https://')) {
      cleanWebsite = 'https://' + cleanWebsite;
    }

    console.log(`Starting AI-powered product search on: ${cleanWebsite}`);

    // Use the new AI-powered browsing approach
    const products = await aiPoweredProductSearch(cleanWebsite, productName, storeName);

    console.log(`AI-powered crawl completed: Found ${products.length} products`);

    return new Response(
      JSON.stringify({ products }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in smart crawl-store-products function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', products: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});