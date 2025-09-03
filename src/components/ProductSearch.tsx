import { useState, useEffect } from "react";
import { Search, MapPin, Loader2, Globe, ExternalLink, ChevronDown, Store, Phone, Clock, CheckCircle, XCircle, Tag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import instockrLogo from "@/assets/instockr-logo.png";

import mobilePhoneImage from "@/assets/categories/mobile-phone.png";
import electronicsImage from "@/assets/categories/electronics.jpg";
import computerImage from "@/assets/categories/computer.jpg";

export interface StoreInterface {
  id: string;
  name: string;
  store_type: string;
  address: string;
  distance: number;
  latitude: number;
  longitude: number;
  phone: string | null;
  url: string;
  source: string;
  place_id: string;
  openingHours: any[];
}

interface SearchResult {
  stores: StoreInterface[];
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
  const [isLocationAutoDetected, setIsLocationAutoDetected] = useState(false);

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
    // Only fetch suggestions if location wasn't auto-detected
    if (!isLocationAutoDetected) {
      const timeoutId = setTimeout(() => {
        fetchLocationSuggestions(location);
      }, 300); // Debounce API calls

      return () => clearTimeout(timeoutId);
    }
  }, [location, isLocationAutoDetected]);

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
          setIsLocationAutoDetected(true);
          setIsGettingLocation(false);
          toast({
            title: "Location found",
            description: `Using ${detailedLocation} for search`,
          });
        } catch (error) {
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setIsLocationAutoDetected(true);
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

    // Navigate immediately to search page - let SearchResults handle validation and search
    navigate(`/search?product=${encodeURIComponent(productName)}&location=${encodeURIComponent(location)}`);
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
    // Map store types to category images
    const categoryImages: Record<string, string> = {
      mobile_phone: mobilePhoneImage,
      electronics: electronicsImage,
      computer: computerImage,
      // Add more categories as needed
    };
    return categoryImages[storeType] || null;
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
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  className="pl-4 pr-12 py-3 text-lg border-2 border-muted-foreground/20 bg-background/90 backdrop-blur-sm
                            focus:border-green-500/50 focus:ring-2 focus:ring-green-500/10 focus:bg-background 
                            transition-all duration-300 group-hover:shadow-lg group-hover:border-green-500/30 transform"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60">
                  <Globe className="h-5 w-5" />
                </div>
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
    </div>
  );
}