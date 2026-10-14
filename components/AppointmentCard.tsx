'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck, CalendarPlus, Check, Clock, RotateCcw, X, Ban, Mail } from 'lucide-react'
import { Appointment, APPOINTMENT_STATUS_CONFIG } from '@/lib/types'
import { formatFullEt, formatTimeLabel, type SlotDay } from '@/lib/scheduling'

// Lead-detail card: the lead's current follow-up call plus their complete
// scheduling history (every booking, reschedule, cancellation and outcome).
export default function AppointmentCard({ leadId }: { leadId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Slot picker (book / reschedule)
  const [pickerMode, setPickerMode] = useState<'book' | 'reschedule' | null>(null)
  const [days, setDays] = useState<SlotDay[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [customTime, setCustomTime] = useState('')

  // Cancel flow
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments?lead_id=${leadId}`)
      if (!res.ok) throw new Error()
      const data: Appointment[] = await res.json()
      setAppointments(data)
    } catch {
      setError('Could not load appointments')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => {
    load()
  }, [load])

  const now = Date.now()
  const booked = appointments.filter((a) => a.status === 'booked')
  const current =
    booked.find((a) => new Date(a.starts_at).getTime() >= now) ||
    booked.sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ||
    null
  const history = [...appointments].sort((a, b) => b.created_at.localeCompare(a.created_at))

  async function openPicker(mode: 'book' | 'reschedule') {
    setPickerMode(mode)
    setSlotsLoading(true)
    setError('')
    try {
      const res = await fetch('/api/public/slots')
      const data = await res.json()
      setDays(data.days || [])
      setSelectedDate(data.days?.[0]?.date || '')
    } catch {
      setError('Could not load open slots')
    } finally {
      setSlotsLoading(false)
    }
  }

  async function book(startsAtIso: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          starts_at: startsAtIso,
          ...(pickerMode === 'reschedule' && current ? { rescheduled_from: current.id } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not book')
        if (data.code === 'slot_taken' || data.code === 'slot_unavailable') openPicker(pickerMode || 'book')
        return
      }
      setPickerMode(null)
      setCustomTime('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function patch(id: string, status: 'cancelled' | 'completed' | 'no_show', reason?: string) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Update failed')
        return
      }
      setCancelOpen(false)
      setCancelReason('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition disabled:opacity-50'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-[#1A1A1A]">Follow-Up Call</h3>
        {!current && !pickerMode && (
          <button onClick={() => openPicker('book')} disabled={busy} className={`${btn} bg-[#C4956A] text-white hover:bg-[#a87a54]`}>
            <CalendarPlus size={14} /> Book a call
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[#6B6B6B]">Loading...</p>
      ) : (
        <>
          {/* Current appointment */}
          {current ? (
            <div className="rounded-xl bg-[#FAFAF8] border border-[#EDE9E3] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck size={16} className="text-[#C4956A]" />
                    <p className="text-sm font-semibold text-[#1A1A1A]">{formatFullEt(new Date(current.starts_at))}</p>
                  </div>
                  <p className="text-xs text-[#6B6B6B] mt-1.5">
                    Booked via {current.booked_via === 'website' ? 'the website' : 'the CRM'}
                    {new Date(current.starts_at).getTime() < now && ' · time has passed — record the outcome below'}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <span className={`inline-flex items-center gap-1 ${current.confirmation_sent_at ? 'text-green-700' : 'text-[#6B6B6B]'}`}>
                      <Mail size={12} /> Confirmation {current.confirmation_sent_at ? 'sent' : 'not sent'}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${current.reminder_sent_at ? 'text-green-700' : 'text-[#6B6B6B]'}`}>
                      <Clock size={12} /> Reminder {current.reminder_sent_at ? 'sent' : 'pending'}
                    </span>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${APPOINTMENT_STATUS_CONFIG[current.status].color}`}>
                  {APPOINTMENT_STATUS_CONFIG[current.status].label}
                </span>
              </div>

              {!pickerMode && !cancelOpen && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => patch(current.id, 'completed')} disabled={busy} className={`${btn} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}>
                    <Check size={14} /> Completed
                  </button>
                  <button onClick={() => patch(current.id, 'no_show')} disabled={busy} className={`${btn} bg-red-100 text-red-800 hover:bg-red-200`}>
                    <Ban size={14} /> No-show
                  </button>
                  <button onClick={() => openPicker('reschedule')} disabled={busy} className={`${btn} bg-gray-100 text-[#1A1A1A] hover:bg-gray-200`}>
                    <RotateCcw size={14} /> Reschedule
                  </button>
                  <button onClick={() => setCancelOpen(true)} disabled={busy} className={`${btn} text-red-600 hover:bg-red-50`}>
                    <X size={14} /> Cancel
                  </button>
                </div>
              )}

              {cancelOpen && (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => patch(current.id, 'cancelled', cancelReason)} disabled={busy} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>
                      Confirm cancel
                    </button>
                    <button onClick={() => { setCancelOpen(false); setCancelReason('') }} className={`${btn} bg-gray-100 text-[#6B6B6B]`}>
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            !pickerMode && <p className="text-sm text-[#6B6B6B]">No follow-up call scheduled.</p>
          )}

          {/* Slot picker */}
          {pickerMode && (
            <div className="mt-4 rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-[#1A1A1A]">
                  {pickerMode === 'reschedule' ? 'Pick a new time' : 'Pick a time'} <span className="text-xs text-[#6B6B6B]">(Eastern)</span>
                </p>
                <button onClick={() => setPickerMode(null)} className="text-xs text-[#6B6B6B] hover:text-[#1A1A1A]">Close</button>
              </div>

              {slotsLoading ? (
                <p className="text-sm text-[#6B6B6B]">Loading open slots...</p>
              ) : days.length === 0 ? (
                <p className="text-sm text-[#6B6B6B]">No published open slots in the next two weeks. Use a custom time below.</p>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {days.map((d) => (
                      <button
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className={`shrink-0 px-3 py-1.5 text-xs rounded-lg border transition ${
                          selectedDate === d.date ? 'bg-[#C4956A] text-white border-transparent' : 'bg-white border-gray-200 text-[#6B6B6B] hover:border-gray-300'
                        }`}
                      >
                        {d.label.replace(/^(\w{3})\w*, (\w{3})\w* (\d+)$/, '$1 $2 $3')}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                    {days.find((d) => d.date === selectedDate)?.slots.map((s) => (
                      <button
                        key={s.start}
                        onClick={() => book(s.start)}
                        disabled={busy}
                        className="px-2 py-2 text-xs rounded-lg border border-gray-200 bg-white hover:border-[#C4956A] hover:text-[#C4956A] transition disabled:opacity-50"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100">
                <label className="block text-xs font-medium text-[#6B6B6B] uppercase tracking-wide mb-1.5">
                  Or a custom time (your local time)
                </label>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
                  />
                  <button
                    onClick={() => customTime && book(new Date(customTime).toISOString())}
                    disabled={busy || !customTime}
                    className={`${btn} bg-[#C4956A] text-white hover:bg-[#a87a54]`}
                  >
                    Book
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          {/* History */}
          {history.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium text-[#6B6B6B] uppercase tracking-wide mb-2">Scheduling history</p>
              <ul className="space-y-2">
                {history.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[#1A1A1A] font-medium">{formatFullEt(new Date(a.starts_at))}</p>
                      <p className="text-[#6B6B6B]">
                        {a.booked_via === 'website' ? 'Booked by prospect' : 'Booked by staff'} ·{' '}
                        {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {a.rescheduled_from && ' · rescheduled'}
                        {a.status === 'cancelled' && a.cancel_reason && a.cancel_reason !== 'rescheduled' && ` · ${a.cancel_reason}`}
                      </p>
                    </div>
                    <span className={`shrink-0 font-medium px-2 py-0.5 rounded-full ${APPOINTMENT_STATUS_CONFIG[a.status].color}`}>
                      {a.status === 'cancelled' && a.cancel_reason === 'rescheduled' ? 'Rescheduled' : APPOINTMENT_STATUS_CONFIG[a.status].label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {/* keep formatTimeLabel referenced for tree-shaking parity with the list page */}
      <span className="hidden">{current ? formatTimeLabel(new Date(current.starts_at)) : ''}</span>
    </div>
  )
}
