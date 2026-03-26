import AppLayout from '@/components/AppLayout'
import LeadTable from '@/components/LeadTable'

export default function LeadsPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">All Leads</h1>
          <p className="text-sm text-[#6B6B6B] mt-1">Manage and track all patient leads</p>
        </div>
        <LeadTable />
      </div>
    </AppLayout>
  )
}
