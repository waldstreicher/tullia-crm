import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, easternDate } from './dates'

// Meta (Facebook/Instagram) ad spend, pulled from the Marketing API Insights
// endpoint and stored one row per day in `ad_spend_daily`, so the dashboard
// never calls Meta directly on every page load.
//
// Env vars (server-only — never exposed to the browser):
//   META_ACCESS_TOKEN    System-user token with the ads_read permission
//   META_AD_ACCOUNT_ID   Ad account ID (with or without the "act_" prefix)
//   META_APP_SECRET      Optional. Only if the Meta app requires appsecret_proof
//   META_API_VERSION     Optional. Defaults to v26.0

const STATUS_NAME = 'meta_ads'
const BACKFILL_DAYS = 400 // first sync: enough for the 12-month chart
const REFRESH_DAYS = 30 // later syncs: re-pull recent days (Meta revises them)
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000 // dashboard re-syncs if older

export function metaConfigured(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID)
}

interface InsightRow {
  date_start: string
  spend?: string
  account_currency?: string
}

async function fetchDailySpend(since: string, until: string) {
  const token = process.env.META_ACCESS_TOKEN as string
  const rawId = (process.env.META_AD_ACCOUNT_ID as string).trim()
  const account = rawId.startsWith('act_') ? rawId : `act_${rawId}`
  const version = process.env.META_API_VERSION || 'v26.0'

  const params = new URLSearchParams({
    level: 'account',
    fields: 'spend,account_currency',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    limit: '500',
    access_token: token,
  })
  if (process.env.META_APP_SECRET) {
    params.set(
      'appsecret_proof',
      crypto.createHmac('sha256', process.env.META_APP_SECRET).update(token).digest('hex')
    )
  }

  const rows: InsightRow[] = []
  let url: string | null = `https://graph.facebook.com/${version}/${account}/insights?${params}`
  for (let page = 0; url && page < 20; page++) {
    const res: Response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    const body = await res.json().catch(() => null)
    if (!res.ok || !body || body.error) {
      // Meta's error message never contains the token; the URL (which does) is never surfaced.
      throw new Error(body?.error?.message || `Meta API request failed (${res.status})`)
    }
    rows.push(...(body.data || []))
    url = body.paging?.next || null
  }
  return rows
}

export interface MetaSyncResult {
  ok: boolean
  days?: number
  error?: string
}

// Pull spend from Meta and upsert it. Days in the range with no spend come back
// from Meta as missing rows; they are stored as 0 so a revised-to-zero day
// can't keep a stale value.
export async function syncMetaSpend(supabase: SupabaseClient): Promise<MetaSyncResult> {
  if (!metaConfigured()) return { ok: false, error: 'Meta Ads is not configured' }

  const attemptAt = new Date().toISOString()
  await supabase.from('integration_status').upsert({ name: STATUS_NAME, last_attempt_at: attemptAt })

  try {
    const { count } = await supabase
      .from('ad_spend_daily')
      .select('date', { count: 'exact', head: true })
      .eq('platform', 'meta')
    const until = easternDate(new Date())
    const since = addDays(until, -((count ?? 0) > 0 ? REFRESH_DAYS : BACKFILL_DAYS))

    const rows = await fetchDailySpend(since, until)
    const currency = rows.find((r) => r.account_currency)?.account_currency || null
    const byDate = new Map(rows.map((r) => [r.date_start, Number(r.spend || 0)]))

    const upserts: { platform: string; date: string; spend: number; currency: string | null; synced_at: string }[] = []
    for (let d = since; d <= until; d = addDays(d, 1)) {
      upserts.push({ platform: 'meta', date: d, spend: byDate.get(d) ?? 0, currency, synced_at: attemptAt })
    }
    for (let i = 0; i < upserts.length; i += 500) {
      const { error } = await supabase
        .from('ad_spend_daily')
        .upsert(upserts.slice(i, i + 500), { onConflict: 'platform,date' })
      if (error) throw new Error(error.message)
    }

    await supabase
      .from('integration_status')
      .upsert({ name: STATUS_NAME, last_attempt_at: attemptAt, last_success_at: attemptAt, last_error: null })
    return { ok: true, days: upserts.length }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Meta spend sync failed:', message)
    await supabase
      .from('integration_status')
      .upsert({ name: STATUS_NAME, last_attempt_at: attemptAt, last_error: message })
    return { ok: false, error: message }
  }
}

export interface MetaStatus {
  last_attempt_at: string | null
  last_success_at: string | null
  last_error: string | null
}

export async function getMetaStatus(supabase: SupabaseClient): Promise<MetaStatus | null> {
  const { data, error } = await supabase
    .from('integration_status')
    .select('last_attempt_at, last_success_at, last_error')
    .eq('name', STATUS_NAME)
    .maybeSingle()
  if (error) return null
  return (data as MetaStatus | null) ?? { last_attempt_at: null, last_success_at: null, last_error: null }
}
