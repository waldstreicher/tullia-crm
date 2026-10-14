import type { SupabaseClient } from '@supabase/supabase-js'
import {
  OWNER_EMAIL,
  SLOT_MINUTES,
  generateSlots,
  etDateStr,
  formatFullEt,
  normalizeTime,
  type Slot,
} from './scheduling'
import { sendEmail, renderBookingConfirmation, renderStaffBookingNotice } from './email'
import type { Appointment, AvailabilityRule, AvailabilityOverride, NoteType } from './types'

// Server-side scheduling operations shared by the public booking endpoint, the
// staff appointment endpoints, and the reminder cron. Every state change here
// also writes a lead_notes entry so the lead's activity timeline doubles as its
// scheduling history.

type Db = SupabaseClient

const CRM_BASE_URL = (process.env.CRM_BASE_URL || 'https://tullia-crm.vercel.app').replace(/\/$/, '')

export async function loadAvailability(db: Db, owner: string = OWNER_EMAIL) {
  const [rulesRes, overridesRes] = await Promise.all([
    db.from('availability_rules').select('*').eq('owner_email', owner).order('weekday').order('start_time'),
    db.from('availability_overrides').select('*').eq('owner_email', owner).order('date').order('start_time'),
  ])
  return {
    rules: (rulesRes.data || []) as AvailabilityRule[],
    overrides: (overridesRes.data || []) as AvailabilityOverride[],
  }
}

// All currently open slots on the owner's published calendar.
export async function getOpenSlots(db: Db, owner: string = OWNER_EMAIL, now: Date = new Date()): Promise<Slot[]> {
  const { rules, overrides } = await loadAvailability(db, owner)
  const { data: booked } = await db
    .from('appointments')
    .select('starts_at')
    .eq('owner_email', owner)
    .eq('status', 'booked')
    .gte('starts_at', now.toISOString())

  return generateSlots({
    rules: rules.map((r) => ({
      weekday: r.weekday,
      start_time: normalizeTime(r.start_time),
      end_time: normalizeTime(r.end_time),
    })),
    overrides: overrides.map((o) => ({
      date: o.date,
      kind: o.kind,
      start_time: o.start_time ? normalizeTime(o.start_time) : null,
      end_time: o.end_time ? normalizeTime(o.end_time) : null,
    })),
    bookedStarts: (booked || []).map((b: { starts_at: string }) => b.starts_at),
    now,
  })
}

export async function logNote(db: Db, leadId: string, note: string, type: NoteType = 'system', author = 'System') {
  const { error } = await db.from('lead_notes').insert({ lead_id: leadId, author, note, type })
  if (error) console.error('lead_notes insert failed:', error)
}

// The lead's live (future, booked) appointment, if any.
export async function getActiveAppointment(db: Db, leadId: string, now: Date = new Date()): Promise<Appointment | null> {
  const { data } = await db
    .from('appointments')
    .select('*')
    .eq('lead_id', leadId)
    .eq('status', 'booked')
    .gte('starts_at', now.toISOString())
    .order('starts_at')
    .limit(1)
  return (data?.[0] as Appointment) || null
}

export type BookResult =
  | { ok: true; appointment: Appointment; whenLabel: string }
  | {
      ok: false
      status: number
      code: 'invalid_lead' | 'invalid_time' | 'slot_unavailable' | 'slot_taken' | 'already_booked' | 'db_error'
      error: string
      existing?: Appointment
    }

export async function bookAppointment(
  db: Db,
  {
    leadId,
    startsAt,
    via,
    requireOpenSlot,
    rescheduledFrom,
    author = 'System',
    owner = OWNER_EMAIL,
    now = new Date(),
  }: {
    leadId: string
    startsAt: Date
    via: 'website' | 'crm'
    // Website bookings must land on a published open slot; staff may book any
    // future time (e.g. a time agreed on the phone).
    requireOpenSlot: boolean
    rescheduledFrom?: string
    author?: string
    owner?: string
    now?: Date
  }
): Promise<BookResult> {
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now.getTime()) {
    return { ok: false, status: 400, code: 'invalid_time', error: 'Appointment time must be in the future' }
  }

  const { data: lead } = await db
    .from('leads')
    .select('id, first_name, last_name, email')
    .eq('id', leadId)
    .single()
  if (!lead) return { ok: false, status: 404, code: 'invalid_lead', error: 'Lead not found' }

  const startIso = startsAt.toISOString()

  if (requireOpenSlot) {
    const open = await getOpenSlots(db, owner, now)
    if (!open.some((s) => s.start === startIso)) {
      return { ok: false, status: 409, code: 'slot_unavailable', error: 'That time is no longer available' }
    }
  }

  // One live booking per lead. A reschedule passes the old id explicitly.
  const existing = await getActiveAppointment(db, leadId, now)
  if (existing && existing.id !== rescheduledFrom) {
    return {
      ok: false,
      status: 409,
      code: 'already_booked',
      error: 'A follow-up call is already scheduled for this lead',
      existing,
    }
  }
  const previous = rescheduledFrom ? existing : null

  // Insert the new booking FIRST so that if the slot is taken, the old
  // appointment (on a reschedule) is left untouched.
  const { data: inserted, error: insErr } = await db
    .from('appointments')
    .insert({
      lead_id: leadId,
      owner_email: owner,
      starts_at: startIso,
      ends_at: new Date(startsAt.getTime() + SLOT_MINUTES * 60_000).toISOString(),
      status: 'booked',
      booked_via: via,
      rescheduled_from: previous?.id ?? null,
    })
    .select('*')
    .single()

  if (insErr || !inserted) {
    // 23505 = unique_violation on appointments_one_per_slot.
    if (insErr?.code === '23505') {
      return { ok: false, status: 409, code: 'slot_taken', error: 'That time was just booked by someone else' }
    }
    console.error('appointment insert failed:', insErr)
    return { ok: false, status: 500, code: 'db_error', error: 'Could not save the appointment' }
  }
  const appointment = inserted as Appointment

  if (previous) {
    await db
      .from('appointments')
      .update({ status: 'cancelled', cancelled_at: now.toISOString(), cancel_reason: 'rescheduled' })
      .eq('id', previous.id)
  }

  // Surface the call on the existing "Follow Up Today" dashboard/list.
  await db.from('leads').update({ next_follow_up_date: etDateStr(startsAt) }).eq('id', leadId)

  const whenLabel = formatFullEt(startsAt)
  if (previous) {
    const prevLabel = formatFullEt(new Date(previous.starts_at))
    await logNote(
      db,
      leadId,
      `Follow-up call rescheduled to ${whenLabel} (was ${prevLabel})${via === 'crm' ? ` by ${author}` : ' by the prospect via the website'}`
    )
  } else {
    await logNote(
      db,
      leadId,
      via === 'website'
        ? `Prospect booked a follow-up call for ${whenLabel} via the website`
        : `Follow-up call booked for ${whenLabel} by ${author}`
    )
  }

  // Confirmation to the prospect. A failed send never fails the booking — it's
  // recorded on the timeline so staff can follow up by phone.
  const firstName = (lead as { first_name: string }).first_name
  const conf = await sendEmail({
    to: (lead as { email: string }).email,
    subject: previous ? 'Your TuLi call has been rescheduled' : 'Your TuLi follow-up call is confirmed',
    html: renderBookingConfirmation({ firstName, whenLabel, rescheduled: !!previous }),
    replyTo: owner,
  })
  if (conf.ok) {
    const sentAt = new Date().toISOString()
    await db.from('appointments').update({ confirmation_sent_at: sentAt }).eq('id', appointment.id)
    appointment.confirmation_sent_at = sentAt
    await logNote(db, leadId, 'Confirmation email sent to prospect', 'email')
  } else {
    await logNote(db, leadId, `Confirmation email could not be sent (${conf.error})`)
  }

  // PII-free heads-up to the calendar owner for website-driven changes.
  if (via === 'website') {
    const notice = await sendEmail({
      to: owner,
      subject: previous ? 'Follow-up call rescheduled' : 'New follow-up call booked',
      html: renderStaffBookingNotice({
        kind: previous ? 'rescheduled' : 'booked',
        whenLabel,
        leadUrl: `${CRM_BASE_URL}/leads/${leadId}`,
      }),
    })
    if (!notice.ok) console.error('staff booking notice failed:', notice.error)
  }

  return { ok: true, appointment, whenLabel }
}

export async function cancelAppointment(
  db: Db,
  id: string,
  { reason, author = 'System', now = new Date() }: { reason?: string; author?: string; now?: Date }
): Promise<{ ok: true; appointment: Appointment } | { ok: false; status: number; error: string }> {
  const { data: appt } = await db.from('appointments').select('*').eq('id', id).single()
  if (!appt) return { ok: false, status: 404, error: 'Appointment not found' }
  if (appt.status !== 'booked') return { ok: false, status: 409, error: 'Only booked appointments can be cancelled' }

  const { data: updated, error } = await db
    .from('appointments')
    .update({ status: 'cancelled', cancelled_at: now.toISOString(), cancel_reason: reason || null })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) return { ok: false, status: 500, error: 'Could not cancel the appointment' }

  // Clear the follow-up date only if it was the one this booking set.
  const callDate = etDateStr(new Date(appt.starts_at))
  const { data: lead } = await db.from('leads').select('next_follow_up_date').eq('id', appt.lead_id).single()
  if (lead?.next_follow_up_date === callDate) {
    await db.from('leads').update({ next_follow_up_date: null }).eq('id', appt.lead_id)
  }

  await logNote(
    db,
    appt.lead_id,
    `Follow-up call for ${formatFullEt(new Date(appt.starts_at))} cancelled by ${author}${reason ? ` — ${reason}` : ''}`
  )
  return { ok: true, appointment: updated as Appointment }
}

export async function setAppointmentOutcome(
  db: Db,
  id: string,
  status: 'completed' | 'no_show',
  author = 'System'
): Promise<{ ok: true; appointment: Appointment } | { ok: false; status: number; error: string }> {
  const { data: appt } = await db.from('appointments').select('*').eq('id', id).single()
  if (!appt) return { ok: false, status: 404, error: 'Appointment not found' }
  if (appt.status !== 'booked') return { ok: false, status: 409, error: 'Only booked appointments can be updated' }

  const { data: updated, error } = await db
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()
  if (error || !updated) return { ok: false, status: 500, error: 'Could not update the appointment' }

  await logNote(
    db,
    appt.lead_id,
    `Follow-up call for ${formatFullEt(new Date(appt.starts_at))} marked ${status === 'completed' ? 'completed' : 'no-show'} by ${author}`,
    status === 'completed' ? 'call' : 'system'
  )
  return { ok: true, appointment: updated as Appointment }
}
