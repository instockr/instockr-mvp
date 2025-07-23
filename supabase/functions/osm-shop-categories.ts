// Complete OpenStreetMap shop categories
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
  'shop=radiotechnics',
  
  // Hardware & DIY
  'shop=hardware',
  'shop=doityourself',
  'shop=paint',
  'shop=trade',
  'shop=tools',
  'shop=building_supplies',
  'shop=glaziery',
  'shop=locksmith',
  
  // Health & Medicine
  'amenity=pharmacy',
  'shop=chemist',
  'shop=medical_supply',
  'shop=optician',
  'shop=hearing_aids',
  'shop=massage',
  'shop=herbalist',
  
  // Books & Stationery
  'shop=books',
  'shop=stationery',
  'shop=newsagent',
  'shop=copyshop',
  'shop=lottery',
  
  // Clothing & Fashion
  'shop=clothes',
  'shop=fashion',
  'shop=shoes',
  'shop=bag',
  'shop=watches',
  'shop=jewelry',
  'shop=leather',
  'shop=tailor',
  'shop=dry_cleaning',
  'shop=laundry',
  'shop=fabric',
  'shop=sewing',
  'shop=second_hand',
  'shop=vintage',
  'shop=boutique',
  'shop=underwear',
  'shop=swimwear',
  
  // Food & Groceries
  'shop=supermarket',
  'shop=convenience',
  'shop=bakery',
  'shop=butcher',
  'shop=greengrocer',
  'shop=alcohol',
  'shop=wine',
  'shop=coffee',
  'shop=tea',
  'shop=confectionery',
  'shop=chocolate',
  'shop=ice_cream',
  'shop=spices',
  'shop=health_food',
  'shop=organic',
  'shop=frozen_food',
  'shop=pasta',
  'shop=cheese',
  'shop=dairy',
  'shop=seafood',
  'shop=deli',
  'shop=farm',
  'amenity=cafe',
  'amenity=restaurant',
  'amenity=fast_food',
  
  // Sports & Outdoor
  'shop=sports',
  'shop=bicycle',
  'shop=outdoor',
  'shop=fishing',
  'shop=golf',
  'shop=hunting',
  'shop=scuba_diving',
  'shop=ski',
  'shop=swimming_pool',
  'shop=martial_arts',
  'shop=fitness',
  
  // Automotive
  'shop=car',
  'shop=car_parts',
  'shop=car_repair',
  'shop=tyres',
  'shop=motorcycle',
  'shop=fuel',
  
  // Beauty & Personal Care
  'shop=cosmetics',
  'shop=perfumery',
  'shop=hairdresser',
  'shop=beauty',
  'shop=tanning',
  'shop=tattoo',
  'shop=piercing',
  'shop=nails',
  
  // Home & Garden
  'shop=furniture',
  'shop=interior_decoration',
  'shop=garden_centre',
  'shop=florist',
  'shop=carpet',
  'shop=curtain',
  'shop=kitchen',
  'shop=bathroom_furnishing',
  'shop=bed',
  'shop=antiques',
  'shop=houseware',
  'shop=pottery',
  'shop=tile',
  'shop=lighting',
  
  // Musical Instruments
  'shop=musical_instrument',
  'shop=music',
  
  // Toys & Games
  'shop=toys',
  'shop=games',
  'shop=model',
  'shop=hobby',
  
  // Pets
  'shop=pet',
  'shop=pet_grooming',
  'shop=aquarium',
  
  // Art & Crafts
  'shop=art',
  'shop=frame',
  'shop=craft',
  'shop=wool',
  'shop=trophy',
  
  // Photography
  'shop=photo',
  'shop=photo_studio',
  
  // Tobacco & Vaping
  'shop=tobacco',
  'shop=e-cigarette',
  
  // Adult
  'shop=erotic',
  
  // Services
  'shop=dry_cleaning',
  'shop=laundry',
  'shop=funeral_directors',
  'shop=pawnbroker',
  'shop=money_lender',
  'shop=storage_rental',
  'shop=travel_agency',
  'shop=ticket',
  
  // Specialty Food
  'shop=bagel',
  'shop=beverages',
  'shop=brewing_supplies',
  'shop=candy',
  'shop=honey',
  'shop=nuts',
  'shop=nutrition_supplements',
  'shop=water',
  
  // General stores
  'shop=department_store',
  'shop=general',
  'shop=variety_store',
  'shop=mall',
  'shop=wholesale',
  'amenity=marketplace',
  
  // Professional Services
  'office=accountant',
  'office=lawyer',
  'office=estate_agent',
  'office=insurance',
  'office=financial',
  
  // Others
  'shop=vacant',
  'shop=yes'
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