-- 5-digit ZIP code on leads (required on the website consult form and the
-- CRM's Add Lead form). Run in the Supabase SQL editor.
--
-- ADDITIVE ONLY: adds one nullable column; existing leads keep an empty ZIP
-- until staff fill it in. Safe to re-run.

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS zip_code TEXT;

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_zip_code_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_zip_code_check
  CHECK (zip_code IS NULL OR zip_code ~ '^[0-9]{5}$');
