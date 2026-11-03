import { PipelineStage, STAGE_CONFIG } from './types'

// Consult → treatment funnel. Each step counts patients who reached it at ANY
// point, inferred from their current stage, every recorded stage change
// (lead_notes of type status_change), the eligibility / consult / procedure
// fields, and follow-up call bookings. Counts only — no patient details.

export interface FunnelLead {
  id: string
  created_at: string
  stage: PipelineStage
  eligibility_status: string
  contact_attempts: number | null
  virtual_consult_scheduled_at: string | null
  virtual_consult_completed_at: string | null
  procedure_scheduled_date: string | null
  procedure_completed_at: string | null
}

export interface StageChange {
  lead_id: string
  note: string
}

export interface FunnelAppointment {
  lead_id: string
  status: string
}

export type FunnelStepKey =
  | 'requested'
  | 'outreach'
  | 'reached'
  | 'reviewed'
  | 'eligible'
  | 'vcScheduled'
  | 'vcDone'
  | 'procScheduled'
  | 'procDone'

export const FUNNEL_STEPS: { key: FunnelStepKey; label: string; note: string }[] = [
  { key: 'requested', label: 'Consult requested', note: 'Website or manual entry' },
  { key: 'outreach', label: 'Outreach started', note: 'Call, text, note or stage change' },
  { key: 'reached', label: 'Reached', note: 'Spoke with the patient' },
  { key: 'reviewed', label: 'Eligibility reviewed', note: 'Reviewed or decided' },
  { key: 'eligible', label: 'Eligible', note: 'Cleared for TuLi' },
  { key: 'vcScheduled', label: 'Virtual consult scheduled', note: 'With the doctor' },
  { key: 'vcDone', label: 'Virtual consult done', note: '' },
  { key: 'procScheduled', label: 'Procedure scheduled', note: '' },
  { key: 'procDone', label: 'Procedure completed', note: '' },
]

export interface FunnelResult {
  steps: { key: FunnelStepKey; label: string; note: string; count: number }[]
  ineligible: number
  decided: number
  calls: { booked: number; completed: number; noShow: number; cancelled: number; upcoming: number }
}

const RANK: Record<PipelineStage, number> = {
  check_duplicate: 0,
  new_lead: 0,
  attempted_contact: 1,
  contacted: 2,
  eligibility_review: 3,
  eligible: 4,
  ineligible: 4,
  virtual_consult_scheduled: 5,
  virtual_consult_completed: 6,
  procedure_scheduled: 7,
  procedure_completed: 8,
  lost: -1,
}

const STAGE_BY_LABEL = Object.fromEntries(
  (Object.entries(STAGE_CONFIG) as [PipelineStage, { label: string }][]).map(([k, v]) => [v.label, k])
) as Record<string, PipelineStage>

// "Stage changed from "A" to "B"" → B
function stageFromNote(note: string): PipelineStage | null {
  const m = note.match(/to "([^"]+)"/)
  return m ? STAGE_BY_LABEL[m[1]] ?? null : null
}

export function computeFunnel(
  leads: FunnelLead[],
  changes: StageChange[],
  appointments: FunnelAppointment[]
): FunnelResult {
  const history = new Map<string, PipelineStage[]>()
  for (const c of changes) {
    const s = stageFromNote(c.note)
    if (!s) continue
    const list = history.get(c.lead_id) ?? []
    list.push(s)
    history.set(c.lead_id, list)
  }
  const apptsByLead = new Map<string, FunnelAppointment[]>()
  for (const a of appointments) {
    const list = apptsByLead.get(a.lead_id) ?? []
    list.push(a)
    apptsByLead.set(a.lead_id, list)
  }

  const counts: Record<FunnelStepKey, number> = {
    requested: 0, outreach: 0, reached: 0, reviewed: 0, eligible: 0,
    vcScheduled: 0, vcDone: 0, procScheduled: 0, procDone: 0,
  }
  let ineligible = 0
  const calls = { booked: 0, completed: 0, noShow: 0, cancelled: 0, upcoming: 0 }
  const leadIds = new Set<string>()

  for (const l of leads) {
    if (l.stage === 'check_duplicate') continue // same person as another lead
    leadIds.add(l.id)
    const ever = new Set<PipelineStage>([l.stage, ...(history.get(l.id) ?? [])])
    const maxRank = Math.max(...Array.from(ever).map((s) => RANK[s] ?? 0))
    const appts = apptsByLead.get(l.id) ?? []
    const callDone = appts.some((a) => a.status === 'completed')

    const reached = maxRank >= 2 || callDone
    const reviewed = maxRank >= 3 || l.eligibility_status !== 'pending'
    const eligible = ever.has('eligible') || maxRank >= 5 || l.eligibility_status === 'eligible'
    const vcScheduled = maxRank >= 5 || !!l.virtual_consult_scheduled_at
    const vcDone = maxRank >= 6 || !!l.virtual_consult_completed_at
    const procScheduled = maxRank >= 7 || !!l.procedure_scheduled_date
    const procDone = maxRank >= 8 || !!l.procedure_completed_at
    const outreach = maxRank >= 1 || (l.contact_attempts ?? 0) > 0 || appts.length > 0 || reached

    counts.requested++
    if (outreach) counts.outreach++
    if (reached) counts.reached++
    if (reviewed) counts.reviewed++
    if (eligible) counts.eligible++
    if (vcScheduled) counts.vcScheduled++
    if (vcDone) counts.vcDone++
    if (procScheduled) counts.procScheduled++
    if (procDone) counts.procDone++
    if (ever.has('ineligible') || l.eligibility_status === 'ineligible') ineligible++
  }

  for (const a of appointments) {
    if (!leadIds.has(a.lead_id)) continue
    calls.booked++
    if (a.status === 'completed') calls.completed++
    else if (a.status === 'no_show') calls.noShow++
    else if (a.status === 'cancelled') calls.cancelled++
    else if (a.status === 'booked') calls.upcoming++
  }

  return {
    steps: FUNNEL_STEPS.map((s) => ({ ...s, count: counts[s.key] })),
    ineligible,
    decided: counts.eligible + ineligible,
    calls,
  }
}
