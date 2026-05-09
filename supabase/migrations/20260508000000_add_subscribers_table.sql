-- Subscribers table for promo email signups (banner + popup)
CREATE TABLE IF NOT EXISTS public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'popup',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscribers_created_at_idx ON public.subscribers (created_at DESC);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Public can insert (anon signup from banner/popup)
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.subscribers;
CREATE POLICY "Anyone can subscribe"
  ON public.subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL);

-- Only authenticated (admin) can read
DROP POLICY IF EXISTS "Authenticated can read subscribers" ON public.subscribers;
CREATE POLICY "Authenticated can read subscribers"
  ON public.subscribers
  FOR SELECT
  TO authenticated
  USING (true);
