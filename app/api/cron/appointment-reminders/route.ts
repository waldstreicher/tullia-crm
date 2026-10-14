import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { sendEmail, renderBookingReminder } from '@/lib/email'
import { logNote } from '@/lib/appointments'
import { etDateStr, etToUtc, addDays, formatFullEt, OWNER_EMAIL } from '@/lib/scheduling'

// Morning-of reminder to every prospect with a booked follow-up call today
// (Eastern). Triggered by Vercel Cron (see vercel.json) and authenticated with
// CRON_SECRET exactly like the daily digest. Safe to re-run: reminder_sent_at
// prevents duplicates.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()
  const now = new Date()
  const today = etDateStr(now)
  const dayStart = etToUtc(today, '00:00').toISOString()
  const dayEnd = etToUtc(addDays(today, 1), '00:00').toISOString()

  const { data: appts, error } = await db
    .from('appointments')
    .select('id, lead_id, starts_at, owner_email, leads(first_name, email)')
    .eq('status', 'booked')
    .is('reminder_sent_at', null)
    .gte('starts_at', dayStart)
    .lt('starts_at', dayEnd)
  if (error) {
    console.error('Reminders: failed to load appointments', error)
    return NextResponse.json({ error: 'Failed to load appointments' }, { status: 500 })
  }

  const results: { id: string; ok: boolean; error?: string }[] = []
  for (const a of appts || []) {
    const lead = (Array.isArray(a.leads) ? a.leads[0] : a.leads) as { first_name: string; email: string } | null
    if (!lead?.email) {
      results.push({ id: a.id, ok: false, error: 'lead has no email' })
      continue
    }
    const whenLabel = formatFullEt(new Date(a.starts_at))
    const r = await sendEmail({
      to: lead.email,
      subject: 'Reminder: your TuLi follow-up call is today',
      html: renderBookingReminder({ firstName: lead.first_name, whenLabel }),
      replyTo: a.owner_email || OWNER_EMAIL,
    })
    if (r.ok) {
      await db.from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', a.id)
      await logNote(db, a.lead_id, `Reminder email sent for the ${whenLabel} call`, 'email')
    } else {
      await logNote(db, a.lead_id, `Reminder email could not be sent (${r.error})`)
    }
    results.push({ id: a.id, ok: r.ok, error: r.error })
  }

  return NextResponse.json({ date: today, due: results.length, sent: results.filter((r) => r.ok).length, results })
}
