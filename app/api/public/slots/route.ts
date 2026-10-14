import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCorsHeaders, corsPreflight } from '@/lib/cors'
import { getOpenSlots } from '@/lib/appointments'
import { groupSlotsByDay, TZ, SLOT_MINUTES, MIN_DAYS_AHEAD, MAX_DAYS_AHEAD } from '@/lib/scheduling'

// Public: the open follow-up call slots shown on the website's /schedule page.
// Contains no lead or patient data, so no token is required.
export const dynamic = 'force-dynamic'

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function GET(request: Request) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))
  try {
    const slots = await getOpenSlots(createServiceClient())
    return NextResponse.json(
      {
        timezone: TZ,
        slot_minutes: SLOT_MINUTES,
        min_days_ahead: MIN_DAYS_AHEAD,
        max_days_ahead: MAX_DAYS_AHEAD,
        days: groupSlotsByDay(slots),
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('slots error:', err)
    return NextResponse.json({ error: 'Could not load availability' }, { status: 500, headers: corsHeaders })
  }
}
