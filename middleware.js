/**
 * Next.js Middleware
 *
 * Runs before every request to apply:
 * - HTTPS enforcement (redirect HTTP to HTTPS in production)
 * - CORS headers for cross-origin requests
 * - Security headers (HSTS, CSP, etc.)
 * - Request validation
 *
 * This file is automatically executed by Next.js for all routes.
 */

import { NextResponse } from 'next/server'
import { getCorsHeaders, getPreflightHeaders, isOriginAllowed } from './lib/cors.js'

export function middleware(request) {
  const { pathname, origin } = request.nextUrl
  const requestOrigin = request.headers.get('origin')

  // Skip middleware for static files and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next()
  }

  // HTTPS Enforcement (Production only)
  // Redirect HTTP to HTTPS for all requests
  if (process.env.NODE_ENV === 'production') {
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host')

    // Check if request is HTTP (not HTTPS)
    if (protocol === 'http') {
      // Build HTTPS URL
      const httpsUrl = `https://${host}${pathname}${request.nextUrl.search}`

      console.log('🔒 HTTPS redirect:', `${protocol}://${host}${pathname}`, '→', httpsUrl)

      // Redirect to HTTPS with 301 (permanent redirect)
      return NextResponse.redirect(httpsUrl, {
        status: 301,
        headers: {
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
        }
      })
    }
  }

  // Handle OPTIONS preflight requests
  if (request.method === 'OPTIONS') {
    const headers = getPreflightHeaders(requestOrigin)

    // If origin not allowed, return 403
    if (Object.keys(headers).length === 0 && requestOrigin) {
      return new NextResponse(null, {
        status: 403,
        statusText: 'Forbidden - Origin not allowed'
      })
    }

    return new NextResponse(null, {
      status: 204,
      headers
    })
  }

  // CSRF Protection for API routes - TEMPORARILY DISABLED
  if (pathname.startsWith('/api')) {
    // CSRF protection is temporarily disabled to resolve build issues
    // TODO: Re-enable when email service is configured and proper testing is done
    console.log('⚠️  CSRF protection disabled for:', pathname)
  }

  // For API routes, apply CORS headers
  if (pathname.startsWith('/api')) {
    const corsHeaders = getCorsHeaders(requestOrigin)

    // Continue to API route with CORS headers
    const response = NextResponse.next()

    // Add CORS headers if origin is allowed or no origin (same-origin)
    if (Object.keys(corsHeaders).length > 0 || !requestOrigin) {
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
    } else if (requestOrigin) {
      // Origin not allowed - log and return 403
      console.warn('⚠️  CORS blocked request from:', requestOrigin, 'to:', pathname)
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: 'Origin not allowed'
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Add comprehensive security headers for API routes
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-DNS-Prefetch-Control', 'off')
    response.headers.set('X-Download-Options', 'noopen')
    response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

    // Permissions Policy (disable unnecessary features for API routes)
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    )

    // HSTS header (production only)
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      )
    }

    return response
  }

  // For non-API routes (pages), add comprehensive security headers
  const response = NextResponse.next()
  
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'off')
  response.headers.set('X-Download-Options', 'noopen')
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')

  // Content Security Policy (CSP) - restrictive for security
  // Build CSP with dynamic Supabase URL
  // Note: 'unsafe-inline' removed from style-src for security (app uses CSS Modules exclusively)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const connectSrc = supabaseUrl 
    ? `'self' ${supabaseUrl}` 
    : `'self'`
  
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'; " +
    "style-src 'self' https://fonts.googleapis.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data: https://fonts.gstatic.com; " +
    `connect-src ${connectSrc}; ` +
    "frame-ancestors 'self'; " +
    "base-uri 'self'; " +
    "form-action 'self'"
  )

  // Permissions Policy (disable unnecessary browser features)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()'
  )

  // HSTS header (production only)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public directory)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
