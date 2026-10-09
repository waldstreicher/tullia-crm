'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { createClient } from '@/lib/supabase-browser'
import {
  Lead,
  LeadNote,
  PipelineStage,
  Priority,
  EligibilityStatus,
  NoteType,
  STAGE_CONFIG,
  STAGE_ORDER,
  PROCEDURE_AREAS,
} from '@/lib/types'
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  Calendar,
  Plus,
  Minus,
  MessageSquare,
  PhoneCall,
  Send,
  RefreshCw,
  Trash2,
} from 'lucide-react'

// ─── Note Icon Map ───────────────────────────────────────────────────────────
const NOTE_ICONS: Record<NoteType, React.ElementType> = {
  note: MessageSquare,
  call: PhoneCall,
  email: Mail,
  status_change: RefreshCw,
  system: User,
}
const NOTE_COLORS: Record<NoteType, string> = {
  note: 'bg-gray-100 text-gray-600',
  call: 'bg-green-100 text-green-600',
  email: 'bg-blue-100 text-blue-600',
  status_change: 'bg-purple-100 text-purple-600',
  system: 'bg-gray-100 text-gray-500',
}

// ─── Auto-save hook ───────────────────────────────────────────────────────────
function useAutoSave(leadId: string, field: string, value: unknown, delay = 800) {
  const prevValue = useRef(value)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (prevValue.current === value) return
    prevValue.current = value
    const timer = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
      } finally {
        setSaving(false)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [leadId, field, value, delay])

  return saving
}

// ─── Stage Stepper ────────────────────────────────────────────────────────────
function StageStepper({
  currentStage,
  onStageChange,
}: {
  currentStage: PipelineStage
  onStageChange: (stage: PipelineStage) => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Pipeline Stage</h3>
      <div className="flex flex-wrap gap-2">
        {STAGE_ORDER.map((stage) => {
          const conf = STAGE_CONFIG[stage]
          const isActive = stage === currentStage
          return (
            <button
              key={stage}
              onClick={() => onStageChange(stage)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                isActive
                  ? `${conf.color} border-transparent ring-2 ring-offset-1 ring-[#C4956A]`
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {conf.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Notes Timeline ───────────────────────────────────────────────────────────
function NotesTimeline({ leadId }: { leadId: string }) {
  const [notes, setNotes] = useState<LeadNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState<NoteType>('note')
  // Author is the signed-in user (attributed automatically).
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        setAuthor((u.user_metadata?.full_name as string | undefined) || u.email || '')
      }
    })
  }, [])

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`)
      if (res.ok) setNotes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!newNote.trim() || !author.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: newNote, type: noteType, author }),
      })
      if (res.ok) {
        setNewNote('')
        await fetchNotes()
      }
    } finally {
      setSubmitting(false)
    }
  }

  function formatTimestamp(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full">
      <div className="p-5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Activity & Notes</h3>
      </div>

      {/* Add note form */}
      <form onSubmit={handleAddNote} className="p-4 border-b border-gray-100 space-y-3">
        {author && (
          <p className="text-xs text-[#6B6B6B]">
            Posting as <span className="font-medium text-[#1A1A1A]">{author}</span>
          </p>
        )}
        <textarea
          placeholder="Add a note..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          required
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:border-transparent resize-none"
        />
        <div className="flex gap-2 items-center">
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value as NoteType)}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
          >
            <option value="note">Note</option>
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="status_change">Status Change</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-[#C4956A] text-white text-sm font-medium rounded-xl hover:bg-[#a87a54] transition disabled:opacity-60"
          >
            <Send size={14} />
            {submitting ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <p className="text-sm text-[#6B6B6B] text-center py-4">Loading...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-[#6B6B6B] text-center py-4">No activity yet</p>
        ) : (
          notes.map((note) => {
            const Icon = NOTE_ICONS[note.type]
            return (
              <div key={note.id} className="flex gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${NOTE_COLORS[note.type]}`}>
                  <Icon size={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[#1A1A1A]">{note.author}</span>
                    <span className="text-xs text-[#6B6B6B]">{formatTimestamp(note.created_at)}</span>
                    <span className="text-xs text-[#6B6B6B] capitalize">· {note.type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-sm text-[#1A1A1A] mt-1 leading-relaxed">{note.note}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeadDetailPage() {
  const params = useParams()
  const router = useRouter()
  const leadId = params.id as string

  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [users, setUsers] = useState<{ email: string; name: string }[]>([])

  // Local editable state
  const [assignedTo, setAssignedTo] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [contactAttempts, setContactAttempts] = useState(0)
  const [lastContactedAt, setLastContactedAt] = useState('')
  const [nextFollowUpDate, setNextFollowUpDate] = useState('')
  const [preferredContactTime, setPreferredContactTime] = useState('')
  const [eligibilityStatus, setEligibilityStatus] = useState<EligibilityStatus>('pending')
  const [eligibilityNotes, setEligibilityNotes] = useState('')
  const [eligibilityReviewedBy, setEligibilityReviewedBy] = useState('')
  const [virtualConsultScheduledAt, setVirtualConsultScheduledAt] = useState('')
  const [virtualConsultCompletedAt, setVirtualConsultCompletedAt] = useState('')
  const [virtualConsultNotes, setVirtualConsultNotes] = useState('')
  const [procedureScheduledDate, setProcedureScheduledDate] = useState('')
  const [procedureAreas, setProcedureAreas] = useState<string[]>([])
  const [procedureCompletedAt, setProcedureCompletedAt] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    async function fetchLead() {
      try {
        const res = await fetch(`/api/leads/${leadId}`)
        if (!res.ok) throw new Error('Lead not found')
        const data: Lead = await res.json()
        setLead(data)
        setAssignedTo(data.assigned_to || '')
        setPriority(data.priority)
        setContactAttempts(data.contact_attempts)
        setLastContactedAt(data.last_contacted_at ? data.last_contacted_at.slice(0, 16) : '')
        setNextFollowUpDate(data.next_follow_up_date || '')
        setPreferredContactTime((data as Lead & { preferred_contact_time?: string }).preferred_contact_time || '')
        setEligibilityStatus(data.eligibility_status)
        setEligibilityNotes(data.eligibility_notes || '')
        setEligibilityReviewedBy(data.eligibility_reviewed_by || '')
        setVirtualConsultScheduledAt(data.virtual_consult_scheduled_at ? data.virtual_consult_scheduled_at.slice(0, 16) : '')
        setVirtualConsultCompletedAt(data.virtual_consult_completed_at ? data.virtual_consult_completed_at.slice(0, 16) : '')
        setVirtualConsultNotes(data.virtual_consult_notes || '')
        setProcedureScheduledDate(data.procedure_scheduled_date || '')
        setProcedureAreas(data.procedure_areas || [])
        setProcedureCompletedAt(data.procedure_completed_at ? data.procedure_completed_at.slice(0, 16) : '')
        setInternalNotes(data.internal_notes || '')
        setTags(data.tags?.join(', ') || '')
      } catch {
        setError('Failed to load lead')
      } finally {
        setLoading(false)
      }
    }
    fetchLead()
  }, [leadId])

  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((u) => setUsers(Array.isArray(u) ? u : []))
      .catch(() => {})
  }, [])

  // Auto-save individual fields
  useAutoSave(leadId, 'assigned_to', assignedTo || null)
  useAutoSave(leadId, 'priority', priority)
  useAutoSave(leadId, 'contact_attempts', contactAttempts)
  useAutoSave(leadId, 'last_contacted_at', lastContactedAt || null)
  useAutoSave(leadId, 'next_follow_up_date', nextFollowUpDate || null)
  useAutoSave(leadId, 'eligibility_status', eligibilityStatus)
  useAutoSave(leadId, 'eligibility_notes', eligibilityNotes || null)
  useAutoSave(leadId, 'eligibility_reviewed_by', eligibilityReviewedBy || null)
  useAutoSave(leadId, 'virtual_consult_scheduled_at', virtualConsultScheduledAt || null)
  useAutoSave(leadId, 'virtual_consult_completed_at', virtualConsultCompletedAt || null)
  useAutoSave(leadId, 'virtual_consult_notes', virtualConsultNotes || null)
  useAutoSave(leadId, 'procedure_scheduled_date', procedureScheduledDate || null)
  useAutoSave(leadId, 'procedure_areas', procedureAreas)
  useAutoSave(leadId, 'procedure_completed_at', procedureCompletedAt || null)
  useAutoSave(leadId, 'internal_notes', internalNotes || null)
  useAutoSave(leadId, 'tags', tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [])

  async function handleStageChange(stage: PipelineStage) {
    if (!lead) return
    const prevStage = lead.stage
    setLead((prev) => prev ? { ...prev, stage } : null)
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
      // Auto-create a status change note
      await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: `Stage changed from "${STAGE_CONFIG[prevStage].label}" to "${STAGE_CONFIG[stage].label}"`,
          type: 'status_change',
          author: 'System',
        }),
      })
    } catch {
      setLead((prev) => prev ? { ...prev, stage: prevStage } : null)
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      router.push('/leads')
    } catch {
      setError('Failed to delete lead')
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:border-transparent'
  const labelClass = 'block text-xs font-medium text-[#6B6B6B] uppercase tracking-wide mb-1.5'

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen text-[#6B6B6B]">
          Loading lead...
        </div>
      </AppLayout>
    )
  }

  if (error || !lead) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen text-red-500">
          {error || 'Lead not found'}
        </div>
      </AppLayout>
    )
  }

  const stageConf = STAGE_CONFIG[lead.stage]

  // The website embeds the consultation "Primary goal" (fat reduction /
  // tightening / both) inside the free-text message as "[Primary goal: X]".
  // Pull it out so it reads as its own clear field, and strip it from the message.
  const goalMatch = lead.message?.match(/\[\s*primary goal\s*:\s*([^\]]+)\]/i)
  const goalRaw = goalMatch?.[1]?.trim()
  const primaryGoal = goalRaw
    ? /both/i.test(goalRaw)
      ? 'Both — fat reduction + skin tightening'
      : /fat/i.test(goalRaw)
        ? 'Fat reduction'
        : /tighten/i.test(goalRaw)
          ? 'Skin tightening'
          : goalRaw
    : null
  const cleanedMessage = lead.message
    ? lead.message.replace(/\[\s*primary goal\s*:\s*[^\]]+\]/i, '').trim()
    : ''

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-gray-100 text-[#6B6B6B] hover:text-[#1A1A1A] transition"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A1A]">
                {lead.first_name} {lead.last_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageConf.color}`}>
                  {stageConf.label}
                </span>
                <span className="text-xs text-[#6B6B6B]">Added {formatDate(lead.created_at)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition"
          >
            <Trash2 size={16} />
            Delete
          </button>
        </div>

        {/* Delete confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2">Delete Lead?</h3>
              <p className="text-sm text-[#6B6B6B] mb-6">
                This will permanently delete {lead.first_name} {lead.last_name} and all associated notes.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-[#6B6B6B] rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column (60%) */}
          <div className="lg:col-span-3 space-y-4">

            {/* Lead Info Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Patient Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#C4956A]/10 flex items-center justify-center">
                    <User size={14} className="text-[#C4956A]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#1A1A1A]">{lead.first_name} {lead.last_name}</p>
                    <p className="text-xs text-[#6B6B6B]">Source: {lead.source}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                    <Mail size={14} className="text-blue-600" />
                  </div>
                  <a href={`mailto:${lead.email}`} className="text-sm text-blue-600 hover:underline">
                    {lead.email}
                  </a>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                      <Phone size={14} className="text-green-600" />
                    </div>
                    <a href={`tel:${lead.phone}`} className="text-sm text-green-600 hover:underline">
                      {lead.phone}
                    </a>
                    {lead.preferred_contact && (
                      <span className="text-xs text-[#6B6B6B]">
                        (prefers {lead.preferred_contact})
                      </span>
                    )}
                  </div>
                )}
                {lead.areas_of_interest && lead.areas_of_interest.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-[#6B6B6B] mb-2">Areas of Interest</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.areas_of_interest.map((area) => (
                        <span
                          key={area}
                          className="text-xs bg-[#C4956A]/10 text-[#C4956A] px-2.5 py-1 rounded-full font-medium"
                        >
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {primaryGoal && (
                  <div className="pt-2">
                    <p className="text-xs text-[#6B6B6B] mb-1">Primary Goal</p>
                    <span className="inline-block text-sm font-medium text-[#1A1A1A] bg-[#C4956A]/10 border border-[#C4956A]/20 px-3 py-1 rounded-full">
                      {primaryGoal}
                    </span>
                  </div>
                )}
                {cleanedMessage && (
                  <div className="pt-2">
                    <p className="text-xs text-[#6B6B6B] mb-1">Original Message</p>
                    <p className="text-sm text-[#1A1A1A] bg-gray-50 rounded-xl p-3 leading-relaxed">
                      {cleanedMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stage Stepper */}
            <StageStepper currentStage={lead.stage} onStageChange={handleStageChange} />

            {/* Tracking Form */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Tracking
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Assigned To</label>
                    <select
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.email} value={u.email}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Priority</label>
                    <div className="flex gap-1">
                      {(['high', 'medium', 'low'] as Priority[]).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg capitalize transition ${
                            priority === p
                              ? p === 'high' ? 'bg-red-100 text-red-700'
                                : p === 'medium' ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Contact Attempts</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setContactAttempts(Math.max(0, contactAttempts - 1))}
                        className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-lg font-semibold text-[#1A1A1A] w-8 text-center">
                        {contactAttempts}
                      </span>
                      <button
                        onClick={() => setContactAttempts(contactAttempts + 1)}
                        className="w-8 h-8 rounded-lg bg-[#C4956A]/10 hover:bg-[#C4956A]/20 text-[#C4956A] flex items-center justify-center transition"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Next Follow-Up</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="date"
                        value={nextFollowUpDate}
                        onChange={(e) => setNextFollowUpDate(e.target.value)}
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Last Contacted</label>
                  <input
                    type="datetime-local"
                    value={lastContactedAt}
                    onChange={(e) => setLastContactedAt(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Preferred Contact Time</label>
                  <input
                    type="text"
                    value={preferredContactTime}
                    onChange={(e) => setPreferredContactTime(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Mornings preferred"
                  />
                </div>
              </div>
            </div>

            {/* Eligibility */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Eligibility
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { value: 'pending', label: 'Pending' },
                        { value: 'eligible', label: 'Eligible' },
                        { value: 'ineligible', label: 'Ineligible' },
                        { value: 'requires_more_info', label: 'Needs More Info' },
                      ] as { value: EligibilityStatus; label: string }[]
                    ).map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="eligibility_status"
                          value={value}
                          checked={eligibilityStatus === value}
                          onChange={() => setEligibilityStatus(value)}
                          className="text-[#C4956A] focus:ring-[#C4956A]"
                        />
                        <span className="text-sm text-[#1A1A1A]">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Eligibility Notes</label>
                  <textarea
                    rows={2}
                    value={eligibilityNotes}
                    onChange={(e) => setEligibilityNotes(e.target.value)}
                    className={inputClass}
                    placeholder="Notes on eligibility..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Reviewed By</label>
                  <input
                    type="text"
                    value={eligibilityReviewedBy}
                    onChange={(e) => setEligibilityReviewedBy(e.target.value)}
                    className={inputClass}
                    placeholder="Reviewer name"
                  />
                </div>
              </div>
            </div>

            {/* Virtual Consult */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Virtual Consultation
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Scheduled Date & Time</label>
                  <input
                    type="datetime-local"
                    value={virtualConsultScheduledAt}
                    onChange={(e) => setVirtualConsultScheduledAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Completed Date & Time</label>
                  <input
                    type="datetime-local"
                    value={virtualConsultCompletedAt}
                    onChange={(e) => setVirtualConsultCompletedAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Consult Notes</label>
                  <textarea
                    rows={3}
                    value={virtualConsultNotes}
                    onChange={(e) => setVirtualConsultNotes(e.target.value)}
                    className={inputClass}
                    placeholder="Notes from virtual consultation..."
                  />
                </div>
              </div>
            </div>

            {/* Procedure */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Procedure
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Scheduled Date</label>
                  <input
                    type="date"
                    value={procedureScheduledDate}
                    onChange={(e) => setProcedureScheduledDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Procedure Areas</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PROCEDURE_AREAS.map((area) => (
                      <label key={area} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={procedureAreas.includes(area)}
                          onChange={() => {
                            setProcedureAreas((prev) =>
                              prev.includes(area)
                                ? prev.filter((a) => a !== area)
                                : [...prev, area]
                            )
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#C4956A] focus:ring-[#C4956A]"
                        />
                        <span className="text-sm text-[#1A1A1A]">{area}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Completed Date & Time</label>
                  <input
                    type="datetime-local"
                    value={procedureCompletedAt}
                    onChange={(e) => setProcedureCompletedAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Internal Notes & Tags */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4 pb-3 border-b border-gray-100">
                Internal Notes & Tags
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Internal Notes</label>
                  <textarea
                    rows={5}
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className={inputClass}
                    placeholder="Private notes visible only to staff..."
                  />
                </div>
                <div>
                  <label className={labelClass}>Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. vip, referral, instagram"
                  />
                  {tags && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.split(',').map((t) => t.trim()).filter(Boolean).map((tag) => (
                        <span key={tag} className="text-xs bg-gray-100 text-[#6B6B6B] px-2.5 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (40%) */}
          <div className="lg:col-span-2">
            <div className="sticky top-6" style={{ minHeight: '600px', height: 'calc(100vh - 10rem)' }}>
              <NotesTimeline leadId={leadId} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
