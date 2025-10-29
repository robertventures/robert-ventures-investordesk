/**
 * CORS (Cross-Origin Resource Sharing) Configuration
 *
 * Securely configures CORS headers to allow cross-origin requests
 * from trusted origins while preventing unauthorized access.
 */

import { NextResponse } from 'next/server'

/**
 * Allowed origins for CORS requests
 *
 * IMPORTANT: Configure these based on your deployment:
 * - Production: Add your production domain(s)
 * - Development: localhost with various ports
 * - Staging: Add staging domain if applicable
 */
const buildAllowedOrigins = () => {
  const origins = []

  // Production domains from environment
  if (process.env.NEXT_PUBLIC_APP_URL) {
    // Only add NEXT_PUBLIC_APP_URL if it's not localhost in production
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.NEXT_PUBLIC_APP_URL.includes('localhost') &&
          !process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1')) {
        origins.push(process.env.NEXT_PUBLIC_APP_URL)
      }
    } else {
      origins.push(process.env.NEXT_PUBLIC_APP_URL)
    }
  }

  // Hardcoded production domains (always included for flexibility)
  origins.push(
    'https://invest.robertventures.com',
    'https://www.invest.robertventures.com'
  )

  // Netlify preview/deploy URLs
  if (process.env.DEPLOY_PRIME_URL) {
    origins.push(process.env.DEPLOY_PRIME_URL)
  }
  if (process.env.DEPLOY_URL) {
    origins.push(process.env.DEPLOY_URL)
  }

  // Development origins (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    )
  }

  return origins.filter(Boolean)
}

const ALLOWED_ORIGINS = buildAllowedOrigins()

/**
 * Allowed HTTP methods for API requests
 */
const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'PATCH'
]

/**
 * Allowed headers for API requests
 */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
  'X-CSRF-Token'
]

/**
 * Exposed headers that client can access
 */
const EXPOSED_HEADERS = [
  'Content-Length',
  'Content-Type',
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After'
]

/**
 * Credentials policy
 * Set to true to allow cookies/auth headers in cross-origin requests
 */
const ALLOW_CREDENTIALS = true

/**
 * Max age for preflight cache (in seconds)
 * How long browsers can cache the CORS preflight response
 */
const MAX_AGE = 86400 // 24 hours

/**
 * Check if origin is allowed
 */
export function isOriginAllowed(origin) {
  if (!origin) {
    return false
  }

  // Exact match
  if (ALLOWED_ORIGINS.includes(origin)) {
    return true
  }

  // Pattern matching for dynamic preview URLs (e.g., Netlify)
  // Allow *.netlify.app domains in non-production
  if (process.env.NODE_ENV !== 'production') {
    if (origin.match(/^https:\/\/.*\.netlify\.app$/)) {
      return true
    }
    // Allow localhost with any port in development
    if (origin.match(/^http:\/\/(localhost|127\.0\.0\.1):\d+$/)) {
      return true
    }
  }

  return false
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(origin) {
  const headers = {}

  // Set origin if allowed
  if (isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  } else if (!origin) {
    // Same-origin requests don't send Origin header
    // Allow them by setting * or omitting the header
    // We omit it for security (don't expose API to all origins)
  } else {
    // Origin not allowed - return empty headers
    // The browser will block the response
    return headers
  }

  // Allow credentials (cookies, authorization headers)
  if (ALLOW_CREDENTIALS) {
    headers['Access-Control-Allow-Credentials'] = 'true'
  }

  // Exposed headers (client can read these)
  headers['Access-Control-Expose-Headers'] = EXPOSED_HEADERS.join(', ')

  // Vary header to prevent caching issues
  headers['Vary'] = 'Origin'

  return headers
}

/**
 * Get preflight CORS headers (for OPTIONS requests)
 */
export function getPreflightHeaders(origin) {
  const headers = getCorsHeaders(origin)

  if (Object.keys(headers).length === 0) {
    // Origin not allowed
    return headers
  }

  // Allowed methods
  headers['Access-Control-Allow-Methods'] = ALLOWED_METHODS.join(', ')

  // Allowed headers
  headers['Access-Control-Allow-Headers'] = ALLOWED_HEADERS.join(', ')

  // Preflight cache duration
  headers['Access-Control-Max-Age'] = MAX_AGE.toString()

  return headers
}

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight(request) {
  const origin = request.headers.get('origin')
  const headers = getPreflightHeaders(origin)

  // If origin not allowed, return 403
  if (Object.keys(headers).length === 0) {
    return new NextResponse(null, {
      status: 403,
      statusText: 'Forbidden'
    })
  }

  // Return 204 No Content with CORS headers
  return new NextResponse(null, {
    status: 204,
    headers
  })
}

/**
 * Apply CORS headers to a response
 */
export function applyCorsHeaders(request, response) {
  const origin = request.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // If origin not allowed, don't modify response
  // Browser will block the response
  if (Object.keys(corsHeaders).length === 0 && origin) {
    console.warn('⚠️  CORS: Origin not allowed:', origin)
    return response
  }

  // Add CORS headers to existing response
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

/**
 * CORS middleware for API routes
 *
 * Usage in API routes:
 *
 * import { corsMiddleware } from '@/lib/cors'
 *
 * export async function GET(request) {
 *   return corsMiddleware(request, async () => {
 *     // Your API logic here
 *     return NextResponse.json({ success: true })
 *   })
 * }
 */
export async function corsMiddleware(request, handler) {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return handlePreflight(request)
  }

  // Execute handler
  const response = await handler()

  // Apply CORS headers to response
  return applyCorsHeaders(request, response)
}

/**
 * Validate CORS configuration on startup
 */
export function validateCorsConfig() {
  if (process.env.NODE_ENV === 'production') {
    // In production, ensure at least one origin is configured
    const productionOrigins = ALLOWED_ORIGINS.filter(
      origin => origin && !origin.includes('localhost') && !origin.includes('127.0.0.1')
    )

    if (productionOrigins.length === 0) {
      console.warn('⚠️  WARNING: No production origins configured for CORS!')
      console.warn('⚠️  Set NEXT_PUBLIC_APP_URL environment variable')
    } else {
      console.log('✅ CORS configured for production origins:', productionOrigins)
    }
  } else {
    console.log('✅ CORS configured for development:', ALLOWED_ORIGINS.filter(Boolean))
  }
}

// Validate config on module load
if (typeof window === 'undefined') {
  validateCorsConfig()
}
