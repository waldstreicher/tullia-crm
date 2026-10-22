'use client'

import { useState } from 'react'
import Link from 'next/link'

// Single-series column chart (histogram over time). Thin 24px-max columns with
// 4px rounded tops on one baseline, hairline gridlines, a hover/focus tooltip
// per column (the whole column is the hit target), optional click-through, and
// a table view so no value is hover-only.

export interface HistogramDatum {
  key: string
  label: string // axis label
  fullLabel: string // tooltip / table label
  value: number | null // null = no value for this period (e.g. no leads to divide by)
  detail?: string // secondary tooltip line
  href?: string
}

// Darker step of the brand gold so columns clear 3:1 against the white card.
const BAR = '#A8794C'
const BAR_HOVER = '#8F6640'

// Rounded axis top. Integer charts use steps whose half is also a whole number,
// so the midline tick never reads as a fraction (or rounds to a duplicate).
function niceMax(max: number, integer: boolean): number {
  if (integer) {
    if (max <= 2) return 2
    const exp = Math.pow(10, Math.floor(Math.log10(max)))
    for (const m of [2, 4, 6, 10]) if (m * exp >= max) return m * exp
    return 20 * exp
  }
  if (max <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(max)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= max) return m * exp
  return 10 * exp
}

export default function Histogram({
  data,
  format,
  height = 180,
  labelEvery = 1,
  emptyText = 'No data for this period',
  valueName,
  integer = false,
}: {
  data: HistogramDatum[]
  format: (v: number) => string
  height?: number
  labelEvery?: number
  emptyText?: string
  valueName: string // column header in the table view
  integer?: boolean // whole-number values (counts)
}) {
  const [active, setActive] = useState<number | null>(null)
  const values = data.map((d) => d.value ?? 0)
  const max = niceMax(Math.max(0, ...values), integer)
  const ticks = [0, 0.5, 1].map((t) => t * max)
  const allEmpty = values.every((v) => v === 0)

  return (
    <div>
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="relative shrink-0 w-12 text-right" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2 text-[11px] text-[#9A9A9A] tabular-nums"
              style={{ top: `${(1 - t / max) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="relative flex-1 min-w-0" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: `${(1 - t / max) * 100}%` }}
            />
          ))}

          {allEmpty && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B6B6B]">
              {emptyText}
            </div>
          )}

          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const v = d.value ?? 0
              const pct = (v / max) * 100
              const isActive = active === i
              const bar = (
                <div className="relative h-full w-full flex items-end justify-center">
                  {v > 0 && (
                    <div
                      className="w-full rounded-t-[4px] transition-colors"
                      style={{
                        maxWidth: 24,
                        height: `${Math.max(pct, 1.5)}%`,
                        background: isActive ? BAR_HOVER : BAR,
                      }}
                    />
                  )}
                </div>
              )
              const common = {
                className: `relative flex-1 h-full outline-none rounded-sm ${
                  d.href ? 'cursor-pointer' : ''
                } ${isActive ? 'bg-[#C4956A]/5' : ''} focus-visible:ring-2 focus-visible:ring-[#C4956A]/50`,
                onPointerEnter: () => setActive(i),
                onPointerLeave: () => setActive(null),
                onFocus: () => setActive(i),
                onBlur: () => setActive(null),
                'aria-label': `${d.fullLabel}: ${d.value === null ? 'no value' : format(d.value)}`,
              }
              return d.href ? (
                <Link key={d.key} href={d.href} {...common}>
                  {bar}
                </Link>
              ) : (
                <div key={d.key} tabIndex={0} {...common}>
                  {bar}
                </div>
              )
            })}
          </div>

          {/* Tooltip */}
          {active !== null && data[active] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-[#1A1A1A] px-3 py-2 text-white shadow-lg whitespace-nowrap"
              style={{
                left: `${Math.min(Math.max(((active + 0.5) / data.length) * 100, 12), 88)}%`,
                top: 0,
              }}
            >
              <p className="text-sm font-semibold tabular-nums">
                {data[active].value === null ? '—' : format(data[active].value as number)}
              </p>
              <p className="text-[11px] text-gray-300">{data[active].fullLabel}</p>
              {data[active].detail && <p className="text-[11px] text-gray-300">{data[active].detail}</p>}
              {data[active].href && <p className="text-[11px] text-[#E2C4A5] mt-0.5">Click to see these leads</p>}
            </div>
          )}
        </div>
      </div>

      {/* X axis */}
      <div className="flex gap-2 mt-1.5">
        <div className="w-12 shrink-0" />
        <div className="flex-1 min-w-0 flex gap-[2px] h-4">
          {data.map((d, i) => (
            <span key={d.key} className="relative flex-1 min-w-0">
              {(data.length - 1 - i) % labelEvery === 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 text-[11px] text-[#9A9A9A] whitespace-nowrap">
                  {d.label}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Table view */}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs text-[#6B6B6B] hover:text-[#1A1A1A] select-none">View as table</summary>
        <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-gray-100">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[#6B6B6B]">
              <tr>
                <th className="text-left px-3 py-1.5 font-medium">Period</th>
                <th className="text-right px-3 py-1.5 font-medium">{valueName}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.key} className="border-t border-gray-50">
                  <td className="px-3 py-1.5 text-[#1A1A1A]">{d.fullLabel}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-[#1A1A1A]">
                    {d.value === null ? '—' : format(d.value)}
                    {d.detail && <span className="ml-2 text-[#6B6B6B]">({d.detail})</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
