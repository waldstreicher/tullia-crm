'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save, CalendarClock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { AvailabilityRule, AvailabilityOverride } from '@/lib/types'
import { normalizeTime, etDateStr, formatDateLabel, type SlotDay } from '@/lib/scheduling'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
type Window = { start: string; end: string }
type OverrideKind = 'block_day' | 'block_window' | 'open_window'

export default function AvailabilityPage() {
  const [owner, setOwner] = useState('')
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Weekly rules, as windows per weekday
  const [week, setWeek] = useState<Record<number, Window[]>>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')

  // Overrides
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([])
  const [ovDate, setOvDate] = useState('')
  const [ovKind, setOvKind] = useState<OverrideKind>('block_day')
  const [ovStart, setOvStart] = useState('09:00')
  const [ovEnd, setOvEnd] = useState('17:00')
  const [ovNote, setOvNote] = useState('')
  const [ovBusy, setOvBusy] = useState(false)

  // Preview of what the website will show
  const [preview, setPreview] = useState<SlotDay[]>([])

  const loadPreview = useCallback(async () => {
    try {
      const res = await fetch('/api/public/slots')
      const data = await res.json()
      setPreview(data.days || [])
    } catch {
      /* preview is best-effort */
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/availability')
      if (!res.ok) throw new Error()
      const data: { owner: string; can_edit: boolean; rules: AvailabilityRule[]; overrides: AvailabilityOverride[] } = await res.json()
      setOwner(data.owner)
      setCanEdit(data.can_edit)
      const w: Record<number, Window[]> = {}
      for (const r of data.rules) {
        ;(w[r.weekday] ||= []).push({ start: normalizeTime(r.start_time), end: normalizeTime(r.end_time) })
      }
      setWeek(w)
      setOverrides(data.overrides)
      setDirty(false)
    } catch {
      setError('Could not load availability')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    loadPreview()
  }, [load, loadPreview])

  function updateWindow(day: number, i: number, field: keyof Window, value: string) {
    setWeek((prev) => {
      const list = [...(prev[day] || [])]
      list[i] = { ...list[i], [field]: value }
      return { ...prev, [day]: list }
    })
    setDirty(true)
  }
  function addWindow(day: number) {
    setWeek((prev) => ({ ...prev, [day]: [...(prev[day] || []), { start: '09:00', end: '17:00' }] }))
    setDirty(true)
  }
  function removeWindow(day: number, i: number) {
    setWeek((prev) => ({ ...prev, [day]: (prev[day] || []).filter((_, j) => j !== i) }))
    setDirty(true)
  }
  function applyWeekdayPreset() {
    const w: Record<number, Window[]> = {}
    for (const d of [1, 2, 3, 4, 5]) w[d] = [{ start: '09:00', end: '17:00' }]
    setWeek(w)
    setDirty(true)
  }

  async function saveWeek() {
    setSaving(true)
    setError('')
    try {
      const rules = Object.entries(week).flatMap(([day, list]) =>
        list.map((win) => ({ weekday: Number(day), start_time: win.start, end_time: win.end }))
      )
      const res = await fetch('/api/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, rules }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Save failed')
        return
      }
      setDirty(false)
      setSavedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
      loadPreview()
    } finally {
      setSaving(false)
    }
  }

  async function addOverride(e: React.FormEvent) {
    e.preventDefault()
    if (!ovDate) return
    setOvBusy(true)
    setError('')
    try {
      const whole = ovKind === 'block_day'
      const res = await fetch('/api/availability/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          date: ovDate,
          kind: ovKind === 'open_window' ? 'open' : 'block',
          start_time: whole ? null : ovStart,
          end_time: whole ? null : ovEnd,
          note: ovNote,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not add')
        return
      }
      setOvDate('')
      setOvNote('')
      await load()
      loadPreview()
    } finally {
      setOvBusy(false)
    }
  }

  async function removeOverride(id: string) {
    setOvBusy(true)
    try {
      await fetch(`/api/availability/overrides/${id}`, { method: 'DELETE' })
      await load()
      loadPreview()
    } finally {
      setOvBusy(false)
    }
  }

  const today = etDateStr(new Date())
  const upcomingOverrides = overrides.filter((o) => o.date >= today)
  const inputClass = 'px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 bg-[#FAFAF8] text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#C4956A] disabled:opacity-60'

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Availability</h1>
            <p className="text-sm text-[#6B6B6B] mt-1">
              The 30-minute follow-up call slots published on the website · Eastern time
            </p>
          </div>
          {canEdit && (
            <button
              onClick={saveWeek}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#C4956A] text-white text-sm font-medium rounded-xl hover:bg-[#a87a54] transition disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving...' : dirty ? 'Save weekly hours' : savedAt ? `Saved ${savedAt}` : 'Saved'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#6B6B6B]">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              {!canEdit && (
                <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
                  You're viewing <span className="font-medium">{owner}</span>'s calendar. Only that account (or an admin) can change it.
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}

              {/* Weekly hours */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1A1A]">Weekly hours</h3>
                    <p className="text-xs text-[#6B6B6B] mt-0.5">Calendar for {owner}</p>
                  </div>
                  {canEdit && (
                    <button onClick={applyWeekdayPreset} className="text-xs text-[#C4956A] hover:underline">
                      Set Mon–Fri 9:00–5:00
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {WEEKDAYS.map((name, day) => {
                    const list = week[day] || []
                    return (
                      <div key={day} className="flex flex-wrap items-start gap-3">
                        <div className="w-24 pt-1.5 text-sm font-medium text-[#1A1A1A]">{name}</div>
                        <div className="flex-1 space-y-2">
                          {list.length === 0 && <p className="text-sm text-gray-400 pt-1.5">Unavailable</p>}
                          {list.map((win, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <input type="time" value={win.start} disabled={!canEdit} onChange={(e) => updateWindow(day, i, 'start', e.target.value)} className={inputClass} />
                              <span className="text-xs text-[#6B6B6B]">to</span>
                              <input type="time" value={win.end} disabled={!canEdit} onChange={(e) => updateWindow(day, i, 'end', e.target.value)} className={inputClass} />
                              {canEdit && (
                                <button onClick={() => removeWindow(day, i)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" aria-label="Remove window">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))}
                          {canEdit && (
                            <button onClick={() => addWindow(day)} className="inline-flex items-center gap-1 text-xs text-[#C4956A] hover:underline">
                              <Plus size={12} /> Add hours
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Overrides */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-1 pb-3 border-b border-gray-100">Days off &amp; exceptions</h3>
                <p className="text-xs text-[#6B6B6B] mt-3 mb-4">Block a whole day or part of one, or open extra hours on a specific date.</p>

                {canEdit && (
                  <form onSubmit={addOverride} className="flex flex-wrap items-end gap-3 mb-5">
                    <div>
                      <label className="block text-xs text-[#6B6B6B] mb-1">Date</label>
                      <input type="date" value={ovDate} min={today} onChange={(e) => setOvDate(e.target.value)} required className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs text-[#6B6B6B] mb-1">Type</label>
                      <select value={ovKind} onChange={(e) => setOvKind(e.target.value as OverrideKind)} className={inputClass}>
                        <option value="block_day">Block whole day</option>
                        <option value="block_window">Block a time window</option>
                        <option value="open_window">Open extra hours</option>
                      </select>
                    </div>
                    {ovKind !== 'block_day' && (
                      <>
                        <div>
                          <label className="block text-xs text-[#6B6B6B] mb-1">From</label>
                          <input type="time" value={ovStart} onChange={(e) => setOvStart(e.target.value)} className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-xs text-[#6B6B6B] mb-1">To</label>
                          <input type="time" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} className={inputClass} />
                        </div>
                      </>
                    )}
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs text-[#6B6B6B] mb-1">Note (optional)</label>
                      <input type="text" value={ovNote} onChange={(e) => setOvNote(e.target.value)} placeholder="e.g. Vacation" className={`${inputClass} w-full`} />
                    </div>
                    <button type="submit" disabled={ovBusy || !ovDate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1A1A1A] text-white text-sm rounded-lg hover:bg-black transition disabled:opacity-50">
                      <Plus size={14} /> Add
                    </button>
                  </form>
                )}

                {upcomingOverrides.length === 0 ? (
                  <p className="text-sm text-gray-400">No upcoming exceptions.</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {upcomingOverrides.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                        <div className="text-sm">
                          <span className="font-medium text-[#1A1A1A]">{formatDateLabel(o.date)}</span>
                          <span className="text-[#6B6B6B]">
                            {' · '}
                            {o.kind === 'block'
                              ? o.start_time
                                ? `Blocked ${normalizeTime(o.start_time)}–${normalizeTime(o.end_time || '')}`
                                : 'Day off'
                              : `Extra hours ${normalizeTime(o.start_time || '')}–${normalizeTime(o.end_time || '')}`}
                            {o.note && ` · ${o.note}`}
                          </span>
                        </div>
                        {canEdit && (
                          <button onClick={() => removeOverride(o.id)} disabled={ovBusy} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50" aria-label="Remove">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 h-fit">
              <div className="flex items-center gap-2 mb-1 pb-3 border-b border-gray-100">
                <CalendarClock size={16} className="text-[#C4956A]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">What prospects see</h3>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-3 mb-4">
                Open slots in the next 14 days (booking opens tomorrow). Already-booked times are excluded.
              </p>
              {preview.length === 0 ? (
                <p className="text-sm text-gray-400">No open slots — set weekly hours and save.</p>
              ) : (
                <ul className="space-y-1.5">
                  {preview.map((d) => (
                    <li key={d.date} className="flex items-center justify-between text-sm">
                      <span className="text-[#1A1A1A]">{d.label}</span>
                      <span className="text-xs font-medium text-[#6B6B6B]">
                        {d.slots.length} slot{d.slots.length === 1 ? '' : 's'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
