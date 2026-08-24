ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_sort_order_idx ON public.products (sort_order, created_at DESC);

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
  FROM public.products
)
UPDATE public.products p
SET sort_order = ranked.rn * 10
FROM ranked
WHERE p.id = ranked.id;