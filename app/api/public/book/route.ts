import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCorsHeaders, corsPreflight } from '@/lib/cors'
import { verifyBookingToken } from '@/lib/booking-token'
import { bookAppointment, getActiveAppointment } from '@/lib/appointments'
import { formatFullEt } from '@/lib/scheduling'

// Public: book (POST) or look up (GET) the follow-up call for the lead named
// by a signed booking token issued at intake.
export const dynamic = 'force-dynamic'

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

// GET ?token=… → { first_name, appointment | null } so a returning visitor sees
// their existing booking instead of being offered the slots again.
export async function GET(request: Request) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))
  const token = new URL(request.url).searchParams.get('token')
  const leadId = verifyBookingToken(token)
  if (!leadId) {
    return NextResponse.json({ error: 'Invalid booking link' }, { status: 401, headers: corsHeaders })
  }

  const db = createServiceClient()
  const { data: lead } = await db.from('leads').select('first_name').eq('id', leadId).single()
  if (!lead) {
    return NextResponse.json({ error: 'Invalid booking link' }, { status: 404, headers: corsHeaders })
  }
  const appt = await getActiveAppointment(db, leadId)
  return NextResponse.json(
    {
      first_name: lead.first_name,
      appointment: appt
        ? { id: appt.id, starts_at: appt.starts_at, ends_at: appt.ends_at, when_label: formatFullEt(new Date(appt.starts_at)) }
        : null,
    },
    { headers: corsHeaders }
  )
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))

  let body: { token?: string; starts_at?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: corsHeaders })
  }

  const leadId = verifyBookingToken(body.token)
  if (!leadId) {
    return NextResponse.json({ error: 'Invalid booking link' }, { status: 401, headers: corsHeaders })
  }
  if (!body.starts_at) {
    return NextResponse.json({ error: 'starts_at is required' }, { status: 400, headers: corsHeaders })
  }

  const result = await bookAppointment(createServiceClient(), {
    leadId,
    startsAt: new Date(body.starts_at),
    via: 'website',
    requireOpenSlot: true,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: result.code,
        ...(result.existing
          ? {
              existing: {
                starts_at: result.existing.starts_at,
                when_label: formatFullEt(new Date(result.existing.starts_at)),
              },
            }
          : {}),
      },
      { status: result.status, headers: corsHeaders }
    )
  }

  const a = result.appointment
  return NextResponse.json(
    {
      success: true,
      appointment: { id: a.id, starts_at: a.starts_at, ends_at: a.ends_at, when_label: result.whenLabel },
      confirmation_email_sent: !!a.confirmation_sent_at,
    },
    { status: 201, headers: corsHeaders }
  )
}
