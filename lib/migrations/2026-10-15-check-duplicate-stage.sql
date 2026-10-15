-- "Check Duplicate" pipeline stage.
-- Run in the Supabase SQL editor.
--
-- Widens the leads.stage CHECK constraint to allow 'check_duplicate'. It does
-- not change any existing rows. Safe to re-run.

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_stage_check CHECK (stage IN (
  'check_duplicate', 'new_lead', 'attempted_contact', 'contacted', 'eligibility_review',
  'eligible', 'ineligible', 'virtual_consult_scheduled', 'virtual_consult_completed',
  'procedure_scheduled', 'procedure_completed', 'lost'
));
