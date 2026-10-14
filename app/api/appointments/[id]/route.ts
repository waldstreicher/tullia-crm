import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'
import { cancelAppointment, setAppointmentOutcome } from '@/lib/appointments'

// Staff: change an appointment's status.
// PATCH { status: 'cancelled' | 'completed' | 'no_show', reason? }
export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { status?: string; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const db = createServiceClient()
  const result =
    body.status === 'cancelled'
      ? await cancelAppointment(db, params.id, { reason: body.reason, author: caller.name })
      : body.status === 'completed' || body.status === 'no_show'
        ? await setAppointmentOutcome(db, params.id, body.status, caller.name)
        : null

  if (!result) {
    return NextResponse.json({ error: 'status must be cancelled, completed, or no_show' }, { status: 400 })
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ success: true, appointment: result.appointment })
}
