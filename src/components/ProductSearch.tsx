import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Globe, Store, ExternalLink, ChevronDown, Phone, Clock, CheckCircle, XCircle, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import instockrLogo from "@/assets/instockr-logo.png";

interface Store {
  store: {
    id: string;
    name: string;
    address: string;
    phone: string;
    store_type: string;
    latitude: number;
    longitude: number;
  };
  product: {
    id: string;
    name: string;
    brand: string;
    category: string;
  };
  price: number;
  distance: number;
  last_updated: string;
}

interface OnlineStore {
  id: string;
  name: string;
  store_type: string;
  address: string;
  distance: null;
  latitude: null;
  longitude: null;
  phone: null;
  product: {
    name: string;
    price: string;
    description?: string;
    availability?: string;
  };
  url?: string;
  isOnline: boolean;
}

interface SearchResult {
  stores: Store[];
  searchedProduct: string;
  totalResults: number;
}

export function ProductSearch() {
  const [productName, setProductName] = useState("");
  const [location, setLocation] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  const { toast } = useToast();

  // Popular cities for quick suggestions
  const popularCities = [
    "New York, NY", "Los Angeles, CA", "Chicago, IL", "Houston, TX", "Phoenix, AZ",
    "Philadelphia, PA", "San Antonio, TX", "San Diego, CA", "Dallas, TX", "San Jose, CA",
    "Austin, TX", "Jacksonville, FL", "Fort Worth, TX", "Columbus, OH", "Charlotte, NC",
    "San Francisco, CA", "Indianapolis, IN", "Seattle, WA", "Denver, CO", "Washington, DC",
    "Boston, MA", "El Paso, TX", "Nashville, TN", "Detroit, MI", "Oklahoma City, OK",
    "Portland, OR", "Las Vegas, NV", "Memphis, TN", "Louisville, KY", "Baltimore, MD",
    "Milan, Italy", "Paris, France", "London, UK", "Berlin, Germany", "Madrid, Spain",
    "Rome, Italy", "Amsterdam, Netherlands", "Barcelona, Spain", "Vienna, Austria"
  ];

  useEffect(() => {
    if (location.length > 2) {
      const filtered = popularCities.filter(city => 
        city.toLowerCase().includes(location.toLowerCase())
      ).slice(0, 8);
      setLocationSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }
  }, [location]);

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setShowSuggestions(false);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter your location manually",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get city name using Nominatim
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          const cityName = data.address && (data.address.city || data.address.town || data.address.village) && data.address.country ? 
            `${data.address.city || data.address.town || data.address.village}, ${data.address.country}` : 
            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          setLocation(cityName);
          setIsGettingLocation(false);
          toast({
            title: "Location found",
            description: `Using ${cityName} for search`,
          });
        } catch (error) {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setIsGettingLocation(false);
          toast({
            title: "Location found",
            description: "Using your current coordinates for search",
          });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsGettingLocation(false);
        toast({
          title: "Location access denied",
          description: "Please enter your location manually",
          variant: "destructive",
        });
      }
    );
  };

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const geocodeLocation = async (locationStr: string) => {
    // Check if it's already coordinates (lat, lng format)
    const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    
    // First try to use a simple city-to-coordinates mapping for popular cities
    const cityCoordinates: Record<string, { lat: number; lng: number }> = {
      "milan, italy": { lat: 45.4642, lng: 9.1900 },
      "paris, france": { lat: 48.8566, lng: 2.3522 },
      "london, uk": { lat: 51.5074, lng: -0.1278 },
      "new york, ny": { lat: 40.7128, lng: -74.0060 },
      "los angeles, ca": { lat: 34.0522, lng: -118.2437 },
      "chicago, il": { lat: 41.8781, lng: -87.6298 },
      "berlin, germany": { lat: 52.5200, lng: 13.4050 },
      "madrid, spain": { lat: 40.4168, lng: -3.7038 },
      "rome, italy": { lat: 41.9028, lng: 12.4964 },
      "amsterdam, netherlands": { lat: 52.3676, lng: 4.9041 },
      "barcelona, spain": { lat: 41.3851, lng: 2.1734 },
      "vienna, austria": { lat: 48.2082, lng: 16.3738 },
      "frankfurt am main, germany": { lat: 50.1109, lng: 8.6821 }
    };
    
    const normalizedLocation = locationStr.toLowerCase();
    if (cityCoordinates[normalizedLocation]) {
      return cityCoordinates[normalizedLocation];
    }
    
    // Try free geocoding service as fallback
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr)}&limit=1`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    
    throw new Error(`Location "${locationStr}" not found. Please try a major city name.`);
  };

  const handleSearch = async () => {
    if (!productName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a product name",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      // Step 1: Generate LLM-powered search strategies
      console.log('Generating search strategies...');
      const strategiesResponse = await supabase.functions.invoke('generate-search-strategies', {
        body: { productName: productName.trim() }
      });

      // Get location coordinates for search
      let locationCoords = null;
      if (location.trim()) {
        try {
          locationCoords = await geocodeLocation(location);
          console.log('Location coordinates:', locationCoords);
        } catch (geocodeError) {
          console.error('Geocoding failed:', geocodeError);
          toast({
            title: "Location Warning",
            description: "Could not find exact location, searching without location filter",
            variant: "default",
          });
        }
      }

      // Step 2: Execute searches across all channels in parallel
      const searchPromises = [];

      if (strategiesResponse.error) {
        console.log('Strategy generation failed, using basic search');
        // Fallback to basic database search
        const fallbackPromise = supabase.functions.invoke('search-stores', {
          body: {
            productName: productName.trim(),
            userLat: locationCoords?.lat || 45.4642, // Default to Milan if no coords
            userLng: locationCoords?.lng || 9.19,
            radius: 50
          }
        });
        searchPromises.push(fallbackPromise.then(result => ({ source: 'local_db_fallback', strategy: 'fallback', result })));
      } else {
        const storeCategories = strategiesResponse.data?.searchTerms || [];
        console.log('Generated store categories:', storeCategories);
        
        // Add the product name as a separate search term
        const searchTerms = [...storeCategories, productName.trim()];
        console.log('Final search terms (categories + product):', searchTerms);

        // Create promises for each search term and channel
        for (const searchTerm of searchTerms) {
          // Google Maps search for physical stores
          const searchPromise = supabase.functions.invoke('search-stores', {
            body: {
              productName: searchTerm,
              userLat: locationCoords?.lat || 45.4642,
              userLng: locationCoords?.lng || 9.19,
              radius: 50
            }
          });
          searchPromises.push(searchPromise.then(result => ({ source: 'google_maps', strategy: searchTerm, result })));
        }

        // Also search online stores but filter for physical ones only
        for (const searchTerm of searchTerms) {
          const firecrawlPromise = supabase.functions.invoke('search-online-stores', {
            body: {
              productName: searchTerm,
              location: locationCoords ? `${locationCoords.lat},${locationCoords.lng}` : location,
              searchRadius: '50km',
              physicalOnly: false, // Don't filter too aggressively
              userLat: locationCoords?.lat || 45.4642,
              userLng: locationCoords?.lng || 9.19
            }
          });
          searchPromises.push(firecrawlPromise.then(result => ({ source: 'firecrawl', strategy: searchTerm, result })));
        }

        // Add Google Shopping search
        for (const searchTerm of searchTerms) {
          const googleShoppingPromise = supabase.functions.invoke('search-google-shopping', {
            body: {
              query: searchTerm,
              limit: 5
            }
          });
          searchPromises.push(googleShoppingPromise.then(result => ({ source: 'google_shopping', strategy: searchTerm, result })));
        }
        
        console.log(`Total search promises created: ${searchPromises.length}`);
      }

      // Wait for all searches to complete
      console.log('Executing parallel searches across all channels...');
      const allResults = await Promise.all(searchPromises);
      
      // Step 3: Combine all results and filter for physical stores only
      const combinedStores: Store[] = [];
      
      allResults.forEach((searchResult, index) => {
        console.log(`Processing search result ${index}:`, searchResult);
        
        if (searchResult.result && searchResult.result.data && searchResult.result.data.stores && Array.isArray(searchResult.result.data.stores)) {
          console.log(`Result ${index} (${searchResult.source}/${searchResult.strategy}) returned ${searchResult.result.data.stores.length} stores`);
          console.log(`Sample stores from result ${index}:`, searchResult.result.data.stores.slice(0, 2));
          
          // Add all stores to combined list - let Google Maps verification handle validation
          combinedStores.push(...searchResult.result.data.stores);
          console.log(`Added ${searchResult.result.data.stores.length} stores from result ${index}`);
        } else if (searchResult.result && searchResult.result.error) {
          console.error(`Search ${index} (${searchResult.source}/${searchResult.strategy}) failed:`, searchResult.result.error);
        } else {
          console.warn(`Search result ${index} has unexpected structure:`, searchResult);
        }
      });

      console.log(`Combined ${combinedStores.length} physical stores from all sources`);

      // Step 4: Unified deduplication across ALL results
      const deduplicationResponse = await supabase.functions.invoke('unified-deduplication', {
        body: { stores: combinedStores }
      });

      let finalStores = combinedStores;
      if (deduplicationResponse.data && deduplicationResponse.data.stores) {
        finalStores = deduplicationResponse.data.stores;
        console.log(`Deduplicated to ${finalStores.length} unique stores`);
      }

      // Step 5: Verify ALL stores with Google Maps (required for physical stores)
      if (finalStores.length > 0) {
        console.log('Verifying all stores with Google Maps...');
        const verifiedStores = [];
        
        // Process stores in batches to avoid overwhelming the API
        for (let i = 0; i < finalStores.length; i += 5) {
          const batch = finalStores.slice(i, i + 5);
          try {
            for (const store of batch) {
              const verificationResponse = await supabase.functions.invoke('verify-store-maps', {
                body: { 
                  storeName: (store as any).store?.name || (store as any).name,
                  address: (store as any).store?.address || (store as any).address,
                  latitude: (store as any).store?.latitude || (store as any).latitude,
                  longitude: (store as any).store?.longitude || (store as any).longitude
                }
              });
              
              if (verificationResponse.data?.verified) {
                let storeWithVerification = {
                  ...store,
                  verification: verificationResponse.data
                };
                
                // Calculate distance if user location and store coordinates are available
                if (locationCoords && verificationResponse.data.geometry?.location) {
                  const storeLat = verificationResponse.data.geometry.location.lat;
                  const storeLng = verificationResponse.data.geometry.location.lng;
                  const distance = calculateDistance(
                    locationCoords.lat, 
                    locationCoords.lng, 
                    storeLat, 
                    storeLng
                  );
                  storeWithVerification = { ...storeWithVerification, distance: Math.round(distance * 100) / 100 };
                }
                
                verifiedStores.push(storeWithVerification);
              }
            }
          } catch (error) {
            console.error('Error verifying batch:', error);
          }
        }
        
        // Sort verified stores by distance if available
        finalStores = verifiedStores.sort((a: any, b: any) => {
          // Sort by distance (nulls last)
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return a.distance - b.distance;
        });
        
        console.log(`Google Maps verified ${finalStores.length} stores`);
        if (finalStores.length > 0 && finalStores[0].distance !== undefined) {
          console.log('Stores sorted by distance:', finalStores.slice(0, 3).map((s: any) => ({ 
            name: s.name || s.store?.name, 
            distance: s.distance 
          })));
        }
      }

      setResults({
        stores: finalStores,
        searchedProduct: productName,
        totalResults: finalStores.length
      });

      toast({
        title: "Search Complete",
        description: `Found ${finalStores.length} stores across all channels`,
      });

    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search Error",
        description: "An error occurred while searching. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStoreTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      grocery: "bg-green-100 text-green-800",
      pharmacy: "bg-blue-100 text-blue-800",
      electronics: "bg-purple-100 text-purple-800",
      department: "bg-orange-100 text-orange-800",
      specialty: "bg-pink-100 text-pink-800",
      other: "bg-gray-100 text-gray-800"
    };
    return colors[type] || colors.other;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-4">
          <img 
            src={instockrLogo} 
            alt="InStockr Logo" 
            className="w-16 h-16 drop-shadow-lg"
          />
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
            InStockr
          </h1>
        </div>
        <div className="max-w-2xl mx-auto">
          <p className="text-lg text-muted-foreground/80 mb-4">
            Find products in physical stores near you
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Google Maps verified
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Distance-based search
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              AI-powered search
            </div>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <Card className="shadow-lg border-0 bg-gradient-to-b from-card to-card/50">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="product" className="text-sm font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              Product Name
            </label>
            <Input
              id="product"
              placeholder="e.g., iPhone 15, Advil, Samsung TV..."
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          
          <div className="space-y-2 relative">
            <label htmlFor="location" className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Your Location
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="location"
                  placeholder="Enter city name (e.g., Milan, New York, Paris)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => location.length > 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {showSuggestions && locationSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {locationSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                        onClick={() => handleLocationSelect(suggestion)}
                      >
                        <MapPin className="h-3 w-3 text-gray-400" />
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                title="Use current location"
              >
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>


          <Button 
            onClick={handleSearch} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Stores
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              Results for "{results.searchedProduct}"
            </h2>
            <Badge variant="secondary">
              {results.totalResults} store{results.totalResults !== 1 ? 's' : ''} found
            </Badge>
          </div>

          {results.stores.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No stores found with this product in stock nearby.
                Try searching for a different product or expanding your search area.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {results.stores.filter(result => result != null).map((result, index) => {
                // Safety check - skip if result is null or undefined
                if (!result) {
                  console.error('Found null result in filtered array at index:', index);
                  return null;
                }
                
                console.log('Processing result:', index, result);
                
                // Check if we have proper store data
                const hasLocalStructure = 'store' in result && result.store?.name;
                const hasDirectStructure = 'name' in result && result.name;
                
                if (!hasLocalStructure && !hasDirectStructure) {
                  console.error('Invalid store data - missing required fields:', result);
                  return null;
                }
                
                if (!result.product?.name) {
                  console.error('Invalid store data - missing product name:', result);
                  return null;
                }
                
                console.log('Store passed validation, rendering card...');
                
                const storeName = (result as any).store?.name || (result as any).name || 'Unknown Store';
                const storeAddress = (result as any).store?.address || (result as any).address || 'Address not available';
                const storePhone = (result as any).store?.phone;
                const distance = (result as any).distance;
                
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                     <CardContent className="pt-6">
                         <div className="flex gap-4">
                           {/* LEFT SIDE: Image (square, height matches content) */}
                           <div className="w-21 h-21 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {(result as any).verification?.photoUrl ? (
                                <img 
                                  src={(result as any).verification.photoUrl} 
                                  alt={`${storeName} storefront`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const target = e.currentTarget as HTMLImageElement;
                                    const fallback = target.parentElement?.querySelector('.fallback-icon') as HTMLElement;
                                    if (fallback) {
                                      target.style.display = 'none';
                                      fallback.style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <div className={`w-full h-full items-center justify-center fallback-icon ${(result as any).verification?.photoUrl ? 'hidden' : 'flex'}`}>
                                <Store className="h-8 w-8 text-muted-foreground" />
                              </div>
                           </div>

                          {/* CENTER: Store Information */}
                          <div className="flex-1">
                            {/* Store name with category tag */}
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-xl font-semibold">{storeName}</h3>
                              {result.product.name && (
                                <Badge variant="outline" className="text-xs px-2 py-1 bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
                                  <Tag className="h-3 w-3" />
                                  {result.product.name}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Location */}
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">{storeAddress}</span>
                            </div>
                            
                            {/* Distance (if available) */}
                            {distance && (
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium text-blue-600 ml-6">
                                  📍 {distance.toFixed(1)} km away
                                </span>
                              </div>
                            )}
                            
                            {/* Phone (if available) */}
                            {storePhone && (
                              <div className="flex items-center gap-2 mb-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{storePhone}</span>
                              </div>
                            )}
                            
                            {/* Verification badge */}
                            {(result as any).verification && (
                              <div className="flex items-center gap-2">
                                {(result as any).verification.verified ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                    <span className="text-sm text-green-600">Verified on Google Maps</span>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                    <span className="text-sm text-orange-600">Not verified on Google Maps</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* RIGHT SIDE: Status and Actions */}
                          <div className="flex flex-col justify-between items-end min-w-[120px]">
                            {/* Open Now tag at the top */}
                            <div>
                              {(result as any).verification && typeof (result as any).verification.isOpen === 'boolean' && (
                                <Badge 
                                  variant="outline" 
                                  className={`${(result as any).verification.isOpen ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  {(result as any).verification.isOpen ? 'Open Now' : 'Closed Now'}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Visit Website button centered vertically */}
                            <div className="flex-1 flex items-center">
                              {(result as any).verification?.website && (
                                <Button variant="default" size="sm" asChild>
                                  <a 
                                    href={(result as any).verification.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2"
                                  >
                                    Visit Website <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                     </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}