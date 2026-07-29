'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import { ShieldCheck, Eye, User as UserIcon } from 'lucide-react'
import type { Role } from '@/lib/roles'

interface TeamMember {
  id: string
  email: string
  name: string
  role: Role
  isAdmin: boolean
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/team')
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? 'You do not have access to team management.'
            : 'Failed to load team'
        )
      }
      setMembers(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function setRole(member: TeamMember, role: Role) {
    if (member.role === role || savingId) return
    setSavingId(member.id)
    setError('')
    setMembers((prev) => prev.map((x) => (x.id === member.id ? { ...x, role } : x)))
    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.id, role }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setMembers((prev) => prev.map((x) => (x.id === member.id ? { ...x, role: member.role } : x)))
      setError('Failed to update role. Please try again.')
    } finally {
      setSavingId('')
    }
  }

  const roleButtons: [Role, string, React.ElementType][] = [
    ['user', 'User', UserIcon],
    ['observer', 'Observer', Eye],
  ]

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Team</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">
            Manage who can add and edit leads (User) versus see the dashboard only (Observer).
          </p>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-[#6B6B6B]">Loading team...</div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center text-[#6B6B6B]">No accounts found</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1A1A1A] truncate">{m.name}</p>
                    <p className="text-xs text-[#6B6B6B] truncate">{m.email}</p>
                  </div>

                  {m.isAdmin ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C4956A] bg-[#C4956A]/10 px-3 py-1.5 rounded-full shrink-0">
                      <ShieldCheck size={14} /> Admin
                    </span>
                  ) : (
                    <div className="flex gap-1 bg-gray-100 rounded-xl p-1 shrink-0">
                      {roleButtons.map(([r, label, Icon]) => (
                        <button
                          key={r}
                          disabled={savingId === m.id}
                          onClick={() => setRole(m, r)}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-60 ${
                            m.role === r
                              ? 'bg-white shadow-sm text-[#1A1A1A]'
                              : 'text-[#6B6B6B] hover:text-[#1A1A1A]'
                          }`}
                        >
                          <Icon size={14} /> {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-[#6B6B6B] mt-4">
          Admins are set via the <code className="text-[#1A1A1A]">ADMIN_EMAILS</code> environment
          variable and always have full access. Role changes take effect the next time that person
          signs in.
        </p>
      </div>
    </AppLayout>
  )
}
