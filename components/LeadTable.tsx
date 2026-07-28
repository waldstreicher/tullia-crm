'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Lead, PipelineStage, Priority, STAGE_CONFIG } from '@/lib/types'
import { createClient } from '@/lib/supabase-browser'

type SortField = 'created_at' | 'first_name' | 'stage' | 'priority' | 'next_follow_up_date'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-green-600',
}

export default function LeadTable() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [filtered, setFiltered] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<PipelineStage | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [assignedFilter, setAssignedFilter] = useState('')

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Unique assigned_to values
  const [assignees, setAssignees] = useState<string[]>([])

  // Current user + assignable-user name map (for "my leads first" + display)
  const [currentEmail, setCurrentEmail] = useState('')
  const [userMap, setUserMap] = useState<Record<string, string>>({})

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setCurrentEmail(data.user?.email || ''))
      .catch(() => {})
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((us: { email: string; name: string }[]) => {
        const map: Record<string, string> = {}
        for (const u of us) map[u.email] = u.name
        setUserMap(map)
      })
      .catch(() => {})
  }, [])

  const userName = (email?: string) => (email ? userMap[email] || email : '')

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (stageFilter) params.set('stage', stageFilter)
      if (priorityFilter) params.set('priority', priorityFilter)
      if (assignedFilter) params.set('assigned_to', assignedFilter)
      if (search) params.set('search', search)

      const res = await fetch(`/api/leads?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data: Lead[] = await res.json()
      setLeads(data)

      // Collect unique assignees
      const seen = new Set<string>()
      const unique: string[] = []
      for (const l of data) {
        if (l.assigned_to && !seen.has(l.assigned_to)) {
          seen.add(l.assigned_to)
          unique.push(l.assigned_to)
        }
      }
      setAssignees(unique)
    } catch {
      setError('Failed to load leads')
    } finally {
      setLoading(false)
    }
  }, [stageFilter, priorityFilter, assignedFilter, search])

  useEffect(() => {
    const timer = setTimeout(fetchLeads, 300)
    return () => clearTimeout(timer)
  }, [fetchLeads])

  // Sort
  useEffect(() => {
    const sorted = [...leads].sort((a, b) => {
      let aVal: string | number = ''
      let bVal: string | number = ''

      if (sortField === 'created_at') {
        aVal = a.created_at
        bVal = b.created_at
      } else if (sortField === 'first_name') {
        aVal = `${a.first_name} ${a.last_name}`
        bVal = `${b.first_name} ${b.last_name}`
      } else if (sortField === 'stage') {
        aVal = a.stage
        bVal = b.stage
      } else if (sortField === 'priority') {
        aVal = PRIORITY_ORDER[a.priority]
        bVal = PRIORITY_ORDER[b.priority]
      } else if (sortField === 'next_follow_up_date') {
        aVal = a.next_follow_up_date || '9999'
        bVal = b.next_follow_up_date || '9999'
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    // Float the signed-in user's assigned leads to the top (stable within groups).
    if (currentEmail) {
      const mine = (l: Lead) => (l.assigned_to === currentEmail ? 0 : 1)
      sorted.sort((a, b) => mine(a) - mine(b))
    }
    setFiltered(sorted)
  }, [leads, sortField, sortDir, currentEmail])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp size={14} className="text-gray-300" />
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="text-[#C4956A]" />
    ) : (
      <ChevronDown size={14} className="text-[#C4956A]" />
    )
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const stageOptions = Object.entries(STAGE_CONFIG) as [PipelineStage, { label: string; color: string }][]

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:border-transparent"
          />
        </div>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as PipelineStage | '')}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A] text-[#1A1A1A]"
        >
          <option value="">All Stages</option>
          {stageOptions.map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as Priority | '')}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A] text-[#1A1A1A]"
        >
          <option value="">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {assignees.length > 0 && (
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-xl border border-gray-200 bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#C4956A] text-[#1A1A1A]"
          >
            <option value="">All Assignees</option>
            {assignees.map((a) => (
              <option key={a} value={a}>{userName(a)}</option>
            ))}
          </select>
        )}

        <span className="self-center text-sm text-[#6B6B6B]">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="p-12 text-center text-[#6B6B6B]">Loading leads...</div>
      ) : error ? (
        <div className="p-12 text-center text-red-500">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center text-[#6B6B6B]">No leads found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">
                  <button onClick={() => handleSort('first_name')} className="flex items-center gap-1 hover:text-[#1A1A1A]">
                    Name <SortIcon field="first_name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">Areas of Interest</th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">
                  <button onClick={() => handleSort('stage')} className="flex items-center gap-1 hover:text-[#1A1A1A]">
                    Stage <SortIcon field="stage" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">
                  <button onClick={() => handleSort('priority')} className="flex items-center gap-1 hover:text-[#1A1A1A]">
                    Priority <SortIcon field="priority" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">Assigned To</th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">
                  <button onClick={() => handleSort('next_follow_up_date')} className="flex items-center gap-1 hover:text-[#1A1A1A]">
                    Follow Up <SortIcon field="next_follow_up_date" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-medium text-[#6B6B6B]">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-[#1A1A1A]">
                    Created <SortIcon field="created_at" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => {
                const stageConf = STAGE_CONFIG[lead.stage]
                const today = new Date().toISOString().split('T')[0]
                const isOverdue = lead.next_follow_up_date && lead.next_follow_up_date < today
                const isDueToday = lead.next_follow_up_date === today

                return (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="border-b border-gray-50 hover:bg-[#FAFAF8] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1A1A1A]">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-xs text-[#6B6B6B]">{lead.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.areas_of_interest?.slice(0, 2).map((area) => (
                          <span
                            key={area}
                            className="text-xs bg-[#C4956A]/10 text-[#C4956A] px-2 py-0.5 rounded-full"
                          >
                            {area}
                          </span>
                        ))}
                        {(lead.areas_of_interest?.length ?? 0) > 2 && (
                          <span className="text-xs text-[#6B6B6B]">
                            +{(lead.areas_of_interest?.length ?? 0) - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageConf.color}`}>
                        {stageConf.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium capitalize ${PRIORITY_COLORS[lead.priority]}`}>
                        {lead.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B6B6B]">
                      {lead.assigned_to ? (
                        <span className="inline-flex items-center gap-1.5">
                          {userName(lead.assigned_to)}
                          {lead.assigned_to === currentEmail && (
                            <span className="text-[10px] font-semibold text-[#C4956A] bg-[#C4956A]/10 px-1.5 py-0.5 rounded-full">
                              You
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-300">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.next_follow_up_date ? (
                        <span className={`text-sm font-medium ${
                          isOverdue ? 'text-red-600' : isDueToday ? 'text-orange-600' : 'text-[#6B6B6B]'
                        }`}>
                          {formatDate(lead.next_follow_up_date)}
                          {isDueToday && <span className="ml-1 text-xs">(Today)</span>}
                          {isOverdue && <span className="ml-1 text-xs">(Overdue)</span>}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B6B6B]">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
