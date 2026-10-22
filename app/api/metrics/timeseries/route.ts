import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { addDays } from '@/lib/dates'
import { buildBuckets, fillBuckets, Granularity } from '@/lib/timeseries'
import { getMetaStatus, metaConfigured, STALE_AFTER_MS, syncMetaSpend } from '@/lib/meta-ads'

export const dynamic = 'force-dynamic'

// Histogram data for the dashboard: leads added and Meta ad spend per
// day / week / month. PII-free (counts and dollar totals only), so it is
// available to observers as well as users (see the middleware).
export async function GET(request: Request) {
  const g = new URL(request.url).searchParams.get('granularity')
  const granularity: Granularity = g === 'week' || g === 'month' ? g : 'day'

  const supabase = createServiceClient()
  const buckets = buildBuckets(granularity)
  const from = buckets[0].start
  const to = buckets[buckets.length - 1].end

  // Keep spend reasonably fresh without a frequent cron (Vercel Hobby only
  // allows daily cron jobs): re-sync from Meta when the last attempt is stale.
  let status = metaConfigured() ? await getMetaStatus(supabase) : null
  if (metaConfigured() && status) {
    const last = status.last_attempt_at ? new Date(status.last_attempt_at).getTime() : 0
    if (Date.now() - last > STALE_AFTER_MS) {
      await syncMetaSpend(supabase)
      status = await getMetaStatus(supabase)
    }
  }

  // Only the two columns the histogram needs — no patient details.
  // The lower bound is padded by a day (UTC vs Eastern); bucketing drops extras.
  const { data: leads, error: leadsErr } = await supabase
    .from('leads')
    .select('created_at, source')
    .gte('created_at', `${addDays(from, -1)}T00:00:00Z`)
  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 })
  }

  let spendRows: { date: string; spend: number }[] = []
  let spendError: string | null = null
  let currency: string | null = null
  if (metaConfigured()) {
    const { data, error } = await supabase
      .from('ad_spend_daily')
      .select('date, spend, currency')
      .eq('platform', 'meta')
      .gte('date', from)
      .lte('date', to)
    if (error) {
      spendError = /ad_spend_daily/.test(error.message)
        ? 'The ad spend table has not been created yet (run the Meta ad spend SQL in Supabase).'
        : error.message
    } else {
      spendRows = data || []
      currency = (data || []).find((r) => r.currency)?.currency ?? null
    }
  }

  fillBuckets(buckets, leads || [], spendRows)

  return NextResponse.json({
    granularity,
    buckets,
    meta: {
      configured: metaConfigured(),
      currency: currency || 'USD',
      lastSuccessAt: status?.last_success_at ?? null,
      error: spendError || status?.last_error || null,
    },
  })
}
