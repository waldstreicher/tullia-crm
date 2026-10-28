-- Website chatbot transcripts. Run in the Supabase SQL editor.
-- ADDITIVE ONLY: two new tables. Does not touch leads, lead_notes or appointments.
-- Enable RLS when prompted (the CRM reads/writes via the service role, which bypasses it).

-- One row per visitor conversation. Anonymous by design: no name/email/phone is
-- collected in chat; identity is captured only by the consultation form.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page TEXT,                 -- path the widget was opened on
  language TEXT,             -- 'en' | 'es' as detected from the first reply
  ip_hash TEXT,              -- salted hash for abuse limits; never the raw IP
  user_agent TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,   -- any message in the session flagged
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS chat_sessions_last_message_idx ON chat_sessions(last_message_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_ip_day_idx ON chat_sessions(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  -- Assistant-turn metadata for cost tracking and review.
  model TEXT,
  input_tokens INTEGER,
  cache_read_tokens INTEGER,
  output_tokens INTEGER,
  stop_reason TEXT,
  latency_ms INTEGER,
  -- Staff review: mark an answer inaccurate and say what it should have been.
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  flag_note TEXT,
  flagged_by TEXT,
  flagged_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS chat_messages_created_idx ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_flagged_idx ON chat_messages(flagged) WHERE flagged;
