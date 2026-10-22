import { Lead, PipelineStage, Priority, EligibilityStatus, STAGE_CONFIG } from './types'
import { easternDate } from './dates'

// Filters that dashboard tiles, bars and charts link to (/leads?…). The
// dashboard's numbers are computed with these same predicates, so the count
// on a tile always equals the number of leads shown after clicking it.

export interface LeadFilter {
  stage?: PipelineStage
  priority?: Priority
  eligibility?: EligibilityStatus
  source?: string
  created?: 'last7' // created in the last 7 days ("New This Week")
  from?: string // created on/after this Eastern date (YYYY-MM-DD)
  to?: string // created on/before this Eastern date (YYYY-MM-DD)
  followup?: 'today' | 'overdue'
  assigned?: 'unassigned'
  procedure?: 'scheduled' | 'completed'
  consult?: 'scheduled'
}

const YMD = /^\d{4}-\d{2}-\d{2}$/
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function parseLeadFilter(sp: URLSearchParams): LeadFilter {
  const f: LeadFilter = {}
  const stage = sp.get('stage')
  if (stage && stage in STAGE_CONFIG) f.stage = stage as PipelineStage
  const priority = sp.get('priority')
  if (priority === 'high' || priority === 'medium' || priority === 'low') f.priority = priority
  const elig = sp.get('eligibility')
  if (elig === 'pending' || elig === 'eligible' || elig === 'ineligible' || elig === 'requires_more_info')
    f.eligibility = elig
  const source = sp.get('source')
  if (source) f.source = source
  if (sp.get('created') === 'last7') f.created = 'last7'
  const from = sp.get('from')
  if (from && YMD.test(from)) f.from = from
  const to = sp.get('to')
  if (to && YMD.test(to)) f.to = to
  const followup = sp.get('followup')
  if (followup === 'today' || followup === 'overdue') f.followup = followup
  if (sp.get('assigned') === 'unassigned') f.assigned = 'unassigned'
  const procedure = sp.get('procedure')
  if (procedure === 'scheduled' || procedure === 'completed') f.procedure = procedure
  if (sp.get('consult') === 'scheduled') f.consult = 'scheduled'
  return f
}

export function leadsHref(f: LeadFilter): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) if (v) sp.set(k, String(v))
  const qs = sp.toString()
  return qs ? `/leads?${qs}` : '/leads'
}

export function hasFilter(f: LeadFilter): boolean {
  return Object.values(f).some(Boolean)
}

export function matchesLeadFilter(lead: Lead, f: LeadFilter, now: Date = new Date()): boolean {
  const today = easternDate(now)
  if (f.stage && lead.stage !== f.stage) return false
  if (f.priority && lead.priority !== f.priority) return false
  if (f.eligibility && lead.eligibility_status !== f.eligibility) return false
  if (f.source && (lead.source || 'unknown') !== f.source) return false
  if (f.created === 'last7' && new Date(lead.created_at).getTime() < now.getTime() - WEEK_MS) return false
  if (f.from || f.to) {
    const created = easternDate(lead.created_at)
    if (f.from && created < f.from) return false
    if (f.to && created > f.to) return false
  }
  if (f.followup === 'today' && lead.next_follow_up_date !== today) return false
  if (f.followup === 'overdue' && !(lead.next_follow_up_date && lead.next_follow_up_date < today)) return false
  if (f.assigned === 'unassigned' && lead.assigned_to) return false
  if (f.procedure === 'scheduled' && !(lead.procedure_scheduled_date && !lead.procedure_completed_at)) return false
  if (f.procedure === 'completed' && !lead.procedure_completed_at) return false
  if (f.consult === 'scheduled' && !(lead.virtual_consult_scheduled_at && !lead.virtual_consult_completed_at))
    return false
  return true
}

function fmtDay(ymd: string) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// Human-readable chips for the filters that aren't already shown in the
// All Leads dropdowns (stage and priority have their own dropdowns).
export function describeLeadFilter(f: LeadFilter): string[] {
  const out: string[] = []
  if (f.created === 'last7') out.push('Added in the last 7 days')
  if (f.from && f.to) out.push(f.from === f.to ? `Added ${fmtDay(f.from)}` : `Added ${fmtDay(f.from)} – ${fmtDay(f.to)}`)
  else if (f.from) out.push(`Added since ${fmtDay(f.from)}`)
  else if (f.to) out.push(`Added through ${fmtDay(f.to)}`)
  if (f.source) out.push(`Source: ${f.source.charAt(0).toUpperCase()}${f.source.slice(1)}`)
  if (f.eligibility)
    out.push(
      `Eligibility: ${
        { pending: 'Pending', eligible: 'Eligible', ineligible: 'Ineligible', requires_more_info: 'Needs More Info' }[
          f.eligibility
        ]
      }`
    )
  if (f.followup === 'today') out.push('Follow up today')
  if (f.followup === 'overdue') out.push('Overdue follow-ups')
  if (f.assigned === 'unassigned') out.push('Unassigned')
  if (f.procedure === 'scheduled') out.push('Procedure scheduled (not yet done)')
  if (f.procedure === 'completed') out.push('Procedure completed')
  if (f.consult === 'scheduled') out.push('Virtual consult scheduled (not yet done)')
  return out
}
