import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCaller } from '@/lib/caller'

// Admin: list chatbot conversations (newest first) with a preview of the
// visitor's first message. Gated to admins by the middleware and re-checked here.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const caller = await getCaller()
  if (!caller?.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const p = new URL(request.url).searchParams
  const limit = Math.min(Number(p.get('limit') || 100), 500)
  const db = createServiceClient()

  let q = db
    .from('chat_sessions')
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit)
  // Active (default) and archived are separate views.
  if (p.get('view') === 'archived') q = q.not('archived_at', 'is', null)
  else q = q.is('archived_at', null)
  if (p.get('flagged') === '1') q = q.eq('flagged', true)
  const { data: sessions, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (sessions || []).map((s: { id: string }) => s.id)
  const previews: Record<string, string> = {}
  if (ids.length) {
    const { data: msgs } = await db
      .from('chat_messages')
      .select('session_id, content, created_at')
      .in('session_id', ids)
      .eq('role', 'user')
      .order('created_at', { ascending: true })
    for (const m of msgs || []) {
      if (!previews[m.session_id]) previews[m.session_id] = String(m.content).slice(0, 140)
    }
  }

  return NextResponse.json(
    (sessions || []).map((s: Record<string, unknown>) => ({ ...s, preview: previews[s.id as string] || '' }))
  )
}
