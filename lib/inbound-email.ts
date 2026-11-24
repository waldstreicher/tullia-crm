import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderReplyNotice, sendEmail } from './email'

// Replies to the automated prospect emails. Resend receives mail for
// consults@tumescentlipolysis.com, posts an `email.received` webhook (metadata
// only), and we fetch the full message from the Resend API, store it in
// email_replies, note it on the matching lead, and send staff a PII-free notice.

type Db = SupabaseClient

const CRM_BASE_URL = (process.env.CRM_BASE_URL || 'https://tullia-crm.vercel.app').replace(/\/$/, '')

// Who is told that a prospect replied. Comma-separated; addresses only.
export const REPLY_NOTIFY_TO = (process.env.REPLY_NOTIFY_EMAIL || 'Janet Franceschi <jfranceschi@affordableplasticsurgery.com>')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// ─── Webhook signature (Resend signs webhooks with Svix) ────────────────────
// Signed content is `${svix-id}.${svix-timestamp}.${rawBody}`, HMAC-SHA256 with
// the base64 secret after the `whsec_` prefix; the header carries one or more
// space-separated `v1,<base64>` signatures.
export function verifyWebhook(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now: Date = new Date()
): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature || !secret) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > 5 * 60) return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest()
  return signature.split(' ').some((part) => {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) return false
    const given = Buffer.from(sig, 'base64')
    return given.length === expected.length && crypto.timingSafeEqual(given, expected)
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────
export function parseAddress(raw: string | null | undefined): { email: string; name: string | null } {
  const s = (raw || '').trim()
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  if (m) return { email: m[2].trim().toLowerCase(), name: m[1].trim() || null }
  return { email: s.toLowerCase(), name: null }
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

interface ReceivedEmail {
  id: string
  from?: string
  to?: string[]
  subject?: string
  text?: string | null
  html?: string | null
  headers?: Record<string, string>
  attachments?: unknown[]
}

async function fetchReceivedEmail(id: string): Promise<{ ok: true; email: ReceivedEmail } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' }
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
  return { ok: true, email: (await res.json()) as ReceivedEmail }
}

// ─── Handler ────────────────────────────────────────────────────────────────
export type InboundResult =
  | { ok: true; status: 'stored' | 'duplicate' | 'ignored'; replyId?: string }
  | { ok: false; status: number; error: string }

export async function handleInboundEvent(db: Db, event: { type?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } }): Promise<InboundResult> {
  if (event.type !== 'email.received') return { ok: true, status: 'ignored' }
  const emailId = event.data?.email_id
  if (!emailId) return { ok: false, status: 400, error: 'missing email_id' }

  // Retries: already stored → acknowledge without repeating the notice.
  const { data: existing } = await db.from('email_replies').select('id').eq('resend_email_id', emailId).maybeSingle()
  if (existing) return { ok: true, status: 'duplicate', replyId: (existing as { id: string }).id }

  const fetched = await fetchReceivedEmail(emailId)
  if (!fetched.ok) return { ok: false, status: 502, error: fetched.error } // Resend retries the webhook
  const em = fetched.email

  const sender = parseAddress(em.headers?.from || em.from || event.data?.from)
  const html = em.html || null
  const text = em.text || (html ? htmlToText(html) : null)

  // Match the sender to the most recent lead with that email (case-insensitive,
  // LIKE wildcards escaped so "a_b@x.com" can't match "axb@x.com").
  const pattern = sender.email.replace(/[\\%_]/g, (c) => `\\${c}`)
  const { data: leads } = await db
    .from('leads')
    .select('id')
    .ilike('email', pattern)
    .order('created_at', { ascending: false })
    .limit(1)
  const leadId = (leads?.[0] as { id: string } | undefined)?.id ?? null

  const { data: inserted, error } = await db
    .from('email_replies')
    .insert({
      resend_email_id: emailId,
      from_email: sender.email,
      from_name: sender.name,
      to_emails: em.to || event.data?.to || [],
      subject: em.subject ?? event.data?.subject ?? null,
      text_body: text,
      html_body: html,
      attachment_count: Array.isArray(em.attachments) ? em.attachments.length : 0,
      lead_id: leadId,
    })
    .select('id')
    .single()
  if (error || !inserted) {
    if (error?.code === '23505') return { ok: true, status: 'duplicate' }
    return { ok: false, status: 500, error: error?.message || 'insert failed' }
  }
  const replyId = (inserted as { id: string }).id

  if (leadId) {
    await db.from('lead_notes').insert({
      lead_id: leadId,
      author: 'System',
      type: 'email',
      note: `Prospect replied to an automated email${em.subject ? ` ("${em.subject}")` : ''}. Read it under Replies.`,
    })
  }

  // PII-free heads-up to staff: no name, address or message text — just a link.
  const notice = await sendEmail({
    to: REPLY_NOTIFY_TO,
    subject: 'A prospect replied to an automated TuLi email',
    html: renderReplyNotice({ replyUrl: `${CRM_BASE_URL}/replies?id=${replyId}`, matchedLead: !!leadId }),
  })
  if (!notice.ok) console.error('reply notice failed:', notice.error)

  return { ok: true, status: 'stored', replyId }
}
