import { createHmac, timingSafeEqual } from 'crypto'

// A booking token proves the bearer just submitted the consultation form for
// a given lead, so the public /schedule page can only book against that lead
// and nobody can book (or read) appointments for arbitrary lead ids.
//
// Format: "<lead_id>.<hmac>". Signed with BOOKING_TOKEN_SECRET, falling back to
// the service-role key (always present in production) so no extra env setup is
// required. Tokens don't expire: a prospect who skipped scheduling can still use
// the link later, and booking is idempotent-ish (one live booking per lead).

function secret(): string {
  return process.env.BOOKING_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function sign(leadId: string): string {
  return createHmac('sha256', secret()).update(leadId).digest('base64url').slice(0, 32)
}

export function signBookingToken(leadId: string): string {
  if (!secret()) throw new Error('No signing secret configured for booking tokens')
  return `${leadId}.${sign(leadId)}`
}

// Returns the lead id if the token is valid, otherwise null.
export function verifyBookingToken(token: string | null | undefined): string | null {
  if (!token || !secret()) return null
  const i = token.lastIndexOf('.')
  if (i < 1) return null
  const leadId = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expected = sign(leadId)
  if (sig.length !== expected.length) return null
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? leadId : null
}
