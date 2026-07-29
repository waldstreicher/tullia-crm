import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { getRole } from '@/lib/roles'
import { isAdmin } from '@/lib/admins'

// Returns the signed-in user's own identity, role, and admin flag. Used by the
// UI to decide whether to show the Team link. Reveals nothing about other users.
export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    email: user.email,
    role: getRole(user),
    isAdmin: isAdmin(user.email),
  })
}
