ALTER TABLE public.soccer_matches
  ADD COLUMN IF NOT EXISTS entry_cost TEXT NOT NULL DEFAULT 'key';