-- Replies prospects send to the automated TuLi emails (consult request,
-- call confirmation, reminder). Received by Resend at consults@ and posted to
-- /api/webhooks/resend-inbound. Run in the Supabase SQL editor.
-- ADDITIVE ONLY: one new table. Does not touch leads, lead_notes or appointments.
-- Enable RLS when prompted (the CRM reads/writes via the service role, which bypasses it).

CREATE TABLE IF NOT EXISTS email_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_email_id TEXT NOT NULL UNIQUE,      -- makes webhook retries idempotent
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT,
  text_body TEXT,
  html_body TEXT,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,  -- matched by sender email
  handled_at TIMESTAMPTZ,
  handled_by TEXT
);
CREATE INDEX IF NOT EXISTS email_replies_received_idx ON email_replies(received_at DESC);
CREATE INDEX IF NOT EXISTS email_replies_lead_idx ON email_replies(lead_id);

ALTER TABLE email_replies ENABLE ROW LEVEL SECURITY;
