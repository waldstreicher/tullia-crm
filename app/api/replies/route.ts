import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'

// Staff: replies prospects sent to the automated emails, newest first.
// ?view=new (default) | handled. Observers are blocked by the middleware.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const p = new URL(request.url).searchParams
  const db = createServiceClient()
  let q = db
    .from('email_replies')
    .select('id, received_at, from_email, from_name, subject, text_body, lead_id, handled_at, handled_by, attachment_count, leads(first_name, last_name)')
    .order('received_at', { ascending: false })
    .limit(Math.min(Number(p.get('limit') || 200), 500))
  q = p.get('view') === 'handled' ? q.not('handled_at', 'is', null) : q.is('handled_at', null)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
