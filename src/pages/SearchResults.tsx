import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, MapPin, Loader2, Globe, ExternalLink, Phone, Clock, CheckCircle, XCircle, Tag, ArrowLeft, ShoppingBag, List, Map, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { OpenLayersMap } from '../components/OpenLayersMap';
import { Store as StoreType } from '../../types/store';
import instockrLogo from "@/assets/instockr-logo.png";

import mobilePhoneImage from "@/assets/categories/mobile-phone.png";
import electronicsImage from "@/assets/categories/electronics.jpg";
import computerImage from "@/assets/categories/computer.jpg";

interface SearchResult {
  stores: StoreType[];
  searchedProduct: string;
  totalResults: number;
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [productName, setProductName] = useState(searchParams.get('product') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedStoreId, setHighlightedStoreId] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLocationAutoDetected, setIsLocationAutoDetected] = useState(false);
  const [userLocationCoords, setUserLocationCoords] = useState<{ lat: number; lng: number } | null>(null);

  const geocodeLocation = async (locationStr: string) => {
    console.log('geocodeLocation called with:', locationStr);

    // Case 1: already coordinates (lat, lng)
    const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const coords = {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
      console.log('Found coordinates in string format:', coords);
      return coords;
    }

    // Case 2: free geocoding with Nominatim
    try {
      const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        locationStr
      )}&limit=1&addressdetails=1`;

      console.log('Geocoding URL:', geocodeUrl);

      const response = await fetch(geocodeUrl, {
        headers: {
          'User-Agent': 'InStockr-App/1.0 (store-locator)'
        }
      });
      const data = await response.json();

      console.log('Nominatim geocoding response:', data);

      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
        console.log('Geocoded coordinates:', result);
        console.log('Full address from Nominatim:', data[0].display_name);
        return result;
      } else {
        console.error('No geocoding results found for:', locationStr);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }

    throw new Error(`Location "${locationStr}" not found. Please try again.`);
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    console.log('calculateDistance called with:', { lat1, lng1, lat2, lng2 });

    // Validate coordinates
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      console.error('Invalid coordinates provided to calculateDistance:', { lat1, lng1, lat2, lng2 });
      return 999; // Return large distance for invalid coordinates
    }

    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;

    console.log('Delta calculations:', { dLat, dLng });

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    console.log('Haversine calculation steps:', { a, c, distance });

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  };

  const performSearch = async (productName: string, location: string) => {
    const startTime = performance.now();
    // console.log('🚀 Search started at:', new Date().toISOString());

    setIsLoading(true);

    // Initialize empty results
    const initialResult = {
      stores: [],
      searchedProduct: productName,
      totalResults: 0
    };
    setResults(initialResult);

    // Step 1: Validate location before proceeding
    let locationCoords = null;
    let geocodeStart: number;
    let geocodeEnd: number;

    try {
      geocodeStart = performance.now();
      // console.log('📍 Starting geocoding at:', new Date().toISOString());

      // console.log('About to geocode location for search:', location);
      locationCoords = await geocodeLocation(location);

      geocodeEnd = performance.now();
      // console.log('✅ Geocoding completed in:', (geocodeEnd - geocodeStart).toFixed(2), 'ms');
      // console.log('Search will use these exact coordinates:', locationCoords);
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
      // Step 2: Generate LLM-powered search strategies
      let strategiesStart: number;
      let strategiesEnd: number;
      let osmStart: number;
      let osmEnd: number;

      strategiesStart = performance.now();
      //console.log('🧠 Starting strategy generation at:', new Date().toISOString());
      //console.log('Calling generate-search-strategies...');

      const strategiesResponse = await supabase.functions.invoke('generate-search-strategies', {
        body: {
          productName: productName.trim(),
          location: location.trim()
        }
      });

      strategiesEnd = performance.now();
      //console.log('✅ Strategy generation completed in:', (strategiesEnd - strategiesStart).toFixed(2), 'ms');
      //console.log('Strategy response:', strategiesResponse);

      if (strategiesResponse.error) {
        console.error('Strategy generation failed:', strategiesResponse.error);
        toast({
          title: "Search Error",
          description: `Failed to generate search strategies: ${strategiesResponse.error.message}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const storeCategories = strategiesResponse.data?.searchTerms || [];
      console.log('Generated categories:', storeCategories);

      if (storeCategories.length === 0) {
        toast({
          title: "No Results",
          description: "No store categories found for this product",
          variant: "default",
        });
        setIsLoading(false);
        return;
      }

      // Step 3: Search for stores
      osmStart = performance.now();
      //console.log('🗺️ Starting OSM store search at:', new Date().toISOString());
      console.log('Calling search-osm-stores...');
      console.log('Sending coordinates to overpass:', {
        userLat: locationCoords?.lat,
        userLng: locationCoords?.lng,
        radius: 5000
      });

      const osmResponse = await supabase.functions.invoke('search-osm-stores', {
        body: {
          userLat: locationCoords?.lat,
          userLng: locationCoords?.lng,
          radius: 5000,
          categories: storeCategories
        }
      });

      osmEnd = performance.now();
      // console.log('✅ OSM search completed in:', (osmEnd - osmStart).toFixed(2), 'ms');
      // console.log('OSM response:', osmResponse);

      if (osmResponse.error) {
        console.error('OSM search failed:', osmResponse.error);
        toast({
          title: "Search Error",
          description: "Store search failed. Please try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Step 4: Calculate distances and update results
      const distanceStart = performance.now();
      //console.log('🧮 Starting distance calculation at:', new Date().toISOString());

      const stores = osmResponse.data?.stores || [];
      console.log('User location coordinates:', locationCoords);
      console.log('Number of stores to calculate distance for:', stores.length);

      const storesWithDistance = stores.map((store, index) => {
        console.log(`Store ${index + 1} (${store.name}):`, {
          storeLat: store.latitude,
          storeLng: store.longitude,
          userLat: locationCoords!.lat,
          userLng: locationCoords!.lng
        });

        const calculatedDistance = calculateDistance(
          locationCoords!.lat,
          locationCoords!.lng,
          store.latitude,
          store.longitude
        );

        console.log(`Calculated distance for ${store.name}:`, calculatedDistance, 'km');

        return {
          ...store,
          distance: calculatedDistance
        };
      }).sort((a, b) => a.distance - b.distance);

      const distanceEnd = performance.now();
      // console.log('✅ Distance calculation completed in:', (distanceEnd - distanceStart).toFixed(2), 'ms');

      const finalResult = {
        stores: storesWithDistance,
        searchedProduct: productName,
        totalResults: osmResponse.data?.totalResults || 0
      };

      const totalEnd = performance.now();
      //console.log('🏁 Total search completed in:', (totalEnd - startTime).toFixed(2), 'ms');
      //console.log('📊 Performance breakdown:');
      //console.log('- Geocoding:', (geocodeEnd - geocodeStart).toFixed(2), 'ms');
      //console.log('- Strategy generation:', (strategiesEnd - strategiesStart).toFixed(2), 'ms');
      //console.log('- OSM search:', (osmEnd - osmStart).toFixed(2), 'ms');
      //console.log('- Distance calculation:', (distanceEnd - distanceStart).toFixed(2), 'ms');

      setResults(finalResult);
      sessionStorage.setItem('searchResults', JSON.stringify(finalResult));

      toast({
        title: "Search Complete",
        description: `Found ${finalResult.totalResults} stores`,
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

  // Load results from sessionStorage and start search if needed
  useEffect(() => {
    const savedResults = sessionStorage.getItem('searchResults');
    const productParam = searchParams.get('product');
    const locationParam = searchParams.get('location');

    if (savedResults) {
      try {
        const parsedResults = JSON.parse(savedResults);
        setResults(parsedResults);

        // If we have search params but no stores, start the search
        if (productParam && locationParam && parsedResults.stores.length === 0) {
          performSearch(productParam, locationParam);
        }
      } catch (error) {
        console.error('Error parsing saved search results:', error);

        // If there's an error but we have search params, start fresh search
        if (productParam && locationParam) {
          performSearch(productParam, locationParam);
        }
      }
    } else if (productParam && locationParam) {
      // No saved results but we have search params, start search
      performSearch(productParam, locationParam);
    }
  }, [searchParams]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation not supported",
        description: "Please enter your location manually",
        variant: "destructive",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Store the coordinates
        setUserLocationCoords({ lat: latitude, lng: longitude });

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
          );
          const data = await response.json();

          let locationParts = [];

          if (data.address) {
            if (data.address.road) {
              if (data.address.house_number) {
                locationParts.push(`${data.address.house_number} ${data.address.road}`);
              } else {
                locationParts.push(data.address.road);
              }
            }

            if (data.address.suburb || data.address.city_district) {
              locationParts.push(data.address.suburb || data.address.city_district);
            }

            if (data.address.city || data.address.town || data.address.village) {
              locationParts.push(data.address.city || data.address.town || data.address.village);
            }

            if (data.address.state) {
              locationParts.push(data.address.state);
            }

            if (data.address.country) {
              locationParts.push(data.address.country);
            }
          }

          const detailedLocation = locationParts.length > 0 ?
            locationParts.join(', ') :
            `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

          setLocation(detailedLocation);
          setIsLocationAutoDetected(true);
          toast({
            title: "Location found",
            description: `Using ${detailedLocation} for search`,
          });
        } catch (error) {
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setIsLocationAutoDetected(true);
          // Keep the coordinates even if reverse geocoding fails
          setUserLocationCoords({ lat: latitude, lng: longitude });
          toast({
            title: "Location found",
            description: "Using your current coordinates for search",
          });
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "Location access denied",
          description: "Please enter your location manually",
          variant: "destructive",
        });
      }
    );
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

    performSearch(productName, location);
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

  const getCategoryImage = (storeType: string): string | null => {
    const categoryImages: Record<string, string> = {
      mobile_phone: mobilePhoneImage,
      electronics: electronicsImage,
      computer: computerImage,
    };
    return categoryImages[storeType] || null;
  };

  const handleStoreClick = (storeId: string) => {
    navigate(`/store/${storeId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with search */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <img
                src={instockrLogo}
                alt="InStockr Logo"
                className="w-12 h-12"
              />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
                InStockr
              </h1>
            </button>
          </div>

          {/* Compact search form */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                placeholder="Product name..."
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-background"
              />
            </div>

            <div className="flex-1 relative">
              <Input
                placeholder="Location..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-background"
              />
            </div>

            <Button onClick={getCurrentLocation} variant="outline" size="sm">
              <MapPin className="h-4 w-4" />
            </Button>

            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content with responsive tabs */}
      <div className="max-w-7xl mx-auto p-4">

        {/* Desktop layout - side by side */}
        <div className="hidden lg:flex gap-4 h-[calc(100vh-240px)]">
          {/* Store list */}
          <div className="w-1/2 overflow-y-auto">
            <Card className="h-full">
              <CardContent className="p-4 h-full">
                {renderStoreList()}
              </CardContent>
            </Card>
          </div>

          {/* Map */}
          <div className="w-1/2">
            <Card className="h-full">
              <CardContent className="p-4 h-full">
                <OpenLayersMap
                  stores={results?.stores || []}
                  highlightedStoreId={highlightedStoreId}
                  onStoreHover={setHighlightedStoreId}
                  userLocation={userLocationCoords}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile/Tablet layout - tabs */}
        <div className="lg:hidden">
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">Store List</span>
                <span className="sm:hidden">List</span>
                {results && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {results.stores.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="h-4 w-4" />
                <span className="hidden sm:inline">Map View</span>
                <span className="sm:hidden">Map</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0">
              <Card>
                <CardContent className="p-4">
                  <div className="max-h-[70vh] overflow-y-auto">
                    {renderStoreList()}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="map" className="mt-0">
              <Card>
                <CardContent className="p-4">
                  <div className="h-[75vh] w-full">
                     <OpenLayersMap
                       stores={results?.stores || []}
                       highlightedStoreId={highlightedStoreId}
                       onStoreHover={setHighlightedStoreId}
                       userLocation={userLocationCoords}
                     />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );

  // Helper function to render store list content
  function renderStoreList() {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="absolute inset-0 animate-ping">
              <div className="h-12 w-12 rounded-full border-2 border-primary opacity-75"></div>
            </div>
          </div>
          <div className="mt-6 text-center animate-fade-in">
            <h3 className="text-lg font-semibold text-foreground mb-2">Searching stores...</h3>
            <p className="text-sm text-muted-foreground">Finding the best places to buy {productName}</p>
          </div>
          <div className="mt-4 flex gap-1">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      );
    }

    if (!results) {
      return (
        <div className="text-center py-12 animate-fade-in">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Ready to search</h3>
          <p className="text-muted-foreground">
            Enter a product and location to find nearby stores.
          </p>
        </div>
      );
    }

    if (results.stores.length === 0) {
      return (
        <div className="text-center py-12 animate-fade-in">
          <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No stores found</h3>
          <p className="text-muted-foreground">
            Try searching for a different product or location.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {results.stores.map((store) => {
          const categoryImage = getCategoryImage(store.store_type);

          return (
            <Card
              key={store.id}
              className={`transition-all duration-200 hover:shadow-lg cursor-pointer animate-fade-in ${
                highlightedStoreId === store.id ? 'ring-2 ring-primary shadow-lg' : ''
              }`}
              onMouseEnter={() => setHighlightedStoreId(store.id)}
              onMouseLeave={() => setHighlightedStoreId(null)}
              onClick={() => handleStoreClick(store.id)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {categoryImage && (
                    <div className="flex-shrink-0">
                      <img
                        src={categoryImage}
                        alt={store.store_type}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg truncate pr-2">{store.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          {store.distance.toFixed(1)} km
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{store.address}</span>
                      </div>

                      {store.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{store.phone}</span>
                        </div>
                      )}

                      {store.openingHours && store.openingHours.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{store.openingHours[0]}</span>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }
}