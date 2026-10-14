'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, Check, Ban, X, Mail, Clock } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { Appointment, APPOINTMENT_STATUS_CONFIG } from '@/lib/types'
import { etDateStr, formatDateLabel, formatTimeLabel } from '@/lib/scheduling'

type View = 'upcoming' | 'today' | 'past' | 'all'

export default function AppointmentsPage() {
  const [view, setView] = useState<View>('upcoming')
  const [items, setItems] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams()
      const nowIso = new Date().toISOString()
      if (view === 'upcoming') {
        p.set('from', nowIso)
        p.set('status', 'booked')
      } else if (view === 'past') {
        p.set('to', nowIso)
      }
      const res = await fetch(`/api/appointments?${p.toString()}`)
      if (!res.ok) throw new Error()
      let data: Appointment[] = await res.json()
      if (view === 'today') {
        const today = etDateStr(new Date())
        data = data.filter((a) => etDateStr(new Date(a.starts_at)) === today)
      }
      if (view === 'past') data = data.reverse()
      setItems(data)
    } catch {
      setError('Could not load appointments')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: string, status: 'cancelled' | 'completed' | 'no_show') {
    if (status === 'cancelled' && !confirm('Cancel this call? The prospect will not be notified automatically.')) return
    setBusyId(id)
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Update failed')
      }
      await load()
    } finally {
      setBusyId('')
    }
  }

  // Group by Eastern calendar date.
  const groups: { date: string; items: Appointment[] }[] = []
  for (const a of items) {
    const date = etDateStr(new Date(a.starts_at))
    const g = groups[groups.length - 1]
    if (g && g.date === date) g.items.push(a)
    else groups.push({ date, items: [a] })
  }

  const tab = (v: View, label: string) => (
    <button
      key={v}
      onClick={() => setView(v)}
      className={`px-3 py-1.5 text-sm rounded-lg transition ${
        view === v ? 'bg-[#C4956A] text-white' : 'text-[#6B6B6B] hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
  const act = 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition disabled:opacity-50'

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Appointments</h1>
            <p className="text-sm text-[#6B6B6B] mt-1">Follow-up calls booked by prospects and staff · times in Eastern</p>
          </div>
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
            {tab('upcoming', 'Upcoming')}
            {tab('today', 'Today')}
            {tab('past', 'Past')}
            {tab('all', 'All')}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <div className="p-12 text-center text-[#6B6B6B]">Loading...</div>
        ) : groups.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-[#6B6B6B]">
            No appointments {view === 'upcoming' ? 'coming up' : view === 'today' ? 'today' : 'found'}.
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <div key={g.date}>
                <h2 className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-wide mb-2">
                  {formatDateLabel(g.date)}
                  {g.date === etDateStr(new Date()) && <span className="ml-2 text-orange-600">Today</span>}
                </h2>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                  {g.items.map((a) => {
                    const lead = a.leads
                    const conf = APPOINTMENT_STATUS_CONFIG[a.status]
                    return (
                      <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="w-20 shrink-0 text-sm font-semibold text-[#1A1A1A]">{formatTimeLabel(new Date(a.starts_at))}</div>
                        <div className="flex-1 min-w-[180px]">
                          {lead ? (
                            <Link href={`/leads/${a.lead_id}`} className="text-sm font-medium text-[#1A1A1A] hover:text-[#C4956A]">
                              {lead.first_name} {lead.last_name}
                            </Link>
                          ) : (
                            <span className="text-sm text-[#6B6B6B]">Lead removed</span>
                          )}
                          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-[#6B6B6B]">
                            {lead?.phone && (
                              <a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 text-green-700 hover:underline">
                                <Phone size={11} /> {lead.phone}
                              </a>
                            )}
                            <span>via {a.booked_via === 'website' ? 'website' : 'CRM'}</span>
                            <span className={`inline-flex items-center gap-1 ${a.confirmation_sent_at ? 'text-green-700' : ''}`}>
                              <Mail size={11} /> {a.confirmation_sent_at ? 'confirmed' : 'no confirmation'}
                            </span>
                            {a.reminder_sent_at && (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <Clock size={11} /> reminded
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${conf.color}`}>
                          {a.status === 'cancelled' && a.cancel_reason === 'rescheduled' ? 'Rescheduled' : conf.label}
                        </span>
                        {a.status === 'booked' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => patch(a.id, 'completed')} disabled={busyId === a.id} className={`${act} bg-emerald-100 text-emerald-800 hover:bg-emerald-200`}>
                              <Check size={12} /> Done
                            </button>
                            <button onClick={() => patch(a.id, 'no_show')} disabled={busyId === a.id} className={`${act} bg-red-100 text-red-800 hover:bg-red-200`}>
                              <Ban size={12} /> No-show
                            </button>
                            <button onClick={() => patch(a.id, 'cancelled')} disabled={busyId === a.id} className={`${act} text-red-600 hover:bg-red-50`}>
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
