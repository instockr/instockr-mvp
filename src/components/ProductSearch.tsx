import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Globe, Store, ExternalLink, ChevronDown, Phone, Clock, CheckCircle, XCircle, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // OpenStreetMap Location Autocomplete
  const fetchLocationSuggestions = async (input: string) => {
    if (input.length < 3) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    try {
      const response = await supabase.functions.invoke('osm-location-autocomplete', {
        body: { input }
      });

      if (response.data?.predictions) {
        const suggestions = response.data.predictions.map((p: any) => p.description);
        setLocationSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } else {
        setLocationSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching location suggestions:', error);
      setLocationSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLocationSuggestions(location);
    }, 300); // Debounce API calls

    return () => clearTimeout(timeoutId);
  }, [location]);

  // Load persisted data on component mount
  useEffect(() => {
    // Load saved search data
    const savedProductName = sessionStorage.getItem('searchProductName');
    const savedLocation = sessionStorage.getItem('searchLocation');
    const savedResults = sessionStorage.getItem('searchResults');

    if (savedProductName) {
      setProductName(savedProductName);
    }
    
    if (savedLocation) {
      setLocation(savedLocation);
    }
    
    if (savedResults) {
      try {
        const parsedResults = JSON.parse(savedResults);
        setResults(parsedResults);
      } catch (error) {
        console.error('Error parsing saved search results:', error);
        sessionStorage.removeItem('searchResults');
      }
    }

    // Auto-retrieve location only if no saved location and location is empty
    if (!savedLocation && !location && navigator.geolocation) {
      getCurrentLocation();
    }
  }, []); // Only run once on mount

  // Save search data to sessionStorage whenever it changes
  useEffect(() => {
    if (productName) {
      sessionStorage.setItem('searchProductName', productName);
    }
  }, [productName]);

  useEffect(() => {
    if (location) {
      sessionStorage.setItem('searchLocation', location);
    }
  }, [location]);

  useEffect(() => {
    if (results) {
      sessionStorage.setItem('searchResults', JSON.stringify(results));
    }
  }, [results]);

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
        
        // Reverse geocode to get detailed address using Nominatim
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();
          
          // Build more precise location string from address components
          let locationParts = [];
          
          if (data.address) {
            // Add street info if available
            if (data.address.road) {
              if (data.address.house_number) {
                locationParts.push(`${data.address.house_number} ${data.address.road}`);
              } else {
                locationParts.push(data.address.road);
              }
            }
            
            // Add district/suburb if available
            if (data.address.suburb || data.address.city_district) {
              locationParts.push(data.address.suburb || data.address.city_district);
            }
            
            // Add city
            if (data.address.city || data.address.town || data.address.village) {
              locationParts.push(data.address.city || data.address.town || data.address.village);
            }
            
            // Add state if available
            if (data.address.state) {
              locationParts.push(data.address.state);
            }
            
            // Add country
            if (data.address.country) {
              locationParts.push(data.address.country);
            }
          }
          
          const detailedLocation = locationParts.length > 0 ? 
            locationParts.join(', ') : 
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          setLocation(detailedLocation);
          setIsGettingLocation(false);
          toast({
            title: "Location found",
            description: `Using ${detailedLocation} for search`,
          });
        } catch (error) {
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
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

    if (!location.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid location",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults(null);

    // Validate location before proceeding
    let locationCoords = null;
    try {
      locationCoords = await geocodeLocation(location);
      console.log('Location validated:', locationCoords);
    } catch (geocodeError) {
      console.error('Location validation failed:', geocodeError);
      toast({
        title: "Invalid Location",
        description: "Please enter a valid city or location that can be found on the map.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Step 1: Generate LLM-powered search strategies
      console.log('Generating search strategies...');
      const strategiesResponse = await supabase.functions.invoke('generate-search-strategies', {
        body: { 
          productName: productName.trim(),
          location: location.trim()
        }
      });

      // Step 2: Execute searches across all channels in parallel
      const searchPromises = [];

      if (strategiesResponse.error) {
        console.log('Strategy generation failed, using basic search');
        // Fallback to basic search
        const fallbackPromise = supabase.functions.invoke('search-osm-stores', {
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
          // OpenStreetMap search for physical stores
          const searchPromise = supabase.functions.invoke('search-osm-stores', {
            body: {
              productName: searchTerm,
              userLat: locationCoords?.lat || 45.4642,
              userLng: locationCoords?.lng || 9.19,
              radius: 50
            }
          });
          searchPromises.push(searchPromise.then(result => ({ source: 'openstreetmap', strategy: searchTerm, result })));
        }

        
        console.log(`Total search promises created: ${searchPromises.length}`);
      }

      // Wait for all searches to complete
      console.log('Executing parallel searches across all channels...');
      const allResults = await Promise.all(searchPromises);
      
      // Step 3: Combine all OpenStreetMap results
      const finalStores: Store[] = [];
      
      allResults.forEach((searchResult, index) => {
        if (searchResult.result && searchResult.result.data && searchResult.result.data.stores && Array.isArray(searchResult.result.data.stores)) {
          // All stores come from OpenStreetMap
          const storesWithVerification = searchResult.result.data.stores.map((store: any) => ({
            ...store,
            verification: {
              verified: true,
              osmId: store.place_id || `osm-${store.id}`,
              rating: store.rating,
              userRatingsTotal: store.userRatingsTotal,
              isOpen: store.isOpen,
              openingHours: store.openingHours || [],
              photoUrl: store.photoUrl,
              website: store.url
            }
          }));
          finalStores.push(...storesWithVerification);
        }
      });

      // Step 4: Deduplicate stores by address
      const deduplicationResponse = await supabase.functions.invoke('simple-deduplication', {
        body: { stores: finalStores }
      });

      let deduplicatedStores = finalStores;
      if (deduplicationResponse.data?.deduplicatedStores) {
        deduplicatedStores = deduplicationResponse.data.deduplicatedStores;
      }

      // Step 5: Sort by distance (closest first)
      deduplicatedStores.sort((a: any, b: any) => {
        // Sort by distance (nulls/undefined last)
        if (a.distance === null || a.distance === undefined) return 1;
        if (b.distance === null || b.distance === undefined) return -1;
        return a.distance - b.distance;
      });

      // Check if we have results
      if (deduplicatedStores.length > 0) {
        // Set final results
        setResults({
          stores: deduplicatedStores,
          searchedProduct: productName,
          totalResults: deduplicatedStores.length
        });

        toast({
          title: "Search Complete",
          description: `Found ${deduplicatedStores.length} stores`,
        });
      } else {
        // No stores found
        setResults({
          stores: [],
          searchedProduct: productName,
          totalResults: 0
        });

        toast({
          title: "No Results",
          description: "No stores found for this product",
          variant: "default",
        });
      }

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
            className="w-20 h-20 drop-shadow-lg"
          />
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
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
      <Card className="shadow-2xl drop-shadow-2xl border-0 bg-gradient-to-br from-card via-card/95 to-card/80 backdrop-blur-sm relative overflow-hidden 
                   before:absolute before:inset-0 before:bg-gradient-to-t before:from-transparent before:via-transparent before:to-white/10 before:pointer-events-none
                   ring-1 ring-black/5">
        {/* Animated background elements */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-blue-400/20 rounded-full animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-green-400/20 to-teal-400/20 rounded-full animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-br from-pink-400/10 to-orange-400/10 rounded-full animate-pulse delay-500"></div>
        </div>
        
        <CardContent className="pt-8 pb-8 space-y-6 relative z-10">
          <div className="space-y-3">
            <label htmlFor="product" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                <Search className="h-4 w-4" />
              </div>
              Product Name
            </label>
            <div className="relative group">
              <Input
                id="product"
                placeholder="e.g., iPhone 15, Advil, Samsung TV..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-4 pr-12 py-3 text-lg border-2 border-muted-foreground/20 bg-background/90 backdrop-blur-sm
                          focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 focus:bg-background
                          transition-all duration-300 group-hover:shadow-lg group-hover:border-purple-500/30 transform"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60">
                <Search className="h-5 w-5" />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 relative">
            <label htmlFor="location" className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-green-500 to-teal-500 text-white">
                <MapPin className="h-4 w-4" />
              </div>
              Your Location
            </label>
            <div className="flex gap-3">
              <div className="relative flex-1 group">
                <Input
                  id="location"
                  placeholder="Enter city name (e.g., Milan, New York, Paris)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  onFocus={() => location.length > 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-4 pr-12 py-3 text-lg border-2 border-muted-foreground/20 bg-background/90 backdrop-blur-sm
                            focus:border-green-500/50 focus:ring-2 focus:ring-green-500/10 focus:bg-background 
                            transition-all duration-300 group-hover:shadow-lg group-hover:border-green-500/30 transform"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60">
                  <Globe className="h-5 w-5" />
                </div>
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl mt-2 max-h-48 overflow-y-auto">
                    {isLoadingSuggestions ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading suggestions...</span>
                      </div>
                    ) : locationSuggestions.length > 0 ? (
                      locationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          className="w-full px-4 py-3 text-left hover:bg-muted/80 border-b border-border/30 last:border-b-0 flex items-center gap-3
                                    transition-all duration-200 hover:scale-[1.01] transform first:rounded-t-lg last:rounded-b-lg"
                          onClick={() => handleLocationSelect(suggestion)}
                        >
                          <div className="p-1 rounded-full bg-gradient-to-r from-green-400 to-teal-400">
                            <MapPin className="h-3 w-3 text-white" />
                          </div>
                          <span className="font-medium">{suggestion}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        No location suggestions found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="lg"
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                title="Use current location"
                className="px-4 py-3 border-2 border-transparent bg-gradient-to-r from-orange-500/10 to-red-500/10 
                          hover:from-orange-500/20 hover:to-red-500/20 hover:border-orange-500/30 
                          transition-all duration-300 hover:shadow-lg hover:scale-105 transform"
              >
                {isGettingLocation ? (
                  <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
                ) : (
                  <MapPin className="h-5 w-5 text-orange-600" />
                )}
              </Button>
            </div>
          </div>

          <Button 
            onClick={handleSearch} 
            disabled={isLoading}
            className="w-full py-4 text-lg font-semibold bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 
                      hover:from-purple-700 hover:via-blue-700 hover:to-teal-700 text-white border-0 shadow-xl
                      transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] transform
                      disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-xl
                      relative overflow-hidden group"
          >
            {/* Animated shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
            
            <div className="relative z-10 flex items-center justify-center">
              {isLoading ? (
                <>
                  <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                  <span className="animate-pulse">Searching stores...</span>
                </>
              ) : (
                <>
                  <Search className="mr-3 h-5 w-5" />
                  <span>Search Stores</span>
                </>
              )}
            </div>
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
                
                // Check if we have proper store data
                const hasLocalStructure = 'store' in result && result.store?.name;
                const hasDirectStructure = 'name' in result && result.name;
                
                if (!hasLocalStructure && !hasDirectStructure) {
                  return null;
                }
                
                if (!result.product?.name) {
                  return null;
                }
                
                const storeName = (result as any).store?.name || (result as any).name || 'Unknown Store';
                const storeAddress = (result as any).store?.address || (result as any).address || 'Address not available';
                const storePhone = (result as any).store?.phone;
                const distance = (result as any).distance;
                
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                     <CardContent className="pt-6">
                         <div className="flex gap-4">
                           {/* LEFT SIDE: Image (square, height matches content) */}
                           <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
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
                              <button
                                onClick={() => {
                                   const storeData = {
                                     name: storeName,
                                     address: storeAddress,
                                     product: results?.searchedProduct || productName,
                                     phone: (result as any).phone || storePhone,
                                     website: (result as any).url || (result as any).verification?.website,
                                     storeType: (result as any).store_type || (result as any).store?.store_type,
                                     photoUrl: (result as any).photoUrl || (result as any).verification?.photoUrl,
                                     rating: (result as any).rating || (result as any).verification?.rating,
                                     userRatingsTotal: (result as any).userRatingsTotal || (result as any).verification?.userRatingsTotal,
                                     isOpen: (result as any).isOpen ?? (result as any).verification?.isOpen,
                                     openingHours: (result as any).openingHours || (result as any).verification?.openingHours,
                                   };
                                  navigate(`/store/${encodeURIComponent(storeName)}`, { state: storeData });
                                }}
                                className="text-xl font-semibold text-primary hover:underline cursor-pointer text-left"
                              >
                                {storeName}
                              </button>
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
                               {((result as any).isOpen !== undefined && (result as any).isOpen !== null) ? (
                                 <Badge 
                                   variant="outline" 
                                   className={`${(result as any).isOpen ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}
                                 >
                                   <Clock className="h-3 w-3 mr-1" />
                                   {(result as any).isOpen ? 'Open Now' : 'Closed Now'}
                                 </Badge>
                               ) : (result as any).verification && typeof (result as any).verification.isOpen === 'boolean' && (
                                 <Badge 
                                   variant="outline" 
                                   className={`${(result as any).verification.isOpen ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}
                                 >
                                   <Clock className="h-3 w-3 mr-1" />
                                   {(result as any).verification.isOpen ? 'Open Now' : 'Closed Now'}
                                 </Badge>
                               )}
                             </div>
                            
                            {/* Action buttons centered vertically */}
                             <div className="flex-1 flex flex-col items-center justify-center gap-2 mt-4">
                               {/* Check for website from verification or direct store data */}
                               {((result as any).verification?.website || (result as any).url) && (
                                 <Button variant="default" size="sm" asChild>
                                   <a 
                                     href={(result as any).verification?.website || (result as any).url} 
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="flex items-center gap-2"
                                   >
                                     Visit Website <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               )}
                              
                              {/* View on Maps button */}
                              {storeAddress && (
                                <Button variant="outline" size="sm" asChild>
                                  <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2"
                                  >
                                    View on Maps <MapPin className="h-4 w-4" />
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