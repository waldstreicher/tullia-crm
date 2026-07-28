import { Lead, PipelineStage, Priority, EligibilityStatus, STAGE_ORDER } from './types'

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
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const today = now.toISOString().split('T')[0]

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
    byStage,
    byPriority,
    byEligibility,
    bySource,
  }
}
