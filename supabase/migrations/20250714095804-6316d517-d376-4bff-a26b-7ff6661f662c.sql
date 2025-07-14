-- Create enum for store types
CREATE TYPE public.store_type AS ENUM ('grocery', 'pharmacy', 'electronics', 'department', 'specialty', 'other');

-- Create stores table
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  phone TEXT,
  store_type public.store_type NOT NULL DEFAULT 'other',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  barcode TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create inventory table (links products to stores with availability)
CREATE TABLE public.inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  in_stock BOOLEAN NOT NULL DEFAULT false,
  price DECIMAL(10, 2),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);

-- Enable Row Level Security
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (stores and products are public data)
CREATE POLICY "Anyone can view stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Anyone can view inventory" ON public.inventory FOR SELECT USING (true);

-- Create indexes for better performance
CREATE INDEX idx_stores_location ON public.stores(latitude, longitude);
CREATE INDEX idx_inventory_store_id ON public.inventory(store_id);
CREATE INDEX idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX idx_products_name ON public.products(name);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data
INSERT INTO public.stores (name, address, latitude, longitude, phone, store_type) VALUES
('Target Downtown', '123 Main St, Downtown', 40.7128, -74.0060, '(555) 123-4567', 'department'),
('CVS Pharmacy', '456 Oak Ave, Midtown', 40.7589, -73.9851, '(555) 234-5678', 'pharmacy'),
('Best Buy Electronics', '789 Tech Blvd, Tech District', 40.7282, -73.7949, '(555) 345-6789', 'electronics'),
('Whole Foods Market', '321 Organic St, Green Valley', 40.7505, -73.9934, '(555) 456-7890', 'grocery');

INSERT INTO public.products (name, brand, category, description) VALUES
('iPhone 15', 'Apple', 'Electronics', 'Latest iPhone model with advanced features'),
('Advil Pain Reliever', 'Pfizer', 'Health', 'Over-the-counter pain relief medication'),
('Organic Bananas', 'Dole', 'Grocery', 'Fresh organic bananas'),
('Samsung 55" TV', 'Samsung', 'Electronics', '4K Smart TV with HDR'),
('Vitamin D3', 'Nature Made', 'Health', 'Daily vitamin supplement');

-- Create inventory relationships
INSERT INTO public.inventory (store_id, product_id, in_stock, price) VALUES
((SELECT id FROM public.stores WHERE name = 'Target Downtown'), (SELECT id FROM public.products WHERE name = 'iPhone 15'), true, 799.99),
((SELECT id FROM public.stores WHERE name = 'Best Buy Electronics'), (SELECT id FROM public.products WHERE name = 'iPhone 15'), true, 799.99),
((SELECT id FROM public.stores WHERE name = 'Best Buy Electronics'), (SELECT id FROM public.products WHERE name = 'Samsung 55" TV'), true, 699.99),
((SELECT id FROM public.stores WHERE name = 'CVS Pharmacy'), (SELECT id FROM public.products WHERE name = 'Advil Pain Reliever'), true, 8.99),
((SELECT id FROM public.stores WHERE name = 'CVS Pharmacy'), (SELECT id FROM public.products WHERE name = 'Vitamin D3'), true, 12.99),
((SELECT id FROM public.stores WHERE name = 'Whole Foods Market'), (SELECT id FROM public.products WHERE name = 'Organic Bananas'), true, 3.99),
((SELECT id FROM public.stores WHERE name = 'Target Downtown'), (SELECT id FROM public.products WHERE name = 'Advil Pain Reliever'), false, 9.99);