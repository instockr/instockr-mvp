import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Globe, Store, ExternalLink, ChevronDown, Phone, Clock, CheckCircle, XCircle } from "lucide-react";
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
    console.log('Search started with:', { productName, location });
    
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
      console.log('Geocoding location:', location);
      const { lat, lng } = await geocodeLocation(location);
      console.log('Geocoded coordinates:', { lat, lng });
      
      const searchPromises = [];

      // Always search local stores
      console.log('Starting local search...');
      const localSearchPromise = supabase.functions.invoke('search-stores', {
        body: {
          productName: productName.trim(),
          userLat: lat,
          userLng: lng,
          radius: 50 // 50km radius
        }
      });
      searchPromises.push(localSearchPromise);

      // Always search online stores for additional location data
      console.log('Starting online search...');
      const onlineSearchPromise = supabase.functions.invoke('search-online-stores', {
        body: {
          productName: productName.trim()
        }
      });
      searchPromises.push(onlineSearchPromise);

      console.log('Waiting for search results...');
      const searchResults = await Promise.allSettled(searchPromises);
      console.log('Search results received:', searchResults);
      
      let allStores: (Store | OnlineStore)[] = [];
      let totalFound = 0;

      // Process local results
      const localResult = searchResults[0];
      console.log('Local result:', localResult);
      if (localResult.status === 'fulfilled' && localResult.value.data?.stores) {
        allStores = [...allStores, ...localResult.value.data.stores];
        totalFound += localResult.value.data.stores.length;
        console.log('Added local stores:', localResult.value.data.stores.length);
      } else if (localResult.status === 'rejected') {
        console.error('Local search failed:', localResult.reason);
      }

      // Process online results
      const onlineResult = searchResults[1];
      console.log('Online result:', onlineResult);
      if (onlineResult.status === 'fulfilled' && onlineResult.value.data?.stores) {
        allStores = [...allStores, ...onlineResult.value.data.stores];
        totalFound += onlineResult.value.data.stores.length;
        console.log('Added online stores:', onlineResult.value.data.stores.length);
      } else if (onlineResult.status === 'rejected') {
        console.error('Online search failed:', onlineResult.reason);
      }

      console.log('Final results before deduplication:', { totalFound, allStores: allStores.filter(s => s != null) });
      
      // Deduplicate stores using AI if we have results
      if (allStores.length > 1) {
        console.log('Starting deduplication process...');
        try {
          const deduplicationResponse = await supabase.functions.invoke('deduplicate-stores', {
            body: { stores: allStores }
          });
          
          if (deduplicationResponse.data?.deduplicatedStores) {
            console.log('Deduplication successful:', deduplicationResponse.data);
            allStores = deduplicationResponse.data.deduplicatedStores;
            totalFound = allStores.length;
            
            // Results consolidated silently - no need to notify user
          }
        } catch (deduplicationError) {
          console.error('Deduplication failed, using original results:', deduplicationError);
          // Continue with original results if deduplication fails
        }
      }

      // Verify ALL stores with Google Maps to determine if they're physical or online
      if (allStores.length > 0) {
        console.log('Starting Google Maps verification...');
        try {
          const verifiedStores = await Promise.all(
            allStores.map(async (store: Store | OnlineStore) => {
              // Safety check - skip if store is null or undefined
              if (!store) {
                console.warn('Skipping undefined store during verification');
                return null;
              }
              
              // Try to verify every store with Google Maps
              try {
                let storeName, storeAddress, latitude, longitude;
                
                if ('store' in store) {
                  // Local store format
                  storeName = store.store.name;
                  storeAddress = store.store.address;
                  latitude = store.store.latitude;
                  longitude = store.store.longitude;
                } else {
                  // Online store format
                  storeName = store.name;
                  storeAddress = store.address;
                  latitude = store.latitude;
                  longitude = store.longitude;
                }
                
                const { data: verification } = await supabase.functions.invoke('verify-store-maps', {
                  body: {
                    storeName,
                    address: storeAddress,
                    latitude,
                    longitude
                  }
                });
                
                if (verification?.verified) {
                  // Found on Google Maps - mark as physical store
                  return {
                    ...store,
                    isOnline: false,
                    verification: verification
                  };
                } else {
                  // Not found on Google Maps - keep as online store
                  return {
                    ...store,
                    isOnline: true,
                    verification: { verified: false }
                  };
                }
              } catch (error) {
                console.error('Error verifying store:', error);
                return {
                  ...store,
                  isOnline: true, // Default to online if verification fails
                  verification: { verified: false }
                };
              }
            })
          );
          
          // Filter out any null/undefined results
          allStores = verifiedStores.filter(store => store !== null && store !== undefined);
        } catch (verificationError) {
          console.error('Store verification failed, using original results:', verificationError);
        }
      }

      // Final safety check - ensure all stores in the final results are valid
      const validStores = allStores.filter(store => {
        if (!store) {
          console.warn('Filtering out null/undefined store');
          return false;
        }
        
        // Check if the store has basic required properties
        if ('store' in store) {
          // Local store format
          if (!store.store?.name || !store.product?.name) {
            console.warn('Filtering out invalid local store:', store);
            return false;
          }
        } else {
          // Online store format
          if (!store.name || !store.product?.name) {
            console.warn('Filtering out invalid online store:', store);
            return false;
          }
        }
        
        return true;
      });

      console.log(`Filtered ${allStores.length} stores down to ${validStores.length} valid stores`);
      console.log('Final valid stores being set in results:', validStores);

      setResults({
        stores: validStores,
        searchedProduct: productName.trim(),
        totalResults: validStores.length
      });
      
      console.log('Results state has been set:', {
        storeCount: validStores.length,
        searchedProduct: productName.trim(),
        totalResults: validStores.length
      });
      
      if (totalFound === 0) {
        toast({
          title: "No results found",
          description: `No stores found with "${productName}" in stock`,
        });
      } else {
        toast({
          title: "Search completed",
          description: `Found ${totalFound} unique result(s) for "${productName}"`,
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
      console.log('Search completed, setting loading to false');
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
                // EXTREME safety check - skip if result is null or undefined
                if (!result) {
                  console.error('Found null result in filtered array at index:', index);
                  return null;
                }
                
                console.log('Processing result:', index, result);
                
                const isOnline = 'isOnline' in result && result.isOnline;
                const onlineResult = isOnline ? result as OnlineStore : null;
                const localResult = !isOnline ? result as Store : null;
                
                // Additional safety checks for required properties
                if (isOnline) {
                  if (!onlineResult || !onlineResult.name || !onlineResult.product) {
                    console.error('Invalid online store data:', onlineResult);
                    return null;
                  }
                 } else {
                   // This could be either a proper local store OR an online store structure marked as physical
                   const hasLocalStructure = localResult && 'store' in localResult && localResult.store?.name;
                   const hasOnlineStructure = result && 'name' in result && result.name;
                   
                   if (!hasLocalStructure && !hasOnlineStructure) {
                     console.error('Invalid store data - neither local nor online structure:', result);
                     return null;
                   }
                   
                   if (!result.product?.name) {
                     console.error('Invalid store data - missing product name:', result);
                     return null;
                   }
                 }
                
                console.log('Store passed validation, rendering card...');
                
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          {/* Store Image */}
                          <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                             {(result as any).verification?.photoUrl ? (
                               <img 
                                 src={(result as any).verification.photoUrl} 
                                 alt={`${isOnline ? onlineResult?.name : (localResult?.store?.name || (result as OnlineStore).name)} storefront`}
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
                        
                         <div className="flex-1">
                           <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center gap-2">
                               <h3 className="text-xl font-semibold">
                                 {isOnline ? onlineResult?.name || 'Unknown Store' : (localResult?.store?.name || (result as any).name || 'Unknown Store')}
                               </h3>
                               {/* Store type badge next to name */}
                               {isOnline ? (
                                 <Badge variant="secondary" className="flex items-center gap-1">
                                   <Globe className="h-3 w-3" />
                                   Online Store
                                 </Badge>
                               ) : (
                                 <Badge variant="secondary" className="flex items-center gap-1">
                                   <Store className="h-3 w-3" />
                                   Local Store
                                 </Badge>
                               )}
                             </div>
                             <div className="flex flex-col items-end gap-2">
                               <Badge 
                                 variant="outline" 
                                 className={getStoreTypeColor(isOnline ? onlineResult?.store_type || 'other' : (localResult?.store?.store_type || (result as any).store_type || 'other'))}
                               >
                                 {isOnline ? onlineResult?.store_type || 'other' : (localResult?.store?.store_type || (result as any).store_type || 'other')}
                               </Badge>
                               {/* Website button positioned under the retail badge */}
                               {isOnline && onlineResult?.url && (
                                 <Button variant="default" size="sm" asChild>
                                   <a 
                                     href={onlineResult.url} 
                                     target="_blank" 
                                     rel="noopener noreferrer"
                                     className="flex items-center gap-2"
                                   >
                                     Visit Website <ExternalLink className="h-4 w-4" />
                                   </a>
                                 </Button>
                               )}
                               {!isOnline && (result as any).verification?.website && (
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
                           <p className="text-sm text-muted-foreground mb-2">
                             Selling {isOnline ? onlineResult?.product?.name || 'Unknown Product' : (localResult?.product?.name || (result as any).product?.name || 'Unknown Product')}
                           </p>
                           
                             <div className="space-y-2 text-sm text-muted-foreground mb-4">
                               <div className="flex items-center gap-2">
                                 <MapPin className="h-4 w-4" />
                                 <span>{isOnline ? onlineResult?.address || 'Address not available' : (localResult?.store?.address || (result as any).address || 'Address not available')}</span>
                               </div>
                              {!isOnline && localResult?.distance && (
                                <div className="flex items-center gap-2">
                                  <span className="ml-6">{localResult.distance.toFixed(1)} km away</span>
                                </div>
                              )}
                              {!isOnline && localResult?.store?.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-4 w-4" />
                                  <span>{localResult.store.phone}</span>
                                </div>
                              )}
                             {!isOnline && (localResult as any).verification && (
                               <div className="flex items-center gap-2">
                                 {(localResult as any).verification.verified ? (
                                   <>
                                     <CheckCircle className="h-4 w-4 text-green-600" />
                                     <span className="text-green-600">Verified on Google Maps</span>
                                     {typeof (localResult as any).verification.isOpen === 'boolean' && (
                                       <Badge 
                                         variant="outline" 
                                         className={`ml-2 ${(localResult as any).verification.isOpen ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'}`}
                                       >
                                         <Clock className="h-3 w-3 mr-1" />
                                         {(localResult as any).verification.isOpen ? 'Open Now' : 'Closed Now'}
                                       </Badge>
                                     )}
                                   </>
                                 ) : (
                                   <>
                                     <XCircle className="h-4 w-4 text-orange-600" />
                                     <span className="text-orange-600">Not verified on Google Maps</span>
                                   </>
                                 )}
                               </div>
                             )}
                           </div>
                          
                            <div className="flex items-center gap-3">
                              {/* Empty div for potential future actions */}
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