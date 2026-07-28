'use client'

import { useEffect, useMemo, useState } from 'react'
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
import {
  Lead,
  Priority,
  EligibilityStatus,
  STAGE_CONFIG,
  STAGE_ORDER,
} from '@/lib/types'

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-3xl font-semibold text-[#1A1A1A] tabular-nums">{value}</p>
        <p className="text-sm text-[#6B6B6B] mt-0.5">{label}</p>
      </div>
    </div>
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
}: {
  label: string
  count: number
  total: number
  barColor: string
  labelNode?: React.ReactNode
  labelWidth?: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <div className={`${labelWidth} shrink-0`}>
        {labelNode ?? <span className="text-sm text-[#1A1A1A]">{label}</span>}
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-medium text-[#1A1A1A] tabular-nums">
        {count}
      </span>
    </div>
  )
}

function BreakdownCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// ─── Metric computation ───────────────────────────────────────────────────────
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

function computeMetrics(leads: Lead[]) {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const today = now.toISOString().split('T')[0]

  const stageBreakdown = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_CONFIG[stage].label,
    badge: STAGE_CONFIG[stage].color,
    count: leads.filter((l) => l.stage === stage).length,
  }))

  const priorityBreakdown = PRIORITY_META.map((p) => ({
    ...p,
    count: leads.filter((l) => l.priority === p.key).length,
  }))

  const eligibilityBreakdown = ELIGIBILITY_META.map((e) => ({
    ...e,
    count: leads.filter((l) => l.eligibility_status === e.key).length,
  }))

  // Source breakdown (dynamic), sorted by count desc
  const sourceCounts = new Map<string, number>()
  for (const l of leads) {
    const src = l.source || 'unknown'
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1)
  }
  const sourceBreakdown = Array.from(sourceCounts.entries())
    .map(([key, count]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      count,
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total: leads.length,
    newThisWeek: leads.filter((l) => new Date(l.created_at) >= weekAgo).length,
    followUpToday: leads.filter((l) => l.next_follow_up_date === today).length,
    followUpOverdue: leads.filter(
      (l) => l.next_follow_up_date && l.next_follow_up_date < today
    ).length,
    unassigned: leads.filter((l) => !l.assigned_to).length,
    proceduresScheduled: leads.filter(
      (l) => l.procedure_scheduled_date && !l.procedure_completed_at
    ).length,
    proceduresCompleted: leads.filter((l) => l.procedure_completed_at).length,
    virtualConsultsScheduled: leads.filter(
      (l) => l.virtual_consult_scheduled_at && !l.virtual_consult_completed_at
    ).length,
    stageBreakdown,
    priorityBreakdown,
    eligibilityBreakdown,
    sourceBreakdown,
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLeads() {
      try {
        const res = await fetch('/api/leads')
        if (!res.ok) return
        const data: Lead[] = await res.json()
        setLeads(data)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchLeads()
  }, [])

  const m = useMemo(() => computeMetrics(leads), [leads])
  const show = (n: number) => (loading ? '—' : n)

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
          <StatCard icon={Users} label="Total Leads" value={show(m.total)} color="bg-blue-50 text-blue-600" />
          <StatCard icon={UserPlus} label="New This Week" value={show(m.newThisWeek)} color="bg-[#C4956A]/10 text-[#C4956A]" />
          <StatCard icon={CalendarClock} label="Follow Up Today" value={show(m.followUpToday)} color="bg-orange-50 text-orange-600" />
          <StatCard icon={AlertTriangle} label="Overdue Follow-Ups" value={show(m.followUpOverdue)} color="bg-red-50 text-red-600" />
          <StatCard icon={CalendarCheck} label="Procedures Scheduled" value={show(m.proceduresScheduled)} color="bg-indigo-50 text-indigo-600" />
          <StatCard icon={CheckCircle2} label="Procedures Completed" value={show(m.proceduresCompleted)} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Video} label="Virtual Consults Scheduled" value={show(m.virtualConsultsScheduled)} color="bg-teal-50 text-teal-600" />
          <StatCard icon={UserX} label="Unassigned" value={show(m.unassigned)} color="bg-gray-100 text-gray-500" />
        </div>

        {/* Pipeline breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Pipeline — Leads by Stage</h3>
            <span className="text-xs text-[#6B6B6B]">{m.total} total</span>
          </div>
          <div className="space-y-2.5">
            {m.stageBreakdown.map((s) => (
              <BreakdownRow
                key={s.stage}
                label={s.label}
                count={s.count}
                total={m.total}
                barColor="bg-[#C4956A]"
                labelWidth="w-48"
                labelNode={
                  <span className={`inline-block whitespace-nowrap text-xs font-medium px-2.5 py-1 rounded-full ${s.badge}`}>
                    {s.label}
                  </span>
                }
              />
            ))}
          </div>
        </div>

        {/* Breakdowns: priority / eligibility / source */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <BreakdownCard title="Priority">
            {m.priorityBreakdown.map((p) => (
              <BreakdownRow key={p.key} label={p.label} count={p.count} total={m.total} barColor={p.color} />
            ))}
          </BreakdownCard>

          <BreakdownCard title="Eligibility">
            {m.eligibilityBreakdown.map((e) => (
              <BreakdownRow key={e.key} label={e.label} count={e.count} total={m.total} barColor={e.color} />
            ))}
          </BreakdownCard>

          <BreakdownCard title="Lead Sources">
            {m.sourceBreakdown.length === 0 ? (
              <p className="text-sm text-[#6B6B6B]">No leads yet</p>
            ) : (
              m.sourceBreakdown.map((s) => (
                <BreakdownRow key={s.key} label={s.label} count={s.count} total={m.total} barColor="bg-[#C4956A]" />
              ))
            )}
          </BreakdownCard>
        </div>

        {/* Lead Table */}
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">All Leads</h2>
          <LeadTable />
        </div>
      </div>
    </AppLayout>
  )
}
