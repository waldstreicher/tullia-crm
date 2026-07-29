// Admins are designated by the ADMIN_EMAILS env var (comma-separated).
// Admins can manage roles on the Team page and always have full access,
// regardless of their own role value.
export function isAdmin(email?: string | null): boolean {
  if (!email) return false
  const admins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}
