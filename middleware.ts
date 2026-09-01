import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Block all non-US traffic
// Vercel automatically provides geo headers: https://vercel.com/docs/edge-network/headers#x-vercel-ip-country

export function middleware(request: NextRequest) {
  // Get country from Vercel's geo headers
  const country = request.headers.get('x-vercel-ip-country') || request.geo?.country

  // Allow US traffic and localhost/dev
  const allowedCountries = ['US', 'US-CA', 'US-NY', 'US-TX', 'US-FL', 'US-MI'] // US and US territories
  const isUS = country === 'US' || country?.startsWith('US')
  const isLocalhost = !country || country === 'XX' // XX = unknown/localhost

  if (isUS || isLocalhost) {
    return NextResponse.next()
  }

  // Block non-US traffic with a simple message
  // Return 403 for API routes, redirect to blocked page for others
  const { pathname } = request.nextUrl

  // For API routes, return 403 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { error: 'This service is only available in the United States.' },
      { status: 403 }
    )
  }

  // For page routes, show a blocked page
  // We'll return a simple HTML response instead of redirecting to avoid loops
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Available</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #111;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    p { color: #888; font-size: 1.1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🇺🇸 US Only</h1>
    <p>Warehouse Tire Direct currently only ships within the United States.</p>
    <p>We do not offer international shipping at this time.</p>
  </div>
</body>
</html>`,
    {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    }
  )
}

// Run middleware on all routes except static files and images
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
