import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { computeMetrics } from '@/lib/metrics'
import { renderDigestEmail, sendEmail } from '@/lib/email'

// Daily digest emailed to Observer accounts. Triggered by Vercel Cron (see
// vercel.json). Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>`
// to cron requests when CRON_SECRET is set — we verify it so the route can't be
// invoked by anyone else. This route is allowlisted in the middleware (no user
// session) precisely because it authenticates via the cron secret instead.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const auth = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: leads, error: leadsErr } = await supabase.from('leads').select('*')
  if (leadsErr) {
    console.error('Digest: failed to load leads', leadsErr)
    return NextResponse.json({ error: 'Failed to load leads' }, { status: 500 })
  }

  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (usersErr) {
    console.error('Digest: failed to list users', usersErr)
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
  }

  const observers = (usersData?.users || []).filter(
    (u) => u.email && u.app_metadata?.role === 'observer'
  )

  const metrics = computeMetrics(leads || [])
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
  const html = renderDigestEmail(metrics, dateStr)

  const results: { email: string; ok: boolean; error?: string }[] = []
  for (const o of observers) {
    const r = await sendEmail({
      to: o.email as string,
      subject: `Tuli CRM — Daily Dashboard (${dateStr})`,
      html,
    })
    results.push({ email: o.email as string, ok: r.ok, error: r.error })
  }

  return NextResponse.json({ observers: observers.length, sent: results.filter((r) => r.ok).length, results })
}
