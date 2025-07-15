import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Clock, Globe, Loader2, Tag, DollarSign, Store } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900/20 dark:to-pink-900/20">
      <div className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/')}
          className="mb-6 hover:bg-white/20 backdrop-blur-sm border border-white/10 
                   shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Search
        </Button>

        {/* Store Header with Hero Image */}
        <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-blue-600 to-teal-600 shadow-2xl">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/90 via-blue-600/90 to-teal-600/90"></div>
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KPGcgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjA1Ij4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPgo8L2c+CjwvZz4KPC9zdmc+')] opacity-20"></div>
          
          <div className="relative z-10 p-8">
            <div className="flex items-start gap-6">
              {/* Store Image */}
              <div className="relative">
                {storeData.photoUrl ? (
                  <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 backdrop-blur-sm">
                    <img 
                      src={storeData.photoUrl} 
                      alt={storeData.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-2xl bg-white/10 backdrop-blur-sm border-4 border-white/20 
                                flex items-center justify-center shadow-2xl">
                    <Store className="h-16 w-16 text-white/70" />
                  </div>
                )}
              </div>

              {/* Store Info */}
              <div className="flex-1 text-white">
                <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                  {storeData.name}
                </h1>
                
                {storeData.storeType && (
                  <Badge className="mb-4 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                    <Tag className="h-3 w-3 mr-1" />
                    {storeData.storeType}
                  </Badge>
                )}
                
                <div className="space-y-3 text-white/90">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 mr-3 text-white/70" />
                    <span className="text-lg">{storeData.address}</span>
                  </div>
                  
                  {storeData.phone && (
                    <div className="flex items-center">
                      <Phone className="h-5 w-5 mr-3 text-white/70" />
                      <span className="text-lg">{storeData.phone}</span>
                    </div>
                  )}
                  
                  {storeData.website && (
                    <div className="flex items-center">
                      <Globe className="h-5 w-5 mr-3 text-white/70" />
                      <a 
                        href={storeData.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-lg hover:text-white transition-colors underline underline-offset-2"
                      >
                        Visit Website
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Matches */}
        <div className="backdrop-blur-sm bg-white/30 dark:bg-black/30 rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600/10 via-blue-600/10 to-teal-600/10 p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold flex items-center text-gray-800 dark:text-white">
              <div className="p-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 mr-3">
                <DollarSign className="h-5 w-5 text-white" />
              </div>
              Products matching "{searchedProduct}"
            </h2>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 animate-pulse"></div>
                  <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-white p-4" />
                </div>
                <div className="ml-4">
                  <p className="text-lg font-medium text-gray-800 dark:text-white">
                    Crawling store website for products...
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Please wait while we search for matches
                  </p>
                </div>
              </div>
            ) : productMatches.length > 0 ? (
              <div className="space-y-6">
                {productMatches.map((product, index) => (
                  <div key={index} className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-teal-600/20 
                                  rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    
                    <div className="relative bg-white/60 dark:bg-black/60 backdrop-blur-sm rounded-2xl p-6 
                                  border border-white/30 shadow-lg hover:shadow-xl transition-all duration-300 
                                  hover:scale-[1.02] transform border-l-4 border-l-purple-600">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white group-hover:text-purple-600 transition-colors">
                          {product.name}
                        </h3>
                        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-full 
                                      shadow-lg font-bold text-lg">
                          {product.price}
                        </div>
                      </div>
                      
                      {product.description && (
                        <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                      
                      {product.availability && (
                        <div className="flex items-center mb-4 text-sm bg-green-50 dark:bg-green-900/20 
                                      rounded-full px-4 py-2 w-fit">
                          <Clock className="h-4 w-4 mr-2 text-green-600" />
                          <span className="text-green-700 dark:text-green-400 font-medium">
                            {product.availability}
                          </span>
                        </div>
                      )}
                      
                      {product.url && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild
                          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 
                                   hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl 
                                   transition-all duration-300"
                        >
                          <a href={product.url} target="_blank" rel="noopener noreferrer">
                            View Product
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full 
                              flex items-center justify-center mx-auto mb-6">
                  <Phone className="h-12 w-12 text-white" />
                </div>
                <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
                  No specific product matches found on the store's website.
                </p>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Please contact the store directly for availability and pricing.
                </p>
                {storeData.phone && (
                  <Button 
                    variant="outline"
                    className="bg-gradient-to-r from-purple-600 to-blue-600 text-white border-0 
                             hover:from-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl 
                             transition-all duration-300 px-6 py-3"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call {storeData.phone}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}