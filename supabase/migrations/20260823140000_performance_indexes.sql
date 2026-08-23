-- Performance indexes for catalog queries, category/brand filters, and variant joins
CREATE INDEX IF NOT EXISTS products_active_created_at_idx ON public.products (active, created_at DESC);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON public.products (category_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS products_brand_id_idx ON public.products (brand_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS product_variants_active_idx ON public.product_variants (product_id, active);
