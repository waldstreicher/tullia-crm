'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  UserPlus,
  CalendarClock,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Video,
  UserX,
} from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import LeadTable from '@/components/LeadTable'
import DashboardCharts from '@/components/DashboardCharts'
import { leadsHref } from '@/lib/lead-filters'
import { createClient } from '@/lib/supabase-browser'
import { getRole } from '@/lib/roles'
import { STAGE_ORDER, STAGE_CONFIG, Priority, EligibilityStatus } from '@/lib/types'
import type { DashboardMetrics } from '@/lib/metrics'

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  href,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
  href?: string
}) {
  const body = (
    <>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-semibold text-[#1A1A1A] tabular-nums">{value}</p>
        <p className="text-sm text-[#6B6B6B] mt-0.5">{label}</p>
      </div>
    </>
  )
  const base = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4'
  // Clickable for users (opens the matching leads); plain for observers.
  return href ? (
    <Link
      href={href}
      className={`${base} transition hover:border-[#C4956A]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4956A]/50`}
    >
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  )
}

// ─── Breakdown row (label + proportional bar + count) ─────────────────────────
function BreakdownRow({
  label,
  count,
  total,
  barColor,
  labelNode,
  labelWidth = 'w-36',
  href,
}: {
  label: string
  count: number
  total: number
  barColor: string
  labelNode?: React.ReactNode
  labelWidth?: string
  href?: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  const content = (
    <>
      <div className={`${labelWidth} shrink-0`}>
        {labelNode ?? <span className="text-sm text-[#1A1A1A]">{label}</span>}
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-medium text-[#1A1A1A] tabular-nums">{count}</span>
    </>
  )
  return href ? (
    <Link
      href={href}
      title={`Show ${label} leads`}
      className="flex items-center gap-3 -mx-2 px-2 py-0.5 rounded-lg transition hover:bg-[#C4956A]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4956A]/50"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{content}</div>
  )
}

function BreakdownCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

const PRIORITY_META: { key: Priority; label: string; color: string }[] = [
  { key: 'high', label: 'High', color: 'bg-red-500' },
  { key: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { key: 'low', label: 'Low', color: 'bg-emerald-500' },
]

const ELIGIBILITY_META: { key: EligibilityStatus; label: string; color: string }[] = [
  { key: 'pending', label: 'Pending', color: 'bg-gray-400' },
  { key: 'eligible', label: 'Eligible', color: 'bg-emerald-500' },
  { key: 'ineligible', label: 'Ineligible', color: 'bg-red-500' },
  { key: 'requires_more_info', label: 'Needs More Info', color: 'bg-amber-500' },
]

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [isObserver, setIsObserver] = useState(false)
  const [roleChecked, setRoleChecked] = useState(false)

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setIsObserver(getRole(data.user) === 'observer'))
      .catch(() => {})
      .finally(() => setRoleChecked(true))
  }, [])

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const res = await fetch('/api/metrics')
        if (res.ok) setMetrics(await res.json())
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  const show = (n?: number) => (loading || !metrics ? '—' : n ?? 0)
  // Everything on the dashboard links to the matching leads — for users only.
  // Observers can't open lead lists (patient details), so nothing is clickable for them.
  const clickable = roleChecked && !isObserver
  const link = (f: Parameters<typeof leadsHref>[0]) => (clickable ? leadsHref(f) : undefined)
  const total = metrics?.total ?? 0

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Dashboard</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={Users} label="Total Leads" value={show(metrics?.total)} color="bg-blue-50 text-blue-600" href={link({})} />
          <StatCard icon={UserPlus} label="New This Week" value={show(metrics?.newThisWeek)} color="bg-[#C4956A]/10 text-[#C4956A]" href={link({ created: 'last7' })} />
          <StatCard icon={CalendarClock} label="Follow Up Today" value={show(metrics?.followUpToday)} color="bg-orange-50 text-orange-600" href={link({ followup: 'today' })} />
          <StatCard icon={AlertTriangle} label="Overdue Follow-Ups" value={show(metrics?.followUpOverdue)} color="bg-red-50 text-red-600" href={link({ followup: 'overdue' })} />
          <StatCard icon={CalendarCheck} label="Procedures Scheduled" value={show(metrics?.proceduresScheduled)} color="bg-indigo-50 text-indigo-600" href={link({ procedure: 'scheduled' })} />
          <StatCard icon={CheckCircle2} label="Procedures Completed" value={show(metrics?.proceduresCompleted)} color="bg-emerald-50 text-emerald-600" href={link({ procedure: 'completed' })} />
          <StatCard icon={Video} label="Virtual Consults Scheduled" value={show(metrics?.virtualConsultsScheduled)} color="bg-teal-50 text-teal-600" href={link({ consult: 'scheduled' })} />
          <StatCard icon={UserX} label="Unassigned" value={show(metrics?.unassigned)} color="bg-gray-100 text-gray-500" href={link({ assigned: 'unassigned' })} />
        </div>

        {/* Histograms: leads added + Meta ad spend */}
        <DashboardCharts clickable={clickable} />

        {/* Pipeline breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Pipeline — Leads by Stage</h3>
            <span className="text-xs text-[#6B6B6B]">{total} total</span>
          </div>
          <div className="space-y-2.5">
            {STAGE_ORDER.map((stage) => (
              <BreakdownRow
                key={stage}
                label={STAGE_CONFIG[stage].label}
                count={metrics?.byStage?.[stage] ?? 0}
                total={total}
                barColor="bg-[#C4956A]"
                labelWidth="w-48"
                href={link({ stage })}
                labelNode={
                  <span className={`inline-block whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full ${STAGE_CONFIG[stage].color}`}>
                    {STAGE_CONFIG[stage].label}
                  </span>
                }
              />
            ))}
          </div>
        </div>

        {/* Breakdowns: priority / eligibility / source */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <BreakdownCard title="Priority">
            {PRIORITY_META.map((p) => (
              <BreakdownRow key={p.key} label={p.label} count={metrics?.byPriority?.[p.key] ?? 0} total={total} barColor={p.color} href={link({ priority: p.key })} />
            ))}
          </BreakdownCard>

          <BreakdownCard title="Eligibility">
            {ELIGIBILITY_META.map((e) => (
              <BreakdownRow key={e.key} label={e.label} count={metrics?.byEligibility?.[e.key] ?? 0} total={total} barColor={e.color} href={link({ eligibility: e.key })} />
            ))}
          </BreakdownCard>

          <BreakdownCard title="Lead Sources">
            {!metrics?.bySource?.length ? (
              <p className="text-sm text-[#6B6B6B]">No leads yet</p>
            ) : (
              metrics.bySource.map((s) => (
                <BreakdownRow
                  key={s.source}
                  label={s.source.charAt(0).toUpperCase() + s.source.slice(1)}
                  count={s.count}
                  total={total}
                  barColor="bg-[#C4956A]"
                  href={link({ source: s.source })}
                />
              ))
            )}
          </BreakdownCard>
        </div>

        {/* Lead Table — full users only (observers never receive lead PII) */}
        {roleChecked && !isObserver && (
          <div>
            <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">All Leads</h2>
            <LeadTable />
          </div>
        )}
      </div>
    </AppLayout>
  )
}
