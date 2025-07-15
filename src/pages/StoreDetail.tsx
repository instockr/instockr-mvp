import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Clock, Globe, Loader2, Tag, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProductMatch {
  name: string;
  price: string;
  description?: string;
  availability?: string;
  url?: string;
}

interface StoreData {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  isOpen?: boolean;
  openingHours?: string[];
  photoUrl?: string;
  storeType?: string;
}

export default function StoreDetail() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [productMatches, setProductMatches] = useState<ProductMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchedProduct, setSearchedProduct] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const storeName = urlParams.get('name');
    const storeAddress = urlParams.get('address');
    const storeWebsite = urlParams.get('website');
    const product = urlParams.get('product');
    const phone = urlParams.get('phone');
    const storeType = urlParams.get('type');

    if (storeName && storeAddress && product) {
      setSearchedProduct(product);
      setStoreData({
        name: storeName,
        address: storeAddress,
        website: storeWebsite || undefined,
        phone: phone || undefined,
        storeType: storeType || undefined,
      });
      
      // Crawl the store's website for product matches
      crawlStoreForProducts(storeName, storeWebsite || "", product);
    } else {
      toast({
        title: "Error",
        description: "Invalid store data. Redirecting back.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [storeId, navigate, toast]);

  const crawlStoreForProducts = async (storeName: string, website: string, product: string) => {
    setIsLoading(true);
    
    try {
      const response = await supabase.functions.invoke('crawl-store-products', {
        body: {
          storeName,
          website,
          productName: product
        }
      });

      if (response.data?.products) {
        setProductMatches(response.data.products);
      } else if (response.error) {
        console.error('Store crawling error:', response.error);
        toast({
          title: "Crawling Error",
          description: "Could not retrieve product information from store website.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error crawling store:', error);
      toast({
        title: "Error",
        description: "Failed to crawl store for products.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!storeData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        {/* Store Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2">{storeData.name}</CardTitle>
                {storeData.storeType && (
                  <Badge variant="secondary" className="mb-2">
                    <Tag className="h-3 w-3 mr-1" />
                    {storeData.storeType}
                  </Badge>
                )}
                <div className="flex items-center text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4 mr-2" />
                  {storeData.address}
                </div>
                {storeData.phone && (
                  <div className="flex items-center text-muted-foreground mb-2">
                    <Phone className="h-4 w-4 mr-2" />
                    {storeData.phone}
                  </div>
                )}
                {storeData.website && (
                  <div className="flex items-center text-muted-foreground">
                    <Globe className="h-4 w-4 mr-2" />
                    <a 
                      href={storeData.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
              </div>
              {storeData.photoUrl && (
                <img 
                  src={storeData.photoUrl} 
                  alt={storeData.name}
                  className="w-32 h-32 object-cover rounded-lg"
                />
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Product Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <DollarSign className="h-5 w-5 mr-2" />
              Products matching "{searchedProduct}"
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Crawling store website for products...
              </div>
            ) : productMatches.length > 0 ? (
              <div className="space-y-4">
                {productMatches.map((product, index) => (
                  <Card key={index} className="border-l-4 border-l-primary">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{product.name}</h3>
                        <Badge variant="outline" className="text-lg font-bold">
                          {product.price}
                        </Badge>
                      </div>
                      {product.description && (
                        <p className="text-muted-foreground mb-2">{product.description}</p>
                      )}
                      {product.availability && (
                        <div className="flex items-center mb-2">
                          <Clock className="h-4 w-4 mr-2" />
                          <span className="text-sm">{product.availability}</span>
                        </div>
                      )}
                      {product.url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={product.url} target="_blank" rel="noopener noreferrer">
                            View Product
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No specific product matches found on the store's website.
                  Please contact the store directly for availability and pricing.
                </p>
                {storeData.phone && (
                  <Button variant="outline" className="mt-4">
                    <Phone className="h-4 w-4 mr-2" />
                    Call {storeData.phone}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}