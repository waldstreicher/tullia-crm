'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Users, UserPlus, LogOut, Bell, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'
import { getRole, type Role } from '@/lib/roles'

interface SidebarStats {
  newLeads: number
  followUpToday: number
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [stats, setStats] = useState<SidebarStats>({ newLeads: 0, followUpToday: 0 })
  const [userLabel, setUserLabel] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user
      if (u) {
        setUserLabel((u.user_metadata?.full_name as string | undefined) || u.email || '')
        setRole(getRole(u))
      }
    })
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setIsAdmin(!!d.isAdmin)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    async function fetchStats() {
      try {
        // Aggregate metrics only — works for observers too and never pulls PII.
        const res = await fetch('/api/metrics')
        if (!res.ok) return
        const m = await res.json()
        setStats({
          newLeads: m?.byStage?.new_lead ?? 0,
          followUpToday: m?.followUpToday ?? 0,
        })
      } catch {
        // Silently fail
      }
    }
    fetchStats()
  }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Admins always have full access, even if their role is observer.
  const isObserver = role === 'observer' && !isAdmin
  const navItems = [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ...(!isObserver
      ? [
          { href: '/leads', icon: Users, label: 'All Leads' },
          { href: '/leads/new', icon: UserPlus, label: 'New Lead' },
        ]
      : []),
    ...(isAdmin ? [{ href: '/team', icon: Shield, label: 'Team' }] : []),
  ]

  return (
    <aside className="w-64 min-h-screen bg-[#1A1A1A] flex flex-col">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-white/10">
        <h1 className="text-xl font-light tracking-[0.25em] text-white uppercase">Tuli</h1>
        <p className="text-xs text-[#C4956A] tracking-[0.2em] uppercase mt-0.5">CRM</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive ? 'bg-[#C4956A] text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* Activity badges */}
        <div className="pt-6 space-y-2">
          <p className="text-xs text-gray-600 uppercase tracking-widest px-3 mb-3">Activity</p>

          {stats.newLeads > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-blue-500/10">
              <div className="flex items-center gap-2 text-sm text-blue-400">
                <Bell size={14} />
                <span>New Leads</span>
              </div>
              <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stats.newLeads}</span>
            </div>
          )}

          {stats.followUpToday > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-orange-500/10">
              <div className="flex items-center gap-2 text-sm text-orange-400">
                <Bell size={14} />
                <span>Follow Up Today</span>
              </div>
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stats.followUpToday}</span>
            </div>
          )}

          {stats.newLeads === 0 && stats.followUpToday === 0 && (
            <p className="text-xs text-gray-600 px-3">No urgent items</p>
          )}
        </div>
      </nav>

      {/* Current user + Logout */}
      <div className="px-4 pb-6">
        {userLabel && (
          <div className="px-3 pb-2 mb-1">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">
              Signed in as{isObserver ? ' · Observer' : ''}
            </p>
            <p className="text-sm text-gray-300 truncate" title={userLabel}>{userLabel}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <LogOut size={18} />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  )
}
