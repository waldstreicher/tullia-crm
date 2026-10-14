import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller, canEditCalendar } from '@/lib/caller'
import { OWNER_EMAIL } from '@/lib/scheduling'

// Staff: add a date-specific availability override (block a day, block a
// window, or open an extra window).
export const dynamic = 'force-dynamic'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    owner?: string
    date?: string
    kind?: 'block' | 'open'
    start_time?: string | null
    end_time?: string | null
    note?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const owner = body.owner || OWNER_EMAIL
  if (!canEditCalendar(caller, owner)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!body.date || !DATE_RE.test(body.date) || (body.kind !== 'block' && body.kind !== 'open')) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) and kind (block|open) are required' }, { status: 400 })
  }
  const hasTimes = !!(body.start_time || body.end_time)
  if (hasTimes) {
    if (!body.start_time || !body.end_time || !TIME_RE.test(body.start_time) || !TIME_RE.test(body.end_time) || body.end_time <= body.start_time) {
      return NextResponse.json({ error: 'start_time and end_time must both be HH:MM with start < end' }, { status: 400 })
    }
  }
  if (body.kind === 'open' && !hasTimes) {
    return NextResponse.json({ error: 'An "open" override needs a time window' }, { status: 400 })
  }

  const { data, error } = await createServiceClient()
    .from('availability_overrides')
    .insert({
      owner_email: owner,
      date: body.date,
      kind: body.kind,
      start_time: hasTimes ? body.start_time : null,
      end_time: hasTimes ? body.end_time : null,
      note: body.note?.trim() || null,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
