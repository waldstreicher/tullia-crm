import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller, canEditCalendar } from '@/lib/caller'

export const dynamic = 'force-dynamic'

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const caller = await getCaller()
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: row } = await db.from('availability_overrides').select('owner_email').eq('id', params.id).single()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!canEditCalendar(caller, String(row.owner_email))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await db.from('availability_overrides').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
