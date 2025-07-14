import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
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

interface SearchResult {
  stores: Store[];
  searchedProduct: string;
  totalResults: number;
}

export function ProductSearch() {
  const [productName, setProductName] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();

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
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation(`${latitude}, ${longitude}`);
        setIsGettingLocation(false);
        toast({
          title: "Location found",
          description: "Using your current location for search",
        });
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

  const parseLocation = (locationStr: string) => {
    // Try to parse coordinates first (lat, lng format)
    const coordMatch = locationStr.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lng: parseFloat(coordMatch[2])
      };
    }
    
    // For demo purposes, return NYC coordinates if parsing fails
    // In a real app, you'd use a geocoding service here
    toast({
      title: "Using default location",
      description: "Using New York City coordinates for demo. Use GPS button for accurate location.",
    });
    return { lat: 40.7128, lng: -74.0060 };
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
      const { lat, lng } = parseLocation(location);

      const { data, error } = await supabase.functions.invoke('search-stores', {
        body: {
          productName: productName.trim(),
          userLat: lat,
          userLng: lng,
          radius: 50 // 50km radius
        }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.totalResults === 0) {
        toast({
          title: "No results found",
          description: `No stores found with "${productName}" in stock nearby`,
        });
      } else {
        toast({
          title: "Search completed",
          description: `Found ${data.totalResults} store(s) with "${productName}" in stock`,
        });
      }
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: "Search failed",
        description: "Unable to search for stores. Please try again.",
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
              Price comparison
            </div>
          </div>
        </div>
      </div>

      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Product Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="product" className="text-sm font-medium">
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
          
          <div className="space-y-2">
            <label htmlFor="location" className="text-sm font-medium">
              Your Location
            </label>
            <div className="flex gap-2">
              <Input
                id="location"
                placeholder="Enter address or coordinates (lat, lng)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
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
              {results.stores.map((result, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{result.store.name}</h3>
                        <p className="text-muted-foreground">{result.store.address}</p>
                        {result.store.phone && (
                          <p className="text-sm text-muted-foreground">{result.store.phone}</p>
                        )}
                      </div>
                      <div className="text-right space-y-2">
                        <Badge className={getStoreTypeColor(result.store.store_type)}>
                          {result.store.store_type}
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                          {result.distance} km away
                        </p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">{result.product.name}</p>
                          {result.product.brand && (
                            <p className="text-sm text-muted-foreground">
                              by {result.product.brand}
                            </p>
                          )}
                        </div>
                        {result.price && (
                          <p className="text-lg font-semibold text-primary">
                            ${result.price}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          ✓ In Stock
                        </Badge>
                        <span>
                          Updated: {new Date(result.last_updated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}