'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import LeadTable from '@/components/LeadTable'
import { parseLeadFilter } from '@/lib/lead-filters'

// Reads dashboard filters from the URL (/leads?stage=…, ?created=last7, …).
function FilteredLeadTable() {
  const router = useRouter()
  const sp = useSearchParams()
  const qs = sp.toString()
  return (
    // Keyed by the query so clicking a different tile re-initialises the filters.
    <LeadTable key={qs} filter={parseLeadFilter(sp)} onClearFilter={() => router.push('/leads')} />
  )
}

export default function LeadsPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">All Leads</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">Manage and track all patient leads</p>
        </div>
        <Suspense fallback={<div className="p-12 text-center text-[#6B6B6B]">Loading leads...</div>}>
          <FilteredLeadTable />
        </Suspense>
      </div>
    </AppLayout>
  )
}
