import { addDays, addMonths, easternDate, formatYmd, startOfMonth, startOfWeek } from './dates'

// Dashboard histograms: leads added and Meta ad spend per day / week / month
// (Eastern calendar). PII-free — only counts and dollar totals.

export type Granularity = 'day' | 'week' | 'month'

export const BUCKET_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 12 }

export interface Bucket {
  start: string // first Eastern date in the bucket (YYYY-MM-DD)
  end: string // last Eastern date in the bucket (inclusive)
  label: string // short axis label
  fullLabel: string // tooltip / table label
  leads: number
  websiteLeads: number
  spend: number
}

export function buildBuckets(granularity: Granularity, now: Date = new Date()): Bucket[] {
  const today = easternDate(now)
  const n = BUCKET_COUNT[granularity]
  const out: Bucket[] = []
  for (let i = n - 1; i >= 0; i--) {
    let start: string
    let end: string
    let label: string
    let fullLabel: string
    if (granularity === 'day') {
      start = end = addDays(today, -i)
      label = formatYmd(start, { month: 'short', day: 'numeric' })
      fullLabel = formatYmd(start, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    } else if (granularity === 'week') {
      start = addDays(startOfWeek(today), -7 * i)
      end = addDays(start, 6)
      label = formatYmd(start, { month: 'short', day: 'numeric' })
      fullLabel = `Week of ${formatYmd(start, { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else {
      start = addMonths(startOfMonth(today), -i)
      end = addDays(addMonths(start, 1), -1)
      label = formatYmd(start, { month: 'short' })
      fullLabel = formatYmd(start, { month: 'long', year: 'numeric' })
    }
    // The current period is partial: it ends today, not in the future.
    if (end > today) end = today
    out.push({ start, end, label, fullLabel, leads: 0, websiteLeads: 0, spend: 0 })
  }
  return out
}

function bucketIndex(buckets: Bucket[], ymd: string): number {
  // Buckets are contiguous and ascending; a linear scan is plenty for ≤ 30.
  for (let i = 0; i < buckets.length; i++) {
    if (ymd >= buckets[i].start && ymd <= buckets[i].end) return i
  }
  return -1
}

export function fillBuckets(
  buckets: Bucket[],
  leads: { created_at: string; source?: string | null }[],
  spend: { date: string; spend: number | string }[]
): Bucket[] {
  for (const l of leads) {
    const i = bucketIndex(buckets, easternDate(l.created_at))
    if (i < 0) continue
    buckets[i].leads += 1
    if ((l.source || '') === 'website') buckets[i].websiteLeads += 1
  }
  for (const s of spend) {
    const i = bucketIndex(buckets, s.date)
    if (i >= 0) buckets[i].spend += Number(s.spend) || 0
  }
  for (const b of buckets) b.spend = Math.round(b.spend * 100) / 100
  return buckets
}
