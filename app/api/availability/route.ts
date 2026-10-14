import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller, canEditCalendar } from '@/lib/caller'
import { loadAvailability } from '@/lib/appointments'
import { OWNER_EMAIL } from '@/lib/scheduling'

// Staff: read and replace the weekly availability rules for a calendar owner.
// The website publishes OWNER_EMAIL's calendar (Janet), so that is the default.
// Any staff member may view; the owner, admins, and designated editors may edit.
export const dynamic = 'force-dynamic'

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export async function GET(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const owner = new URL(request.url).searchParams.get('owner') || OWNER_EMAIL
  const { rules, overrides } = await loadAvailability(createServiceClient(), owner)
  return NextResponse.json({
    owner,
    published_owner: OWNER_EMAIL,
    can_edit: canEditCalendar(caller, owner),
    rules,
    overrides,
  })
}

// PUT { owner?, rules: [{ weekday, start_time, end_time }] } — full replace.
export async function PUT(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { owner?: string; rules?: { weekday: number; start_time: string; end_time: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const owner = body.owner || OWNER_EMAIL
  if (!canEditCalendar(caller, owner)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rules = Array.isArray(body.rules) ? body.rules : null
  if (!rules) return NextResponse.json({ error: 'rules array is required' }, { status: 400 })
  for (const r of rules) {
    if (
      !Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 6 ||
      !TIME_RE.test(r.start_time) || !TIME_RE.test(r.end_time) || r.end_time <= r.start_time
    ) {
      return NextResponse.json({ error: 'Each rule needs weekday 0–6 and HH:MM start < end' }, { status: 400 })
    }
  }

  const db = createServiceClient()
  const { error: delErr } = await db.from('availability_rules').delete().eq('owner_email', owner)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (rules.length) {
    const { error: insErr } = await db
      .from('availability_rules')
      .insert(rules.map((r) => ({ owner_email: owner, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time })))
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const { rules: saved } = await loadAvailability(db, owner)
  return NextResponse.json({ success: true, rules: saved })
}
