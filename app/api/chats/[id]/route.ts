import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'

// Admin: one conversation's transcript, and flagging an answer as inaccurate.
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const caller = await getCaller()
  if (!caller?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data: session } = await db.from('chat_sessions').select('*').eq('id', params.id).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: messages } = await db
    .from('chat_messages')
    .select('*')
    .eq('session_id', params.id)
    .order('created_at', { ascending: true })
  return NextResponse.json({ session, messages: messages || [] })
}

// PATCH { message_id, flagged: boolean, flag_note?: string }  → flag/unflag one answer
// PATCH { reviewed: true }                                   → mark the session reviewed
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const caller = await getCaller()
  if (!caller?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { message_id?: string; flagged?: boolean; flag_note?: string; reviewed?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const db = createServiceClient()
  const now = new Date().toISOString()

  if (body.reviewed) {
    const { error } = await db
      .from('chat_sessions')
      .update({ reviewed_at: now, reviewed_by: caller.name })
      .eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (!body.message_id || typeof body.flagged !== 'boolean') {
    return NextResponse.json({ error: 'message_id and flagged are required' }, { status: 400 })
  }
  const { error } = await db
    .from('chat_messages')
    .update(
      body.flagged
        ? { flagged: true, flag_note: body.flag_note?.trim() || null, flagged_by: caller.name, flagged_at: now }
        : { flagged: false, flag_note: null, flagged_by: null, flagged_at: null }
    )
    .eq('id', body.message_id)
    .eq('session_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep the session-level flag in sync so the list can filter on it.
  const { count } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', params.id)
    .eq('flagged', true)
  await db.from('chat_sessions').update({ flagged: (count ?? 0) > 0 }).eq('id', params.id)

  return NextResponse.json({ success: true })
}
