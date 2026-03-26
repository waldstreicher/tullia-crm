-- Tullia CRM Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- From website form
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_contact TEXT CHECK (preferred_contact IN ('phone', 'email')),
  areas_of_interest TEXT[] DEFAULT '{}',
  message TEXT,
  source TEXT NOT NULL DEFAULT 'website',

  -- Pipeline
  stage TEXT NOT NULL DEFAULT 'new_lead' CHECK (stage IN (
    'new_lead', 'attempted_contact', 'contacted', 'eligibility_review',
    'eligible', 'ineligible', 'virtual_consult_scheduled', 'virtual_consult_completed',
    'procedure_scheduled', 'procedure_completed', 'lost'
  )),

  -- Contact tracking
  last_contacted_at TIMESTAMPTZ,
  next_follow_up_date DATE,
  contact_attempts INTEGER NOT NULL DEFAULT 0,

  -- Eligibility
  eligibility_status TEXT NOT NULL DEFAULT 'pending' CHECK (eligibility_status IN (
    'pending', 'eligible', 'ineligible', 'requires_more_info'
  )),
  eligibility_notes TEXT,
  eligibility_reviewed_by TEXT,
  eligibility_reviewed_at TIMESTAMPTZ,

  -- Virtual consult
  virtual_consult_scheduled_at TIMESTAMPTZ,
  virtual_consult_completed_at TIMESTAMPTZ,
  virtual_consult_notes TEXT,

  -- Procedure
  procedure_scheduled_date DATE,
  procedure_completed_at TIMESTAMPTZ,
  procedure_areas TEXT[] DEFAULT '{}',

  -- Assignment
  assigned_to TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  internal_notes TEXT,
  tags TEXT[] DEFAULT '{}'
);

-- Lead notes table
CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  note TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'note' CHECK (type IN (
    'note', 'call', 'email', 'status_change', 'system'
  ))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS leads_stage_idx ON leads(stage);
CREATE INDEX IF NOT EXISTS leads_priority_idx ON leads(priority);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_idx ON leads(next_follow_up_date);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS lead_notes_created_at_idx ON lead_notes(created_at DESC);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Row Level Security (optional - disable if using service role key for all operations)
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

-- If you want to allow anon reads for the intake endpoint (not recommended for production):
-- CREATE POLICY "Allow service role full access" ON leads FOR ALL USING (true);
-- CREATE POLICY "Allow service role full access notes" ON lead_notes FOR ALL USING (true);
