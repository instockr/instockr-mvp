-- Create product_categories table for caching AI categorization results
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  product_name_normalized TEXT NOT NULL, -- normalized version for better matching
  categories TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique index on normalized product name to prevent duplicates
CREATE UNIQUE INDEX idx_product_categories_normalized ON public.product_categories(product_name_normalized);

-- Create index for faster lookups
CREATE INDEX idx_product_categories_product_name ON public.product_categories(product_name);

-- Enable Row Level Security
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- Allow public read access since this is just category data
CREATE POLICY "Allow public read access to product categories" 
ON public.product_categories 
FOR SELECT 
USING (true);

-- Allow public insert access to cache new categorizations
CREATE POLICY "Allow public insert to product categories" 
ON public.product_categories 
FOR INSERT 
WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();