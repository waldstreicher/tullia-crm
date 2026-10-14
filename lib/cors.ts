import { NextResponse } from 'next/server'

// CORS for the endpoints the public Tuli website calls directly from the
// browser (lead intake, slot listing, booking). Shared so every public route
// allows exactly the same origins.
const ALLOWED_ORIGINS = [
  'https://tulliaprocedure.com',
  'https://www.tulliaprocedure.com',
  'https://tumescentlipolysis.com',
  'https://www.tumescentlipolysis.com',
  'https://tumescentcryolipolysis.com',
  'https://www.tumescentcryolipolysis.com',
  'https://tullia.com',
  'https://www.tullia.com',
  'https://tullia-website.vercel.app',
  'https://tcl-website-moskovitz.vercel.app',
]

export function getCorsHeaders(origin: string | null) {
  let allowedOrigin = 'https://www.tumescentlipolysis.com'

  if (origin) {
    const isLocalDev =
      process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      /^https:\/\/[a-z0-9-]+-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/.test(origin) ||
      origin.endsWith('.vercel.app') ||
      isLocalDev
    ) {
      allowedOrigin = origin
    }
  }

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export function corsPreflight(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request.headers.get('origin')),
  })
}
