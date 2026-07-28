import { createBrowserClient } from '@supabase/ssr'

// Browser/client-side Supabase client with full auth (session) support.
// Safe to import from Client Components ('use client'). Manages the auth
// cookies used by the SSR middleware and server clients.
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
