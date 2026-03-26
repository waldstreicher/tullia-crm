export type PipelineStage =
  | 'new_lead'
  | 'attempted_contact'
  | 'contacted'
  | 'eligibility_review'
  | 'eligible'
  | 'ineligible'
  | 'virtual_consult_scheduled'
  | 'virtual_consult_completed'
  | 'procedure_scheduled'
  | 'procedure_completed'
  | 'lost'

export type Priority = 'high' | 'medium' | 'low'
export type EligibilityStatus = 'pending' | 'eligible' | 'ineligible' | 'requires_more_info'
export type NoteType = 'note' | 'call' | 'email' | 'status_change' | 'system'

export interface Lead {
  id: string
  created_at: string
  updated_at: string
  // From website form
  first_name: string
  last_name: string
  email: string
  phone?: string
  preferred_contact?: 'phone' | 'email'
  areas_of_interest?: string[]
  message?: string
  source: string
  // Pipeline
  stage: PipelineStage
  // Contact tracking
  last_contacted_at?: string
  next_follow_up_date?: string
  contact_attempts: number
  // Eligibility
  eligibility_status: EligibilityStatus
  eligibility_notes?: string
  eligibility_reviewed_by?: string
  eligibility_reviewed_at?: string
  // Virtual consult
  virtual_consult_scheduled_at?: string
  virtual_consult_completed_at?: string
  virtual_consult_notes?: string
  // Procedure
  procedure_scheduled_date?: string
  procedure_completed_at?: string
  procedure_areas?: string[]
  // Assignment
  assigned_to?: string
  priority: Priority
  internal_notes?: string
  tags?: string[]
}

export interface LeadNote {
  id: string
  lead_id: string
  created_at: string
  author: string
  note: string
  type: NoteType
}

export const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string }> = {
  new_lead: { label: 'New Lead', color: 'bg-blue-100 text-blue-800' },
  attempted_contact: { label: 'Attempted Contact', color: 'bg-yellow-100 text-yellow-800' },
  contacted: { label: 'Contacted', color: 'bg-indigo-100 text-indigo-800' },
  eligibility_review: { label: 'Eligibility Review', color: 'bg-purple-100 text-purple-800' },
  eligible: { label: 'Eligible', color: 'bg-green-100 text-green-800' },
  ineligible: { label: 'Ineligible', color: 'bg-red-100 text-red-800' },
  virtual_consult_scheduled: { label: 'Virtual Consult Scheduled', color: 'bg-teal-100 text-teal-800' },
  virtual_consult_completed: { label: 'Virtual Consult Done', color: 'bg-cyan-100 text-cyan-800' },
  procedure_scheduled: { label: 'Procedure Scheduled', color: 'bg-orange-100 text-orange-800' },
  procedure_completed: { label: 'Procedure Complete', color: 'bg-emerald-100 text-emerald-800' },
  lost: { label: 'Lost', color: 'bg-gray-100 text-gray-600' },
}

export const STAGE_ORDER: PipelineStage[] = [
  'new_lead',
  'attempted_contact',
  'contacted',
  'eligibility_review',
  'eligible',
  'ineligible',
  'virtual_consult_scheduled',
  'virtual_consult_completed',
  'procedure_scheduled',
  'procedure_completed',
  'lost',
]

export const PROCEDURE_AREAS = [
  'Arms',
  'Chin',
  'Male Chest',
  'Stomach',
  'Back',
  'Hips',
  'Thighs',
  'Legs',
  'Female Breasts',
  'Buttocks',
]
