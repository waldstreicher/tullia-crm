import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'
import { bookAppointment } from '@/lib/appointments'

// Staff: list appointments (optionally for one lead / date range / status),
// or book one on a lead's behalf — including a reschedule.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = new URL(request.url).searchParams
  let q = createServiceClient()
    .from('appointments')
    .select('*, leads(first_name, last_name, email, phone)')
    .order('starts_at', { ascending: true })

  const leadId = p.get('lead_id')
  if (leadId) q = q.eq('lead_id', leadId)
  const status = p.get('status')
  if (status) q = q.eq('status', status)
  const from = p.get('from')
  if (from) q = q.gte('starts_at', from)
  const to = p.get('to')
  if (to) q = q.lt('starts_at', to)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST { lead_id, starts_at, rescheduled_from? }
export async function POST(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { lead_id?: string; starts_at?: string; rescheduled_from?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!body.lead_id || !body.starts_at) {
    return NextResponse.json({ error: 'lead_id and starts_at are required' }, { status: 400 })
  }

  const result = await bookAppointment(createServiceClient(), {
    leadId: body.lead_id,
    startsAt: new Date(body.starts_at),
    via: 'crm',
    requireOpenSlot: false,
    rescheduledFrom: body.rescheduled_from,
    author: caller.name,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code, existing: result.existing }, { status: result.status })
  }
  return NextResponse.json({ success: true, appointment: result.appointment, when_label: result.whenLabel }, { status: 201 })
}
