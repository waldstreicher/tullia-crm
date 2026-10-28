import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase'
import { getCorsHeaders, corsPreflight } from '@/lib/cors'
import {
  generateReply,
  isConfigured,
  CHAT_MODEL,
  MAX_USER_CHARS,
  MAX_SESSION_MESSAGES,
  MAX_HISTORY_MESSAGES,
  UNAVAILABLE_REPLY,
} from '@/lib/chatbot'

// Public: the website's chat widget posts here. Anonymous — no identity is
// collected. Every message (both sides) is stored for staff review.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Abuse limits. Per-IP and global caps are enforced from the DB so they hold
// across serverless instances.
const MAX_SESSIONS_PER_IP_PER_DAY = 20
const DAILY_MESSAGE_CAP = Number(process.env.CHAT_DAILY_MESSAGE_CAP || 2000)

function ipHash(request: Request): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  const salt = process.env.CHAT_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'salt'
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

function startOfTodayUtc(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function OPTIONS(request: Request) {
  return corsPreflight(request)
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request.headers.get('origin'))
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: corsHeaders })

  if (!isConfigured()) {
    return json({ error: 'Assistant is not configured', reply: UNAVAILABLE_REPLY }, 503)
  }

  let body: { session_id?: string; message?: string; page?: string }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid request' }, 400)
  }

  const message = (body.message || '').toString().trim()
  if (!message) return json({ error: 'message is required' }, 400)
  if (message.length > MAX_USER_CHARS) {
    return json({ error: `Please keep messages under ${MAX_USER_CHARS} characters` }, 400)
  }

  const db = createServiceClient()
  const hash = ipHash(request)
  const today = startOfTodayUtc()

  // Global daily cap (cost guard).
  const { count: todayCount } = await db
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .gte('created_at', today)
  if ((todayCount ?? 0) >= DAILY_MESSAGE_CAP) {
    return json({ error: 'busy', reply: UNAVAILABLE_REPLY }, 429)
  }

  // Find or create the session.
  let sessionId = body.session_id || null
  let messageCount = 0
  if (sessionId) {
    const { data: s } = await db
      .from('chat_sessions')
      .select('id, message_count')
      .eq('id', sessionId)
      .single()
    if (!s) sessionId = null
    else messageCount = s.message_count
  }
  if (!sessionId) {
    const { count: ipSessions } = await db
      .from('chat_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', hash)
      .gte('created_at', today)
    if ((ipSessions ?? 0) >= MAX_SESSIONS_PER_IP_PER_DAY) {
      return json({ error: 'limit', reply: UNAVAILABLE_REPLY }, 429)
    }
    const { data: created, error } = await db
      .from('chat_sessions')
      .insert({
        page: (body.page || '').toString().slice(0, 200) || null,
        ip_hash: hash,
        user_agent: (request.headers.get('user-agent') || '').slice(0, 300) || null,
      })
      .select('id')
      .single()
    if (error || !created) return json({ error: 'Could not start chat' }, 500)
    sessionId = created.id as string
  }
  if (messageCount >= MAX_SESSION_MESSAGES) {
    return json(
      { session_id: sessionId, reply: 'This conversation has reached its limit. For anything else, please call (201) 225-1101 or request a consultation.', ended: true },
      200
    )
  }

  // Store the visitor's message, then build the replayed history.
  await db.from('chat_messages').insert({ session_id: sessionId, role: 'user', content: message })
  const { data: rows } = await db
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES)
  const history = (rows || [])
    .reverse()
    .map((r: { role: 'user' | 'assistant'; content: string }) => ({ role: r.role, content: r.content }))
  // The API requires the first message to be from the user.
  while (history.length && history[0].role !== 'user') history.shift()

  let reply
  try {
    reply = await generateReply(history)
  } catch (err) {
    console.error('chat generateReply failed:', err)
    await db.from('chat_messages').insert({
      session_id: sessionId,
      role: 'assistant',
      content: UNAVAILABLE_REPLY,
      model: CHAT_MODEL,
      stop_reason: 'error',
    })
    await db
      .from('chat_sessions')
      .update({ last_message_at: new Date().toISOString(), message_count: messageCount + 2 })
      .eq('id', sessionId)
    return json({ session_id: sessionId, reply: UNAVAILABLE_REPLY }, 200)
  }

  await db.from('chat_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: reply.text,
    model: reply.model,
    input_tokens: reply.inputTokens,
    cache_read_tokens: reply.cacheReadTokens,
    output_tokens: reply.outputTokens,
    stop_reason: reply.stopReason,
    latency_ms: reply.latencyMs,
  })
  await db
    .from('chat_sessions')
    .update({ last_message_at: new Date().toISOString(), message_count: messageCount + 2 })
    .eq('id', sessionId)

  return json({ session_id: sessionId, reply: reply.text })
}
