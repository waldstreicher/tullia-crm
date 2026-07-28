'use client'

import { useEffect, useState } from 'react'
import { Users, UserPlus, CalendarClock, CheckCircle } from 'lucide-react'
import AppLayout from '@/components/AppLayout'
import LeadTable from '@/components/LeadTable'
import { Lead } from '@/lib/types'

interface Stats {
  totalLeads: number
  newThisWeek: number
  followUpToday: number
  proceduresScheduled: number
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-3xl font-semibold text-[#1A1A1A]">{value}</p>
        <p className="text-sm text-[#6B6B6B] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    newThisWeek: 0,
    followUpToday: 0,
    proceduresScheduled: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/leads')
        if (!res.ok) return
        const leads: Lead[] = await res.json()

        const now = new Date()
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        const today = now.toISOString().split('T')[0]

        setStats({
          totalLeads: leads.length,
          newThisWeek: leads.filter(
            (l) => new Date(l.created_at) >= weekAgo
          ).length,
          followUpToday: leads.filter(
            (l) => l.next_follow_up_date === today
          ).length,
          proceduresScheduled: leads.filter(
            // A procedure counts as "scheduled" when it has a scheduled date
            // and has not yet been completed.
            (l) => l.procedure_scheduled_date && !l.procedure_completed_at
          ).length,
        })
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <AppLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Dashboard</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={Users}
            label="Total Leads"
            value={loading ? 0 : stats.totalLeads}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={UserPlus}
            label="New This Week"
            value={loading ? 0 : stats.newThisWeek}
            color="bg-[#C4956A]/10 text-[#C4956A]"
          />
          <StatCard
            icon={CalendarClock}
            label="Follow Up Today"
            value={loading ? 0 : stats.followUpToday}
            color="bg-orange-50 text-orange-600"
          />
          <StatCard
            icon={CheckCircle}
            label="Procedures Scheduled"
            value={loading ? 0 : stats.proceduresScheduled}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* Lead Table */}
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">All Leads</h2>
          <LeadTable />
        </div>
      </div>
    </AppLayout>
  )
}
