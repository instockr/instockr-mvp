// OpenStreetMap shop categories
// Source: https://wiki.openstreetmap.org/wiki/Key:shop
export const OSM_SHOP_CATEGORIES = [
  // Electronics & Technology
  'shop=mobile_phone',
  'shop=electronics', 
  'shop=computer',
  'shop=camera',
  'shop=hifi',
  'shop=video_games',
  'shop=telecommunication',
  
  // Hardware & DIY
  'shop=hardware',
  'shop=doityourself',
  'shop=paint',
  'shop=trade',
  
  // Health & Medicine
  'amenity=pharmacy',
  'shop=chemist',
  'shop=medical_supply',
  'shop=optician',
  
  // Books & Stationery
  'shop=books',
  'shop=stationery',
  'shop=newsagent',
  
  // Clothing & Fashion
  'shop=clothes',
  'shop=fashion',
  'shop=shoes',
  'shop=bag',
  'shop=watches',
  'shop=jewelry',
  
  // Food & Groceries
  'shop=supermarket',
  'shop=convenience',
  'shop=bakery',
  'shop=butcher',
  'shop=greengrocer',
  'shop=alcohol',
  'shop=wine',
  'shop=coffee',
  'amenity=cafe',
  
  // Sports & Outdoor
  'shop=sports',
  'shop=bicycle',
  'shop=outdoor',
  'shop=fishing',
  
  // Automotive
  'shop=car',
  'shop=car_parts',
  'shop=car_repair',
  'shop=tyres',
  
  // Beauty & Personal Care
  'shop=cosmetics',
  'shop=perfumery',
  'shop=hairdresser',
  'shop=beauty',
  
  // Home & Garden
  'shop=furniture',
  'shop=interior_decoration',
  'shop=garden_centre',
  'shop=florist',
  'shop=carpet',
  'shop=curtain',
  
  // Musical Instruments
  'shop=musical_instrument',
  'shop=music',
  
  // Toys & Games
  'shop=toys',
  'shop=games',
  
  // General stores
  'shop=department_store',
  'shop=general',
  'shop=variety_store',
  'amenity=marketplace'
] as const;

// Category descriptions for better matching
export const CATEGORY_DESCRIPTIONS = {
  'shop=mobile_phone': 'mobile phones, smartphones, cell phones, iPhone, Android devices, phone accessories',
  'shop=electronics': 'electronic devices, gadgets, consumer electronics, tech products',
  'shop=computer': 'computers, laptops, desktops, PCs, computer accessories, monitors, keyboards',
  'shop=camera': 'cameras, photography equipment, lenses, tripods, photo accessories',
  'shop=hifi': 'audio equipment, speakers, headphones, amplifiers, stereo systems',
  'shop=video_games': 'video games, gaming consoles, PlayStation, Xbox, Nintendo, PC games',
  'shop=hardware': 'tools, screws, nails, bolts, building supplies, DIY materials',
  'shop=doityourself': 'DIY supplies, home improvement, building materials, power tools',
  'shop=paint': 'paint, brushes, painting supplies, wall coverings, varnish',
  'amenity=pharmacy': 'medicine, drugs, prescriptions, medical supplies, health products',
  'shop=chemist': 'over-the-counter medicine, health products, vitamins, first aid',
  'shop=books': 'books, literature, textbooks, magazines, reading materials',
  'shop=stationery': 'pens, pencils, paper, notebooks, office supplies, school supplies',
  'shop=clothes': 'clothing, apparel, fashion, shirts, pants, dresses, garments',
  'shop=shoes': 'footwear, shoes, boots, sneakers, sandals, slippers',
  'shop=supermarket': 'groceries, food, daily necessities, household items',
  'shop=convenience': 'convenience store, snacks, drinks, quick shopping',
  'shop=sports': 'sporting goods, fitness equipment, athletic wear, sports accessories',
  'shop=car': 'automobiles, vehicles, cars, automotive sales',
  'shop=cosmetics': 'makeup, beauty products, skincare, cosmetic items',
  'shop=furniture': 'furniture, home furnishing, chairs, tables, sofas, beds',
  'shop=toys': 'toys, children\'s games, educational toys, playthings',
  'shop=department_store': 'large retail store, multiple departments, general merchandise'
} as const;

export type OSMCategory = typeof OSM_SHOP_CATEGORIES[number];