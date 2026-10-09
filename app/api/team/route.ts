import { NextResponse } from 'next/server'
import { createServiceClient, createSupabaseServerClient } from '@/lib/supabase'
import { getRole, type Role } from '@/lib/roles'
import { isAdmin } from '@/lib/admins'

// Team management — list accounts and change User/Observer roles. Admin-only:
// every handler re-verifies the caller is an admin (defense in depth alongside
// the middleware gate).
export const dynamic = 'force-dynamic'

async function callerIsAdmin(): Promise<boolean> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return isAdmin(user?.email)
}

export async function GET() {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc.auth.admin.listUsers({ perPage: 1000 })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const users = (data?.users || [])
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      name: (u.user_metadata?.full_name as string | undefined) || (u.email as string),
      role: getRole(u),
      isAdmin: isAdmin(u.email),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json(users)
}

export async function PATCH(request: Request) {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; role?: Role }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { userId, role } = body
  if (!userId || (role !== 'user' && role !== 'observer')) {
    return NextResponse.json(
      { error: 'userId and role ("user" or "observer") are required' },
      { status: 400 }
    )
  }

  const svc = createServiceClient()
  const { error } = await svc.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// Reset a user's password to an admin-chosen value.
export async function POST(request: Request) {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { userId?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { userId, password } = body
  if (!userId || !password || password.length < 6) {
    return NextResponse.json(
      { error: 'userId and a password of at least 6 characters are required' },
      { status: 400 }
    )
  }

  const svc = createServiceClient()
  const { error } = await svc.auth.admin.updateUserById(userId, { password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
