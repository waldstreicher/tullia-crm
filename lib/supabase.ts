import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// NOTE: This module is server-only (it imports next/headers). Client Components
// should import the browser client from '@/lib/supabase-browser' instead.

// Next.js 14 caches fetch() responses in its Data Cache by default — including
// the requests supabase-js makes — so a route handler that doesn't read the
// request (e.g. GET /api/metrics) could keep serving an old snapshot of the
// database. Every server-side Supabase request opts out of that cache.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

// Server-side client with the service role key (for API routes).
// All env vars are read lazily inside functions so module init doesn't fail at build time.
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: { fetch: noStoreFetch },
  })
}

// Session-aware server client (Server Components, Route Handlers, Server Actions).
// Uses the request cookies so it can read the signed-in user. Cookie writes are
// wrapped in try/catch because Server Components cannot set cookies — the
// middleware refreshes the session for those cases.
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: noStoreFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — safe to ignore when middleware
          // is responsible for refreshing the session.
        }
      },
    },
  })
}
