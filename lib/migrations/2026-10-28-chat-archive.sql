-- Archive support for website chat transcripts. ADDITIVE: two nullable columns.
ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;
CREATE INDEX IF NOT EXISTS chat_sessions_archived_idx ON chat_sessions(archived_at);
