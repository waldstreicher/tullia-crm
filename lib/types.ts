export type PipelineStage =
  | 'check_duplicate'
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
  zip_code?: string
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
  check_duplicate: { label: 'Check Duplicate', color: 'bg-amber-200 text-amber-900' },
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
  'check_duplicate',
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

// Head-to-toe. Mirrors areaOptions in the website's ConsultationForm.
export const PROCEDURE_AREAS = [
  'Chin',
  'Arms',
  'Axilla ("Chicken Cutlet")',
  'Male Chest',
  'Female Breasts',
  'Stomach',
  'Mons',
  'Hips',
  'Inner Thighs',
  'Knees',
  'Buttock (Banana Roll only)',
]

// ─── Scheduling ──────────────────────────────────────────────────────────────
export type AppointmentStatus = 'booked' | 'cancelled' | 'completed' | 'no_show'

export interface Appointment {
  id: string
  created_at: string
  updated_at: string
  lead_id: string
  owner_email: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  booked_via: 'website' | 'crm'
  rescheduled_from?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  confirmation_sent_at?: string | null
  reminder_sent_at?: string | null
  // Present when the API joins the lead (appointments list).
  leads?: { first_name: string; last_name: string; email: string; phone?: string | null } | null
}

export interface AvailabilityRule {
  id: string
  owner_email: string
  weekday: number // 0 = Sunday … 6 = Saturday
  start_time: string // 'HH:MM:SS' from the DB
  end_time: string
}

export interface AvailabilityOverride {
  id: string
  owner_email: string
  date: string // 'YYYY-MM-DD'
  kind: 'block' | 'open'
  start_time?: string | null
  end_time?: string | null
  note?: string | null
}

export const APPOINTMENT_STATUS_CONFIG: Record<AppointmentStatus, { label: string; color: string }> = {
  booked: { label: 'Booked', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  no_show: { label: 'No-Show', color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
}

// ─── Website chatbot ─────────────────────────────────────────────────────────
export interface ChatSession {
  id: string
  created_at: string
  last_message_at: string
  page?: string | null
  language?: string | null
  message_count: number
  flagged: boolean
  reviewed_at?: string | null
  reviewed_by?: string | null
  archived_at?: string | null
  archived_by?: string | null
}

export interface ChatMessage {
  id: string
  created_at: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  model?: string | null
  input_tokens?: number | null
  cache_read_tokens?: number | null
  output_tokens?: number | null
  stop_reason?: string | null
  latency_ms?: number | null
  flagged: boolean
  flag_note?: string | null
  flagged_by?: string | null
  flagged_at?: string | null
}
