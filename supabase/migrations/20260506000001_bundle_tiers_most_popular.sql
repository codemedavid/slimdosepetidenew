ALTER TABLE public.product_bundle_tiers
  ADD COLUMN IF NOT EXISTS most_popular boolean NOT NULL DEFAULT false;
