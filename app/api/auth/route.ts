import { NextResponse } from 'next/server'

// DEPRECATED: This endpoint previously issued a forgeable `crm_auth=true` cookie.
// Authentication is now handled by Supabase Auth (see /login and the middleware).
// The route is kept only to return a clear error for any stale clients; it no
// longer sets or clears any authentication cookie.

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Sign in via Supabase Auth on /login.' },
    { status: 410 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'This endpoint has been removed. Use Supabase signOut() to log out.' },
    { status: 410 }
  )
}
