import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Globe, Store, ExternalLink, ChevronDown } from "lucide-react";
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
  stores: (Store | OnlineStore)[];
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
  const [includeOnline, setIncludeOnline] = useState(true);
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
        
        // Reverse geocode to get city name
        try {
          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await response.json();
          const cityName = data.city && data.countryName ? 
            `${data.city}, ${data.countryName}` : 
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

  const geocodeLocation = async (locationStr: string) => {
    // Check if it's already coordinates (lat, lng format)
    const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    
    // Use a free geocoding service to convert city name to coordinates
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/forward-geocode-client?query=${encodeURIComponent(locationStr)}&localityLanguage=en`
      );
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        return {
          lat: result.latitude,
          lng: result.longitude
        };
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    
    throw new Error(`Location "${locationStr}" not found`);
  };

  const handleSearch = async () => {
    if (!productName.trim()) {
      toast({
        title: "Product name required",
        description: "Please enter a product name to search",
        variant: "destructive",
      });
      return;
    }

    if (!location.trim()) {
      toast({
        title: "Location required",
        description: "Please enter your location or use GPS",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults(null);

    try {
      const { lat, lng } = await geocodeLocation(location);
      const searchPromises = [];

      // Always search local stores
      const localSearchPromise = supabase.functions.invoke('search-stores', {
        body: {
          productName: productName.trim(),
          userLat: lat,
          userLng: lng,
          radius: 50 // 50km radius
        }
      });
      searchPromises.push(localSearchPromise);

      // Search online stores if enabled
      if (includeOnline) {
        const onlineSearchPromise = supabase.functions.invoke('search-online-stores', {
          body: {
            productName: productName.trim()
          }
        });
        searchPromises.push(onlineSearchPromise);
      }

      const searchResults = await Promise.allSettled(searchPromises);
      
      let allStores: (Store | OnlineStore)[] = [];
      let totalFound = 0;

      // Process local results
      const localResult = searchResults[0];
      if (localResult.status === 'fulfilled' && localResult.value.data?.stores) {
        allStores = [...allStores, ...localResult.value.data.stores];
        totalFound += localResult.value.data.stores.length;
      }

      // Process online results if included
      if (includeOnline && searchResults[1]) {
        const onlineResult = searchResults[1];
        if (onlineResult.status === 'fulfilled' && onlineResult.value.data?.stores) {
          allStores = [...allStores, ...onlineResult.value.data.stores];
          totalFound += onlineResult.value.data.stores.length;
        } else if (onlineResult.status === 'rejected') {
          console.error('Online search failed:', onlineResult.reason);
        }
      }

      setResults({
        stores: allStores,
        searchedProduct: productName.trim(),
        totalResults: totalFound
      });
      
      if (totalFound === 0) {
        toast({
          title: "No results found",
          description: `No stores found with "${productName}" in stock`,
        });
      } else {
        toast({
          title: "Search completed",
          description: `Found ${totalFound} result(s) for "${productName}"`,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unable to search for stores. Please try again.';
      toast({
        title: "Search failed",
        description: errorMessage,
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
            Discover products instantly across local stores
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Real-time inventory
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              Distance-based search
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              Online & local stores
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

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeOnline"
              checked={includeOnline}
              onChange={(e) => setIncludeOnline(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="includeOnline" className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Include online stores
            </label>
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
              {results.stores.map((result, index) => {
                const isOnline = 'isOnline' in result && result.isOnline;
                const onlineResult = isOnline ? result as OnlineStore : null;
                const localResult = !isOnline ? result as Store : null;
                
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold">
                              {isOnline ? onlineResult!.name : localResult!.store.name}
                            </h3>
                            {isOnline ? (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Globe className="h-3 w-3" />
                                Online
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Store className="h-3 w-3" />
                                Local
                              </Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground">
                            {isOnline ? onlineResult!.address : localResult!.store.address}
                          </p>
                          {!isOnline && localResult!.store.phone && (
                            <p className="text-sm text-muted-foreground">{localResult!.store.phone}</p>
                          )}
                        </div>
                        <div className="text-right space-y-2">
                          <Badge className={getStoreTypeColor(isOnline ? onlineResult!.store_type : localResult!.store.store_type)}>
                            {isOnline ? onlineResult!.store_type : localResult!.store.store_type}
                          </Badge>
                          {!isOnline && (
                            <p className="text-sm text-muted-foreground">
                              {localResult!.distance} km away
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{result.product.name}</p>
                            {!isOnline && 'brand' in localResult!.product && localResult!.product.brand && (
                              <p className="text-sm text-muted-foreground">
                                by {localResult!.product.brand}
                              </p>
                            )}
                            {isOnline && onlineResult!.product.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {onlineResult!.product.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {isOnline ? (
                              <p className="text-lg font-semibold text-primary">
                                {onlineResult!.product.price}
                              </p>
                            ) : localResult!.price && (
                              <p className="text-lg font-semibold text-primary">
                                ${localResult!.price}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm">
                          <div>
                            {isOnline && onlineResult!.product.availability ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                {onlineResult!.product.availability}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                ✓ In Stock
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isOnline && onlineResult!.url && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(onlineResult!.url!, '_blank')}
                                className="flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Visit Store
                              </Button>
                            )}
                            {!isOnline && (
                              <span className="text-muted-foreground">
                                Updated: {new Date(localResult!.last_updated).toLocaleDateString()}
                              </span>
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