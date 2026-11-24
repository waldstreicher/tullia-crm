import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { handleInboundEvent, verifyWebhook } from '@/lib/inbound-email'

// Resend posts `email.received` here when a prospect replies to an automated
// email (consults@tumescentlipolysis.com). Public path; authenticated by the
// webhook signature. Returning non-2xx makes Resend retry.
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET is not set' }, { status: 503 })

  const raw = await request.text() // raw body: re-serialized JSON would break the signature
  const ok = verifyWebhook(
    raw,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    secret
  )
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  let event: Parameters<typeof handleInboundEvent>[1]
  try {
    event = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = await handleInboundEvent(createServiceClient(), event)
  if (!result.ok) {
    console.error('inbound email failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ status: result.status })
}
