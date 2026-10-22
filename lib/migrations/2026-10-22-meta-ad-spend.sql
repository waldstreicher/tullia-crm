-- Meta ad spend for the dashboard histograms. Run in the Supabase SQL editor.
--
-- ADDITIVE ONLY: creates two new tables. Doesn't touch leads or lead_notes.
-- Both have RLS enabled with no policies, so only the server (service role)
-- can read or write them — same as the other tables. Safe to re-run.

-- One row per platform per day (Meta's own reporting date).
CREATE TABLE IF NOT EXISTS public.ad_spend_daily (
  platform TEXT NOT NULL DEFAULT 'meta',
  date DATE NOT NULL,
  spend NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (platform, date)
);
ALTER TABLE public.ad_spend_daily ENABLE ROW LEVEL SECURITY;

-- Last sync attempt / success / error per external integration.
CREATE TABLE IF NOT EXISTS public.integration_status (
  name TEXT PRIMARY KEY,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT
);
ALTER TABLE public.integration_status ENABLE ROW LEVEL SECURITY;
