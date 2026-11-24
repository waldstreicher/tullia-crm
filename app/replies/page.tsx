'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail, CheckCircle2, RotateCcw, Paperclip, UserRound } from 'lucide-react'
import AppLayout from '@/components/AppLayout'

interface Reply {
  id: string
  received_at: string
  from_email: string
  from_name: string | null
  subject: string | null
  text_body: string | null
  lead_id: string | null
  handled_at: string | null
  handled_by: string | null
  attachment_count: number
  leads: { first_name: string; last_name: string } | null
}

// Replies prospects sent to the automated emails from consults@. Staff read
// them here (the emails themselves say "do not reply"), call the prospect back,
// and mark each one handled.
export default function RepliesPageWrapper() {
  return (
    <Suspense>
      <RepliesPage />
    </Suspense>
  )
}

function RepliesPage() {
  const params = useSearchParams()
  const [view, setView] = useState<'new' | 'handled'>('new')
  const [replies, setReplies] = useState<Reply[]>([])
  const [activeId, setActiveId] = useState<string>(params.get('id') || '')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/replies?view=${view}`)
      if (!res.ok) throw new Error('Could not load replies')
      setReplies(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load replies')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    load()
  }, [load])

  // A link from the notice email may point at a handled reply; switch views to show it.
  useEffect(() => {
    if (!loading && activeId && view === 'new' && !replies.some((r) => r.id === activeId) && params.get('id') === activeId) {
      setView('handled')
    }
  }, [loading, activeId, view, replies, params])

  const active = replies.find((r) => r.id === activeId) || null

  async function setHandled(handled: boolean) {
    if (!active) return
    setBusy(true)
    try {
      await fetch(`/api/replies/${active.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handled }),
      })
      setActiveId('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const who = (r: Reply) => (r.leads ? `${r.leads.first_name} ${r.leads.last_name}` : r.from_name || r.from_email)

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-[#1A1A1A]">Email Replies</h1>
            <p className="text-sm text-[#6B6B6B] mt-1">
              Replies prospects sent to the automated emails from consults@tumescentlipolysis.com. Follow up, then mark each one handled.
            </p>
          </div>
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1">
            {(['new', 'handled'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setView(v); setActiveId('') }}
                className={`px-3 py-1.5 text-sm rounded-lg transition capitalize ${view === v ? 'bg-[#C4956A] text-white' : 'text-[#6B6B6B] hover:bg-gray-100'}`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <p className="p-6 text-sm text-[#6B6B6B]">Loading...</p>
            ) : replies.length === 0 ? (
              <p className="p-6 text-sm text-[#6B6B6B]">{view === 'new' ? 'No new replies.' : 'Nothing handled yet.'}</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[calc(100vh-12rem)] overflow-y-auto">
                {replies.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setActiveId(r.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-[#FAFAF8] transition ${activeId === r.id ? 'bg-[#FAFAF8]' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#1A1A1A] truncate">{who(r)}</span>
                        <span className="text-xs text-[#6B6B6B] shrink-0">{fmt(r.received_at)}</span>
                      </div>
                      <p className="text-xs text-[#6B6B6B] mt-0.5 truncate">{r.subject || '(no subject)'}</p>
                      <p className="text-sm text-[#1A1A1A] mt-1 line-clamp-2">{r.text_body || <span className="text-gray-400">(empty message)</span>}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col max-h-[calc(100vh-12rem)]">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-sm text-[#6B6B6B] p-10">
                <span className="inline-flex items-center gap-2"><Mail size={16} /> Select a reply</span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{active.subject || '(no subject)'}</p>
                    <p className="text-xs text-[#6B6B6B] mt-1">
                      From {active.from_name ? `${active.from_name} ` : ''}&lt;{active.from_email}&gt; · {fmt(active.received_at)}
                      {active.attachment_count > 0 && (
                        <span className="inline-flex items-center gap-1 ml-2"><Paperclip size={11} /> {active.attachment_count} attachment{active.attachment_count === 1 ? '' : 's'} (open in Resend)</span>
                      )}
                    </p>
                    {active.lead_id ? (
                      <Link href={`/leads/${active.lead_id}`} className="inline-flex items-center gap-1 text-xs text-[#C4956A] hover:underline mt-1.5">
                        <UserRound size={12} /> Open lead{active.leads ? `: ${active.leads.first_name} ${active.leads.last_name}` : ''}
                      </Link>
                    ) : (
                      <p className="text-xs text-amber-700 mt-1.5">No lead matches this sender&apos;s email address.</p>
                    )}
                    {active.handled_at && (
                      <p className="text-xs text-green-700 mt-1.5">Handled by {active.handled_by} {fmt(active.handled_at)}</p>
                    )}
                  </div>
                  {active.handled_at ? (
                    <button onClick={() => setHandled(false)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-[#1A1A1A] hover:bg-gray-200 transition disabled:opacity-50">
                      <RotateCcw size={14} /> Move back to New
                    </button>
                  ) : (
                    <button onClick={() => setHandled(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1A1A1A] text-white hover:bg-black transition disabled:opacity-50">
                      <CheckCircle2 size={14} /> Mark handled
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#1A1A1A]">{active.text_body || '(empty message)'}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
