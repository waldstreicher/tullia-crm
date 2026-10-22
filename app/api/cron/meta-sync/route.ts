import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { metaConfigured, syncMetaSpend } from '@/lib/meta-ads'

// Nightly Meta ad spend sync (Vercel Cron — see vercel.json). The dashboard
// also re-syncs on load when the data is more than a few hours old.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!metaConfigured()) {
    return NextResponse.json({ skipped: 'Meta Ads is not configured' })
  }
  const result = await syncMetaSpend(createServiceClient())
  return NextResponse.json(result, { status: result.ok ? 200 : 502 })
}
