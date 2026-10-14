import { createSupabaseServerClient } from './supabase'
import { isAdmin } from './admins'

// The signed-in staff member making a request (Route Handlers only).
export interface Caller {
  email: string
  name: string
  isAdmin: boolean
}

// Staff who may edit any published call calendar even when they are neither
// its owner nor an admin. Comma-separated env; defaults to the practice owner.
const EDITOR_EMAILS = (process.env.BOOKING_EDITOR_EMAILS || 'jwaldstreicher@karimedical.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export function canEditCalendar(caller: Caller, owner: string): boolean {
  const email = caller.email.toLowerCase()
  return caller.isAdmin || email === owner.toLowerCase() || EDITOR_EMAILS.includes(email)
}

export async function getCaller(): Promise<Caller | null> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null
  return {
    email: user.email,
    name: (user.user_metadata?.full_name as string | undefined) || user.email,
    isAdmin: isAdmin(user.email),
  }
}
