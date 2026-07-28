import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { computeMetrics } from '@/lib/metrics'

// Always compute fresh per request — never cached/prerendered at build time.
export const dynamic = 'force-dynamic'

// PII-free aggregate metrics for the dashboard. Available to any signed-in
// account (users and observers); the middleware enforces authentication.
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('leads').select('*')

  if (error) {
    console.error('Error computing metrics:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(computeMetrics(data || []))
}
