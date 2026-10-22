'use client'

import { useEffect, useState } from 'react'
import Histogram, { HistogramDatum } from './Histogram'
import type { Bucket, Granularity } from '@/lib/timeseries'
import { leadsHref } from '@/lib/lead-filters'

interface TimeseriesResponse {
  granularity: Granularity
  buckets: Bucket[]
  meta: { configured: boolean; currency: string; lastSuccessAt: string | null; error: string | null }
}

const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'Day', week: 'Week', month: 'Month' }
const RANGE_LABEL: Record<Granularity, string> = {
  day: 'Last 30 days',
  week: 'Last 12 weeks',
  month: 'Last 12 months',
}
const LABEL_EVERY: Record<Granularity, number> = { day: 5, week: 2, month: 1 }

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl border border-gray-200 bg-[#FAFAF8] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-[10px] transition ${
            value === o.value ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Card({ title, subtitle, right, children }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A]">{title}</h3>
          {subtitle && <p className="text-xs text-[#6B6B6B] mt-1">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export default function DashboardCharts({ clickable }: { clickable: boolean }) {
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [spendMode, setSpendMode] = useState<'total' | 'perLead'>('total')
  const [data, setData] = useState<TimeseriesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/metrics/timeseries?granularity=${granularity}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [granularity])

  const buckets = data?.buckets ?? []
  const currency = data?.meta.currency || 'USD'
  const money = (v: number, cents = false) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: cents ? 2 : 0,
      minimumFractionDigits: cents ? 2 : 0,
    }).format(v)

  const totalLeads = buckets.reduce((a, b) => a + b.leads, 0)
  const totalWebsite = buckets.reduce((a, b) => a + b.websiteLeads, 0)
  const totalSpend = buckets.reduce((a, b) => a + b.spend, 0)

  const range = (b: Bucket) => ({ from: b.start, to: b.end })

  const leadData: HistogramDatum[] = buckets.map((b) => ({
    key: b.start,
    label: b.label,
    fullLabel: b.fullLabel,
    value: b.leads,
    detail: `${b.websiteLeads} from the website`,
    href: clickable && b.leads > 0 ? leadsHref(range(b)) : undefined,
  }))

  const spendData: HistogramDatum[] = buckets.map((b) => {
    const perLead = b.websiteLeads > 0 ? b.spend / b.websiteLeads : null
    return {
      key: b.start,
      label: b.label,
      fullLabel: b.fullLabel,
      value: spendMode === 'total' ? b.spend : perLead,
      detail:
        spendMode === 'total'
          ? `${b.websiteLeads} website lead${b.websiteLeads === 1 ? '' : 's'}`
          : b.websiteLeads > 0
            ? `${money(b.spend)} ÷ ${b.websiteLeads} website lead${b.websiteLeads === 1 ? '' : 's'}`
            : `${money(b.spend)} spent, no website leads`,
      href: clickable && b.websiteLeads > 0 ? leadsHref({ ...range(b), source: 'website' }) : undefined,
    }
  })

  const fade = loading && data ? 'opacity-50 transition-opacity' : 'transition-opacity'

  return (
    <div className="mb-6">
      {/* One control row scopes both charts */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Segmented
          ariaLabel="Group charts by"
          value={granularity}
          onChange={setGranularity}
          options={(['day', 'week', 'month'] as Granularity[]).map((g) => ({ value: g, label: GRANULARITY_LABEL[g] }))}
        />
        <span className="text-xs text-[#6B6B6B]">{RANGE_LABEL[granularity]} · Eastern time</span>
      </div>

      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${fade}`}>
        <Card
          title={`Leads added per ${granularity}`}
          subtitle={
            data ? (
              <>
                <span className="font-medium text-[#1A1A1A] tabular-nums">{totalLeads}</span> leads ·{' '}
                <span className="tabular-nums">{totalWebsite}</span> from the website
              </>
            ) : (
              ' '
            )
          }
        >
          {!data && loading ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-[#6B6B6B]">Loading…</div>
          ) : (
            <Histogram
              data={leadData}
              format={(v) => String(Math.round(v))}
              labelEvery={LABEL_EVERY[granularity]}
              emptyText="No leads in this period"
              valueName="Leads"
              integer
            />
          )}
        </Card>

        <Card
          title={spendMode === 'total' ? `Meta ad spend per ${granularity}` : `Meta cost per website lead, by ${granularity}`}
          subtitle={
            data?.meta.configured ? (
              <>
                <span className="font-medium text-[#1A1A1A] tabular-nums">{money(totalSpend)}</span> spent ·{' '}
                {totalWebsite > 0 ? (
                  <>
                    <span className="font-medium text-[#1A1A1A] tabular-nums">{money(totalSpend / totalWebsite, true)}</span> per
                    website lead
                  </>
                ) : (
                  'no website leads'
                )}
              </>
            ) : undefined
          }
          right={
            data?.meta.configured ? (
              <Segmented
                ariaLabel="Spend measure"
                value={spendMode}
                onChange={setSpendMode}
                options={[
                  { value: 'total', label: 'Total' },
                  { value: 'perLead', label: 'Per website lead' },
                ]}
              />
            ) : undefined
          }
        >
          {!data && loading ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-[#6B6B6B]">Loading…</div>
          ) : !data?.meta.configured ? (
            <div className="h-[180px] flex flex-col items-center justify-center text-center gap-1 px-6">
              <p className="text-sm font-medium text-[#1A1A1A]">Meta ad spend isn&apos;t connected yet</p>
              <p className="text-xs text-[#6B6B6B]">
                Add META_ACCESS_TOKEN and META_AD_ACCOUNT_ID to the CRM&apos;s Vercel environment variables.
              </p>
            </div>
          ) : (
            <>
              {data.meta.error && (
                <p className="mb-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Couldn&apos;t refresh from Meta: {data.meta.error}
                </p>
              )}
              <Histogram
                data={spendData}
                format={(v) => (spendMode === 'total' ? money(v) : money(v, v > 0 && v < 100))}
                labelEvery={LABEL_EVERY[granularity]}
                emptyText="No ad spend in this period"
                valueName={spendMode === 'total' ? 'Spend' : 'Cost per website lead'}
              />
              {data.meta.lastSuccessAt && (
                <p className="mt-2 text-[11px] text-[#9A9A9A]">
                  Updated from Meta{' '}
                  {new Date(data.meta.lastSuccessAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
