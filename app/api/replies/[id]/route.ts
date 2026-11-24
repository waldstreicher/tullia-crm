import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'

export const dynamic = 'force-dynamic'

// PATCH { handled: boolean } → move a reply between New and Handled.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { handled?: boolean }
  if (typeof body.handled !== 'boolean') return NextResponse.json({ error: 'handled must be true or false' }, { status: 400 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('email_replies')
    .update(body.handled ? { handled_at: new Date().toISOString(), handled_by: caller.name } : { handled_at: null, handled_by: null })
    .eq('id', params.id)
    .select('id, handled_at, handled_by')
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
