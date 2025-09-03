import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, MapPin, Loader2, Globe, ExternalLink, Store, Phone, Clock, CheckCircle, XCircle, Tag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { StoreInterface } from "@/components/ProductSearch";
import instockrLogo from "@/assets/instockr-logo.png";

import mobilePhoneImage from "@/assets/categories/mobile-phone.png";
import electronicsImage from "@/assets/categories/electronics.jpg";
import computerImage from "@/assets/categories/computer.jpg";

interface SearchResult {
  stores: StoreInterface[];
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

  const geocodeLocation = async (locationStr: string) => {
    // Case 1: already coordinates (lat, lng)
    const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2]),
      };
    }

    // Case 2: free geocoding with Nominatim
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          locationStr
        )}&limit=1&addressdetails=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }

    throw new Error(`Location "${locationStr}" not found. Please try again.`);
  };

  const performSearch = async (productName: string, location: string) => {
    setIsLoading(true);
    
    // Initialize empty results
    const initialResult = {
      stores: [],
      searchedProduct: productName,
      totalResults: 0
    };
    setResults(initialResult);

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
      console.log('Calling generate-search-strategies...');
      const strategiesResponse = await supabase.functions.invoke('generate-search-strategies', {
        body: {
          productName: productName.trim(),
          location: location.trim()
        }
      });

      console.log('Strategy response:', strategiesResponse);

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

      // Step 2: Search for stores
      console.log('Calling search-osm-stores...');
      const osmResponse = await supabase.functions.invoke('search-osm-stores', {
        body: {
          userLat: locationCoords?.lat,
          userLng: locationCoords?.lng,
          radius: 5000,
          categories: storeCategories
        }
      });

      console.log('OSM response:', osmResponse);

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

      // Update results with actual data
      const finalResult = {
        stores: osmResponse.data?.stores || [],
        searchedProduct: productName,
        totalResults: osmResponse.data?.totalResults || 0
      };
      
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
                className="w-8 h-8"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-600 to-blue-600 bg-clip-text text-transparent">
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

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-lg">Searching stores...</span>
          </div>
        )}

        {results && !isLoading && (
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Store list on the left */}
            <div className="flex-1 overflow-y-auto">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  {results.totalResults} stores found for "{results.searchedProduct}"
                </h2>
              </div>

              {results.stores.length > 0 ? (
                <div className="space-y-4">
                  {results.stores.map((store) => {
                    const categoryImage = getCategoryImage(store.store_type);
                    
                    return (
                      <Card
                        key={store.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
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
                                <span className="text-blue-600 font-semibold text-sm flex-shrink-0">
                                  {store.distance.toFixed(1)} km
                                </span>
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
                                
                                {store.openingHours.length > 0 && (
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
              ) : (
                <div className="text-center py-12">
                  <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No stores found</h3>
                  <p className="text-muted-foreground">
                    Try searching for a different product or location.
                  </p>
                </div>
              )}
            </div>

            {/* Map placeholder on the right */}
            <div className="flex-1 flex items-center justify-center bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium mb-2">Map View</h3>
                <p className="text-muted-foreground text-sm">
                  Interactive map coming soon
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Initial state when no results and not loading */}
        {!results && !isLoading && (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Start your search</h3>
            <p className="text-muted-foreground">
              Enter a product name and location to find nearby stores.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}