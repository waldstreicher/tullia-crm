import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { findPhoneDuplicates } from '@/lib/duplicates'

export const dynamic = 'force-dynamic'

// Other leads with the same phone number as this one (formatting ignored).
// Staff-only: observers are blocked from /api/leads/* by the middleware.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient()

  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('id', params.id)
    .single()

  if (error || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }

  const matches = await findPhoneDuplicates(supabase, lead.phone, lead.id)
  return NextResponse.json(matches)
}
