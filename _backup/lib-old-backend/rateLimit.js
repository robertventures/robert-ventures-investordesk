/**
 * Rate Limiting Middleware for Next.js API Routes
 *
 * Implements sliding window rate limiting using in-memory storage
 * Tracks requests by IP address and/or user identifier
 *
 * IMPORTANT: This is a basic implementation suitable for small-scale apps.
 * For production at scale, use Redis or a dedicated rate limiting service.
 */

// In-memory storage for rate limit tracking
const rateLimitStore = new Map()

// Cleanup old entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 0) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Rate limit configuration presets
 */
export const RATE_LIMIT_CONFIGS = {
  // Strict limits for authentication endpoints (prevent brute force)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per window
    message: 'Too many authentication attempts. Please try again in 15 minutes.'
  },

  // Medium limits for password reset requests
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 reset requests per hour
    message: 'Too many password reset requests. Please try again in 1 hour.'
  },

  // Lenient limits for general API access
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    message: 'Too many requests. Please slow down.'
  },

  // Very strict limits for user creation/import
  userCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 user creations per hour
    message: 'Too many user creation requests. Please try again later.'
  }
}

/**
 * Get client IP address from request
 * @param {Request} request - Next.js request object
 * @returns {string} - Client IP address
 */
function getClientIdentifier(request) {
  // Try to get real IP from headers (behind proxy/CDN)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip') // Cloudflare

  if (forwarded) {
    // x-forwarded-for can be: "client, proxy1, proxy2"
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Fallback to a generic identifier
  return 'unknown-ip'
}

/**
 * Create a rate limit key combining IP and optional identifier
 * @param {string} ip - Client IP
 * @param {string} identifier - Optional identifier (e.g., email, user ID)
 * @returns {string} - Rate limit key
 */
function createRateLimitKey(ip, identifier = null) {
  if (identifier) {
    return `${ip}:${identifier}`
  }
  return ip
}

/**
 * Check if request should be rate limited
 * @param {Request} request - Next.js request object
 * @param {object} config - Rate limit configuration
 * @param {string} identifier - Optional identifier for per-user limiting
 * @returns {object} - { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(request, config = RATE_LIMIT_CONFIGS.api, identifier = null) {
  const ip = getClientIdentifier(request)
  const key = createRateLimitKey(ip, identifier)
  const now = Date.now()

  // Get or create rate limit data for this key
  let rateLimitData = rateLimitStore.get(key)

  if (!rateLimitData || now > rateLimitData.resetTime) {
    // Create new window
    rateLimitData = {
      count: 0,
      resetTime: now + config.windowMs,
      windowMs: config.windowMs
    }
  }

  // Increment request count
  rateLimitData.count++

  // Check if limit exceeded
  const allowed = rateLimitData.count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - rateLimitData.count)

  // Store updated data
  rateLimitStore.set(key, rateLimitData)

  return {
    allowed,
    remaining,
    resetTime: rateLimitData.resetTime,
    retryAfter: Math.ceil((rateLimitData.resetTime - now) / 1000) // seconds
  }
}

/**
 * Rate limiting middleware for Next.js API routes
 * Returns a response if rate limited, null if allowed
 *
 * @param {Request} request - Next.js request object
 * @param {object} config - Rate limit configuration
 * @param {string} identifier - Optional identifier for per-user limiting
 * @returns {Response|null} - 429 response if rate limited, null if allowed
 */
export function rateLimit(request, config = RATE_LIMIT_CONFIGS.api, identifier = null) {
  const result = checkRateLimit(request, config, identifier)

  if (!result.allowed) {
    // Return 429 Too Many Requests
    return new Response(
      JSON.stringify({
        success: false,
        error: config.message,
        retryAfter: result.retryAfter
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
        }
      }
    )
  }

  // Not rate limited - return null to proceed
  return null
}

/**
 * Add rate limit headers to response
 * Useful for informing clients about their rate limit status
 */
export function addRateLimitHeaders(response, result, config) {
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', new Date(result.resetTime).toISOString())
  return response
}

/**
 * Reset rate limit for a specific identifier (e.g., after successful action)
 * Useful for clearing limits after password reset success
 */
export function resetRateLimit(ip, identifier = null) {
  const key = createRateLimitKey(ip, identifier)
  rateLimitStore.delete(key)
}
