import { Lead, PipelineStage, Priority, EligibilityStatus, STAGE_ORDER } from './types'
import { LeadFilter, matchesLeadFilter } from './lead-filters'

// Aggregate, PII-free dashboard metrics. Shared by the /api/metrics endpoint
// (dashboard) and the daily cron digest email.
export interface DashboardMetrics {
  total: number
  newThisWeek: number
  followUpToday: number
  followUpOverdue: number
  unassigned: number
  proceduresScheduled: number
  proceduresCompleted: number
  virtualConsultsScheduled: number
  byStage: Record<PipelineStage, number>
  byPriority: Record<Priority, number>
  byEligibility: Record<EligibilityStatus, number>
  bySource: { source: string; count: number }[]
}

export function computeMetrics(leads: Lead[]): DashboardMetrics {
  const now = new Date()

  const byStage = Object.fromEntries(
    STAGE_ORDER.map((s) => [s, 0])
  ) as Record<PipelineStage, number>
  const byPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 }
  const byEligibility: Record<EligibilityStatus, number> = {
    pending: 0,
    eligible: 0,
    ineligible: 0,
    requires_more_info: 0,
  }
  const sourceCounts = new Map<string, number>()

  for (const l of leads) {
    if (l.stage in byStage) byStage[l.stage] += 1
    if (l.priority in byPriority) byPriority[l.priority] += 1
    if (l.eligibility_status in byEligibility) byEligibility[l.eligibility_status] += 1
    const src = l.source || 'unknown'
    sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1)
  }

  const bySource = Array.from(sourceCounts.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)

  // Same predicates the All Leads page uses when a tile is clicked, so the
  // tile's number always matches the list it opens.
  const count = (f: LeadFilter) => leads.filter((l) => matchesLeadFilter(l, f, now)).length

  return {
    total: leads.length,
    newThisWeek: count({ created: 'last7' }),
    followUpToday: count({ followup: 'today' }),
    followUpOverdue: count({ followup: 'overdue' }),
    unassigned: count({ assigned: 'unassigned' }),
    proceduresScheduled: count({ procedure: 'scheduled' }),
    proceduresCompleted: count({ procedure: 'completed' }),
    virtualConsultsScheduled: count({ consult: 'scheduled' }),
    byStage,
    byPriority,
    byEligibility,
    bySource,
  }
}
