'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import { PROCEDURE_AREAS, PipelineStage, Priority, EligibilityStatus } from '@/lib/types'

export default function NewLeadPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    preferred_contact: '' as 'phone' | 'email' | '',
    areas_of_interest: [] as string[],
    message: '',
    source: 'manual',
    stage: 'new_lead' as PipelineStage,
    priority: 'medium' as Priority,
    eligibility_status: 'pending' as EligibilityStatus,
    assigned_to: '',
    next_follow_up_date: '',
    internal_notes: '',
    tags: '',
  })

  const [users, setUsers] = useState<{ email: string; name: string }[]>([])
  useEffect(() => {
    fetch('/api/users')
      .then((r) => (r.ok ? r.json() : []))
      .then((u) => setUsers(Array.isArray(u) ? u : []))
      .catch(() => {})
  }, [])

  function handleAreaToggle(area: string) {
    setForm((prev) => ({
      ...prev,
      areas_of_interest: prev.areas_of_interest.includes(area)
        ? prev.areas_of_interest.filter((a) => a !== area)
        : [...prev.areas_of_interest, area],
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = {
        ...form,
        preferred_contact: form.preferred_contact || undefined,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        next_follow_up_date: form.next_follow_up_date || undefined,
        phone: form.phone || undefined,
        message: form.message || undefined,
        assigned_to: form.assigned_to || undefined,
        internal_notes: form.internal_notes || undefined,
      }

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create lead')
      }

      const lead = await res.json()
      router.push(`/leads/${lead.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-[#FAFAF8] text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#C4956A] focus:border-transparent text-sm'
  const labelClass = 'block text-sm font-medium text-[#1A1A1A] mb-1.5'
  const sectionClass = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4'

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">New Lead</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">Add a new patient lead manually</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Info */}
          <div className={sectionClass}>
            <h2 className="text-base font-semibold text-[#1A1A1A] border-b border-gray-100 pb-3 -mx-6 px-6">Contact Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  type="text"
                  required
                  value={form.first_name}
                  onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={form.last_name}
                  onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Preferred Contact</label>
              <select
                value={form.preferred_contact}
                onChange={(e) => setForm((p) => ({ ...p, preferred_contact: e.target.value as 'phone' | 'email' | '' }))}
                className={inputClass}
              >
                <option value="">Not specified</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
            </div>
          </div>

          {/* Areas of Interest */}
          <div className={sectionClass}>
            <h2 className="text-base font-semibold text-[#1A1A1A] border-b border-gray-100 pb-3 -mx-6 px-6">Areas of Interest</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROCEDURE_AREAS.map((area) => (
                <label
                  key={area}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={form.areas_of_interest.includes(area)}
                    onChange={() => handleAreaToggle(area)}
                    className="w-4 h-4 rounded border-gray-300 text-[#C4956A] focus:ring-[#C4956A]"
                  />
                  <span className="text-sm text-[#1A1A1A]">{area}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className={sectionClass}>
            <h2 className="text-base font-semibold text-[#1A1A1A] border-b border-gray-100 pb-3 -mx-6 px-6">Message</h2>
            <div>
              <label className={labelClass}>Initial Message</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                className={inputClass}
                placeholder="Any message from the patient..."
              />
            </div>
          </div>

          {/* CRM Fields */}
          <div className={sectionClass}>
            <h2 className="text-base font-semibold text-[#1A1A1A] border-b border-gray-100 pb-3 -mx-6 px-6">CRM Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Source</label>
                <select
                  value={form.source}
                  onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                  className={inputClass}
                >
                  <option value="manual">Manual Entry</option>
                  <option value="website">Website</option>
                  <option value="referral">Referral</option>
                  <option value="phone">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Stage</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as PipelineStage }))}
                  className={inputClass}
                >
                  <option value="new_lead">New Lead</option>
                  <option value="attempted_contact">Attempted Contact</option>
                  <option value="contacted">Contacted</option>
                  <option value="eligibility_review">Eligibility Review</option>
                  <option value="eligible">Eligible</option>
                  <option value="ineligible">Ineligible</option>
                  <option value="virtual_consult_scheduled">Virtual Consult Scheduled</option>
                  <option value="virtual_consult_completed">Virtual Consult Completed</option>
                  <option value="procedure_scheduled">Procedure Scheduled</option>
                  <option value="procedure_completed">Procedure Completed</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Priority }))}
                  className={inputClass}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Assigned To</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.email} value={u.email}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Next Follow-Up Date</label>
              <input
                type="date"
                value={form.next_follow_up_date}
                onChange={(e) => setForm((p) => ({ ...p, next_follow_up_date: e.target.value }))}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Internal Notes</label>
              <textarea
                rows={3}
                value={form.internal_notes}
                onChange={(e) => setForm((p) => ({ ...p, internal_notes: e.target.value }))}
                className={inputClass}
                placeholder="Internal notes about this lead..."
              />
            </div>

            <div>
              <label className={labelClass}>Tags (comma-separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                className={inputClass}
                placeholder="e.g. vip, referral, instagram"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-3 border border-gray-200 text-[#6B6B6B] font-medium rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[#C4956A] text-white font-medium rounded-xl hover:bg-[#a87a54] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  )
}
