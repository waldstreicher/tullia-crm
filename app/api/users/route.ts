import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Always run per request (reads live user list); never prerender at build time.
export const dynamic = 'force-dynamic'

// Returns the list of assignable staff accounts (email + display name).
// Observers are excluded from the list and are blocked from this route by the
// middleware. Used to populate the "Assigned To" dropdown.
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  if (error) {
    console.error('Error listing users:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users = (data?.users || [])
    .filter((u) => u.email && u.app_metadata?.role !== 'observer')
    .map((u) => ({
      email: u.email as string,
      name: (u.user_metadata?.full_name as string | undefined) || (u.email as string),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(users)
}
