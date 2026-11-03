'use client'

import { useEffect, useState } from 'react'
import type { FunnelResult } from '@/lib/funnel'

// Consult → treatment funnel (counts only). Centered bars to scale against
// consult requests, with the drop between steps called out.

type Range = 'all' | '90' | '30'
const RANGES: { value: Range; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '90', label: 'Last 90 days' },
  { value: '30', label: 'Last 30 days' },
]
const BAR = '#A8794C'

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)

export default function FunnelChart() {
  const [range, setRange] = useState<Range>('all')
  const [data, setData] = useState<FunnelResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/metrics/funnel?range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setError(false)
        }
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [range])

  const total = data?.steps[0]?.count ?? 0
  const pastCalls = data ? data.calls.completed + data.calls.noShow : 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A1A]">Consult funnel</h3>
          <p className="text-xs text-[#6B6B6B] mt-1">
            Patients who reached each step at any point
            {range === 'all' ? '' : `, among requests from the ${range === '90' ? 'last 90 days' : 'last 30 days'}`}
          </p>
        </div>
        <div role="radiogroup" aria-label="Requests made in" className="inline-flex rounded-xl border border-gray-200 bg-[#FAFAF8] p-0.5">
          {RANGES.map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={range === o.value}
              onClick={() => setRange(o.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-[10px] transition ${
                range === o.value ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600 py-8 text-center">Couldn&apos;t load the funnel. Refresh to try again.</p>
      ) : !data ? (
        <div className="h-[320px] flex items-center justify-center text-sm text-[#6B6B6B]">Loading…</div>
      ) : total === 0 ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-[#6B6B6B]">No consult requests in this period</div>
      ) : (
        <div className={loading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          <ol className="space-y-0.5">
            {data.steps.map((s, i) => {
              const prev = i > 0 ? data.steps[i - 1].count : null
              const lost = prev !== null ? prev - s.count : 0
              return (
                <li key={s.key}>
                  {prev !== null && prev > 0 && (
                    <div
                      className={`text-center text-[11px] py-0.5 ${
                        lost / prev >= 0.3 && lost >= 5 ? 'text-red-600 font-medium' : 'text-[#9A9A9A]'
                      }`}
                    >
                      {lost > 0 ? `−${lost} · ${pct(s.count, prev)}% continue` : 'all continue'}
                    </div>
                  )}
                  <div className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_5.5rem] items-center gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1A1A1A] leading-tight">{s.label}</p>
                      {s.note && <p className="text-[11px] text-[#9A9A9A] leading-tight">{s.note}</p>}
                    </div>
                    <div className="flex justify-center h-7" title={`${s.label}: ${s.count} (${pct(s.count, total)}% of requests)`}>
                      {s.count > 0 ? (
                        <div className="h-full rounded" style={{ width: `${(s.count / total) * 100}%`, minWidth: 3, background: BAR }} />
                      ) : (
                        <div className="h-full w-10 rounded border border-dashed border-gray-300" />
                      )}
                    </div>
                    <div className="text-right tabular-nums leading-tight">
                      <p className="text-base font-semibold text-[#1A1A1A]">{s.count}</p>
                      <p className="text-[11px] text-[#6B6B6B]">{pct(s.count, total)}%</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#6B6B6B]">
            <span>
              Ineligible: <b className="text-[#1A1A1A] tabular-nums">{data.ineligible}</b>
            </span>
            <span>
              Eligible on decisions made:{' '}
              <b className="text-[#1A1A1A] tabular-nums">
                {data.decided ? `${pct(data.steps[4].count, data.decided)}%` : '—'}
              </b>{' '}
              ({data.steps[4].count} of {data.decided})
            </span>
            <span>
              Follow-up call show rate:{' '}
              <b className="text-[#1A1A1A] tabular-nums">{pastCalls ? `${pct(data.calls.completed, pastCalls)}%` : '—'}</b>{' '}
              ({data.calls.completed} of {pastCalls} past calls; {data.calls.noShow} no-shows)
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
