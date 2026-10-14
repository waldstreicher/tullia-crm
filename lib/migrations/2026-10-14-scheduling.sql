-- Follow-up call scheduling (website booking page + CRM availability/appointments).
-- Run in the Supabase SQL editor.
--
-- ADDITIVE ONLY: creates three new tables and indexes. It does not alter or
-- touch any existing table or row (leads, lead_notes). Safe to re-run.

-- Janet's recurring weekly hours: one row per window (e.g. Mon 09:00–12:00).
CREATE TABLE IF NOT EXISTS availability_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_email TEXT NOT NULL,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS availability_rules_owner_idx ON availability_rules(owner_email);

-- Date-specific exceptions: block a whole day (no times), block part of a day,
-- or open an extra window on a date that wouldn't normally have hours.
CREATE TABLE IF NOT EXISTS availability_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  owner_email TEXT NOT NULL,
  date DATE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('block', 'open')),
  start_time TIME,
  end_time TIME,
  note TEXT,
  CHECK (
    (start_time IS NULL AND end_time IS NULL)
    OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);
CREATE INDEX IF NOT EXISTS availability_overrides_owner_date_idx
  ON availability_overrides(owner_email, date);

-- Every booking is its own row and is never deleted on change: a reschedule
-- cancels the old row and inserts a new one linked via rescheduled_from, so a
-- lead's full scheduling history is preserved.
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
  booked_via TEXT NOT NULL DEFAULT 'website' CHECK (booked_via IN ('website', 'crm')),
  rescheduled_from UUID REFERENCES appointments(id) ON DELETE SET NULL,
  cancel_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ
);

-- Only one LIVE booking per slot, enforced by the database itself so it holds
-- even when two prospects submit for the same time simultaneously.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_per_slot
  ON appointments(owner_email, starts_at) WHERE status = 'booked';
CREATE INDEX IF NOT EXISTS appointments_lead_idx ON appointments(lead_id);
CREATE INDEX IF NOT EXISTS appointments_starts_idx ON appointments(starts_at);

-- Reuses the updated_at trigger function from the base schema.
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
