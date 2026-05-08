-- Add slug + coa_url to products, and product_bundle_tiers table for per-product quantity discounts.

-- 1. slug column (unique, used for /:slug routing)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS coa_url text;

-- Backfill slugs from names (lowercase, replace non-alphanumeric with -, collapse, trim)
UPDATE public.products
SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

-- Resolve duplicate slugs by appending short id suffix
WITH dups AS (
  SELECT id, slug,
         row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.products
)
UPDATE public.products p
SET slug = p.slug || '-' || substr(p.id::text, 1, 6)
FROM dups
WHERE p.id = dups.id AND dups.rn > 1;

ALTER TABLE public.products
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products(slug);

-- 2. product_bundle_tiers
CREATE TABLE IF NOT EXISTS public.product_bundle_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  min_quantity integer NOT NULL CHECK (min_quantity >= 2),
  discount_percentage numeric NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, min_quantity)
);

CREATE INDEX IF NOT EXISTS product_bundle_tiers_product_id_idx
  ON public.product_bundle_tiers(product_id);
