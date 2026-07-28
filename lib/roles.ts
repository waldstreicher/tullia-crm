// Role is stored in Supabase auth `app_metadata` (admin-only, travels in the JWT).
// Absence of a role — or any value other than 'observer' — is treated as 'user'.
export type Role = 'user' | 'observer'

export function getRole(
  user: { app_metadata?: Record<string, unknown> | null } | null | undefined
): Role {
  return user?.app_metadata?.role === 'observer' ? 'observer' : 'user'
}
