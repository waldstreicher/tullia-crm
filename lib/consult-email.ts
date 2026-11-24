import type { SupabaseClient } from '@supabase/supabase-js'
import { OWNER_EMAIL } from './scheduling'
import { PROSPECT_FROM, cancelScheduledEmail, renderConsultRequestReceived, sendEmail } from './email'

// Automatic email to a prospect who requests a consult on the website.
//
// The website sends the prospect straight from the form to /schedule, so at
// intake time we don't yet know whether they'll book a call. The "we'll call
// you the next business day" email is therefore queued with Resend to go out
// CONSULT_EMAIL_DELAY_MIN minutes later. If the prospect books a call before
// then, bookAppointment() cancels it and the booking confirmation (which
// carries the "our office staff will call you at that time" reminder) is the
// prospect's email instead.
//
// The queued email's Resend id is kept on the lead's timeline note, so no
// schema change is needed.

type Db = SupabaseClient

export const CONSULT_EMAIL_DELAY_MIN = Number(process.env.CONSULT_EMAIL_DELAY_MIN) || 15

const QUEUED_PREFIX = 'Consult request email queued'
const REF_RE = /\[ref:([A-Za-z0-9-]+)\]/

function etTime(d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(d) + ' ET'
}

async function note(db: Db, leadId: string, text: string, type: 'email' | 'system') {
  const { error } = await db.from('lead_notes').insert({ lead_id: leadId, author: 'System', note: text, type })
  if (error) console.error('lead_notes insert failed:', error)
}

// Called by /api/intake right after the lead is saved. Never throws.
export async function queueConsultRequestEmail(
  db: Db,
  lead: { id: string; first_name: string; email: string },
  now: Date = new Date()
): Promise<void> {
  try {
    const sendAt = new Date(now.getTime() + CONSULT_EMAIL_DELAY_MIN * 60_000)
    const r = await sendEmail({
      to: lead.email,
      from: PROSPECT_FROM,
      replyTo: OWNER_EMAIL,
      subject: 'We received your TuLi consultation request',
      html: renderConsultRequestReceived({ firstName: lead.first_name }),
      scheduledAt: sendAt,
    })
    if (r.ok && r.id) {
      await note(
        db,
        lead.id,
        `${QUEUED_PREFIX} for ${etTime(sendAt)} ("we'll call you the next business day"). It is cancelled automatically if the prospect books a call first. [ref:${r.id}]`,
        'email'
      )
    } else {
      await note(db, lead.id, `Consult request email could not be queued (${r.error || 'no id returned'})`, 'system')
    }
  } catch (err) {
    console.error('queueConsultRequestEmail failed:', err)
  }
}

// Called when a lead's first call is booked. Cancels the queued "next business
// day" email if it hasn't gone out yet. Returns true if one was cancelled.
export async function cancelQueuedConsultRequestEmail(db: Db, leadId: string): Promise<boolean> {
  try {
    const { data } = await db
      .from('lead_notes')
      .select('note')
      .eq('lead_id', leadId)
      .like('note', `${QUEUED_PREFIX}%`)
      .order('created_at', { ascending: false })
      .limit(1)
    const id = (data?.[0] as { note: string } | undefined)?.note.match(REF_RE)?.[1]
    if (!id) return false
    const r = await cancelScheduledEmail(id)
    if (r.ok) {
      await note(db, leadId, 'Queued consult request email cancelled — the prospect booked a call, so the booking confirmation was sent instead', 'system')
      return true
    }
    // Already delivered (the prospect booked after the delay) — nothing to undo.
    return false
  } catch (err) {
    console.error('cancelQueuedConsultRequestEmail failed:', err)
    return false
  }
}
