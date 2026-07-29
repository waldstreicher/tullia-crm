import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRole } from '@/lib/roles'
import { isAdmin } from '@/lib/admins'

// Paths that do NOT require an authenticated user session.
function isPublicPath(pathname: string): boolean {
  if (pathname === '/login') return true
  // Public website intake endpoint (leads posted from the Tuli website).
  if (pathname.startsWith('/api/intake')) return true
  // Cron endpoints authenticate via CRON_SECRET, not a user session.
  if (pathname.startsWith('/api/cron')) return true
  return false
}

// The only paths an Observer may reach. Everything else (all lead pages and
// lead/user APIs, which expose patient PII) is blocked for observers.
function observerAllowed(pathname: string): boolean {
  if (pathname === '/') return true
  if (pathname.startsWith('/api/metrics')) return true
  if (pathname.startsWith('/api/auth')) return true
  if (pathname.startsWith('/api/me')) return true
  return false
}

// Admin-only paths (Team management).
function isAdminPath(pathname: string): boolean {
  return pathname === '/team' || pathname.startsWith('/api/team')
}

// Refreshes the Supabase session on every request and gates protected routes.
// Follows the official @supabase/ssr middleware pattern for Next.js.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If Supabase isn't configured, don't hard-crash every request — just let it
  // through so misconfiguration surfaces as a clear error in the app instead.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: getUser() must be called right after creating the client and
  // before any other logic, so the session is refreshed on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (!user && !isPublicPath(pathname)) {
    // Unauthenticated API calls get a clean 401 instead of an HTML redirect.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.search = ''
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Already signed in but sitting on the login page → send to the dashboard.
  if (user && pathname === '/login') {
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  // Observers are confined to the dashboard + aggregate metrics. Any attempt to
  // reach lead data is refused here, on the server — never relying on the UI.
  // Admins are never restricted, regardless of their role value.
  if (
    user &&
    getRole(user) === 'observer' &&
    !isAdmin(user.email) &&
    !observerAllowed(pathname)
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  // Team management (page + APIs) is admin-only.
  if (user && isAdminPath(pathname) && !isAdmin(user.email)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const homeUrl = request.nextUrl.clone()
    homeUrl.pathname = '/'
    homeUrl.search = ''
    return NextResponse.redirect(homeUrl)
  }

  return supabaseResponse
}
