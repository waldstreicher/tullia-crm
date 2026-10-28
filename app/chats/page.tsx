'use client'

import { useCallback, useEffect, useState } from 'react'
import { Flag, CheckCircle2, MessageSquare, Bot, User } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import { ChatSession, ChatMessage } from '@/lib/types'

type SessionRow = ChatSession & { preview: string }

// Admin-only review of website chatbot conversations: read transcripts, flag
// inaccurate answers with a note (feeds corrections to the knowledge doc), and
// mark sessions reviewed.
export default function ChatsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [activeId, setActiveId] = useState<string>('')
  const [active, setActive] = useState<{ session: ChatSession; messages: ChatMessage[] } | null>(null)
  const [flagging, setFlagging] = useState<string>('') // message id with the note box open
  const [flagNote, setFlagNote] = useState('')
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/chats?limit=200${onlyFlagged ? '&flagged=1' : ''}`)
      if (res.status === 403) throw new Error('Admins only')
      if (!res.ok) throw new Error('Could not load chats')
      setSessions(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load chats')
    } finally {
      setLoading(false)
    }
  }, [onlyFlagged])

  const loadOne = useCallback(async (id: string) => {
    const res = await fetch(`/api/chats/${id}`)
    if (res.ok) setActive(await res.json())
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])
  useEffect(() => {
    if (activeId) loadOne(activeId)
  }, [activeId, loadOne])

  async function setFlag(messageId: string, flagged: boolean) {
    if (!activeId) return
    setBusy(true)
    try {
      await fetch(`/api/chats/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: messageId, flagged, flag_note: flagNote }),
      })
      setFlagging('')
      setFlagNote('')
      await loadOne(activeId)
      await loadList()
    } finally {
      setBusy(false)
    }
  }

  async function markReviewed() {
    if (!activeId) return
    setBusy(true)
    try {
      await fetch(`/api/chats/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true }),
      })
      await loadOne(activeId)
      await loadList()
    } finally {
      setBusy(false)
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const cost = (m: ChatMessage) => {
    // Claude Opus 5.5 list pricing: $4/M input, $0.20/M cache read, $20/M output.
    const inp = (m.input_tokens ?? 0) * 4 + (m.cache_read_tokens ?? 0) * 0.2 + (m.output_tokens ?? 0) * 20
    return inp / 1_000_000
  }
  const sessionCost = active ? active.messages.reduce((n, m) => n + cost(m), 0) : 0

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Website Chats</h1>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Conversations with the TuLi Assistant. Flag any inaccurate answer and note what it should have said.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-[#6B6B6B] cursor-pointer">
            <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="rounded border-gray-300 text-[#C4956A] focus:ring-[#C4956A]" />
            Flagged only
          </label>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Session list */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-[#6B6B6B]">Loading...</p>
            ) : sessions.length === 0 ? (
              <p className="p-6 text-sm text-[#6B6B6B]">No conversations yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setActiveId(s.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF8] transition ${activeId === s.id ? 'bg-[#FAFAF8]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-[#6B6B6B]">{fmt(s.last_message_at)}</span>
                        <span className="flex items-center gap-1.5">
                          {s.flagged && <Flag size={12} className="text-red-500" />}
                          {s.reviewed_at && <CheckCircle2 size={12} className="text-green-600" />}
                          <span className="text-[10px] text-[#6B6B6B]">{Math.floor(s.message_count / 2)} turns{s.language ? ` · ${s.language}` : ''}</span>
                        </span>
                      </div>
                      <p className="text-sm text-[#1A1A1A] mt-1 line-clamp-2">{s.preview || <span className="text-gray-400">(no message)</span>}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Transcript */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[calc(100vh-12rem)]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#6B6B6B] p-10">
                <span className="inline-flex items-center gap-2"><MessageSquare size={16} /> Select a conversation</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="text-xs text-[#6B6B6B]">
                    Started {fmt(active.session.created_at)}
                    {active.session.page && ` · ${active.session.page}`}
                    {` · est. $${sessionCost.toFixed(3)}`}
                    {active.session.reviewed_at && (
                      <span className="ml-2 text-green-700">Reviewed by {active.session.reviewed_by} {fmt(active.session.reviewed_at)}</span>
                    )}
                  </div>
                  {!active.session.reviewed_at && (
                    <button onClick={markReviewed} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-[#1A1A1A] hover:bg-gray-200 transition disabled:opacity-50">
                      <CheckCircle2 size={14} /> Mark reviewed
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {active.messages.map((m) => (
                    <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? '' : ''}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-[#C4956A]/15 text-[#C4956A]'}`}>
                        {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-medium text-[#1A1A1A]">{m.role === 'user' ? 'Visitor' : 'Assistant'}</span>
                          <span className="text-[10px] text-[#6B6B6B]">{fmt(m.created_at)}</span>
                          {m.role === 'assistant' && m.latency_ms != null && (
                            <span className="text-[10px] text-[#6B6B6B]">{(m.latency_ms / 1000).toFixed(1)}s · {m.output_tokens ?? 0} tok{m.stop_reason && m.stop_reason !== 'end_turn' ? ` · ${m.stop_reason}` : ''}</span>
                          )}
                        </div>
                        <p className={`text-sm mt-1 leading-relaxed whitespace-pre-wrap rounded-xl p-3 ${m.flagged ? 'bg-red-50 border border-red-200' : m.role === 'user' ? 'bg-blue-50/60' : 'bg-[#FAFAF8]'}`}>
                          {m.content}
                        </p>
                        {m.role === 'assistant' && (
                          <div className="mt-1.5">
                            {m.flagged ? (
                              <div className="text-xs text-red-700">
                                <span className="font-medium">Flagged by {m.flagged_by}</span>
                                {m.flag_note && <span> — {m.flag_note}</span>}
                                <button onClick={() => setFlag(m.id, false)} disabled={busy} className="ml-2 underline text-[#6B6B6B] hover:text-[#1A1A1A]">unflag</button>
                              </div>
                            ) : flagging === m.id ? (
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  autoFocus
                                  type="text"
                                  value={flagNote}
                                  onChange={(e) => setFlagNote(e.target.value)}
                                  placeholder="What should it have said? (optional)"
                                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#C4956A]"
                                />
                                <div className="flex gap-1.5">
                                  <button onClick={() => setFlag(m.id, true)} disabled={busy} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Flag</button>
                                  <button onClick={() => { setFlagging(''); setFlagNote('') }} className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-[#6B6B6B]">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setFlagging(m.id)} className="inline-flex items-center gap-1 text-xs text-[#6B6B6B] hover:text-red-600">
                                <Flag size={11} /> Flag as inaccurate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
