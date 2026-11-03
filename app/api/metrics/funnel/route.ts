import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase'
import { computeFunnel, FunnelAppointment, FunnelLead, StageChange } from '@/lib/funnel'

export const dynamic = 'force-dynamic'

// Consult → treatment funnel for the dashboard. PII-free (counts only), so it
// is available to observers as well as users (see the middleware).
// ?range=all | 90 | 30 — limits to consult requests made in the last N days.

// PostgREST returns at most 1,000 rows per request, so page through.
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

export async function GET(request: Request) {
  const r = new URL(request.url).searchParams.get('range')
  const days = r === '30' ? 30 : r === '90' ? 90 : null
  const supabase: SupabaseClient = createServiceClient()

  try {
    const leads = await fetchAll<FunnelLead>((from, to) => {
      let q = supabase
        .from('leads')
        .select(
          'id, created_at, stage, eligibility_status, contact_attempts, virtual_consult_scheduled_at, virtual_consult_completed_at, procedure_scheduled_date, procedure_completed_at'
        )
        .order('created_at', { ascending: true })
        .range(from, to)
      if (days) q = q.gte('created_at', new Date(Date.now() - days * 86_400_000).toISOString())
      return q
    })

    // Only stage-change notes ("Stage changed from … to …"): no free-text notes are read.
    const changes = await fetchAll<StageChange>((from, to) =>
      supabase
        .from('lead_notes')
        .select('lead_id, note')
        .eq('type', 'status_change')
        .order('created_at', { ascending: true })
        .range(from, to)
    )

    let appointments: FunnelAppointment[] = []
    try {
      appointments = await fetchAll<FunnelAppointment>((from, to) =>
        supabase.from('appointments').select('lead_id, status').range(from, to)
      )
    } catch {
      appointments = [] // scheduling tables not set up
    }

    return NextResponse.json({ range: days ?? 'all', ...computeFunnel(leads, changes, appointments) })
  } catch (err) {
    console.error('Funnel metrics failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Could not load the funnel' }, { status: 500 })
  }
}
