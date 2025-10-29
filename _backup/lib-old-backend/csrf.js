/**
 * CSRF Protection Utility
 * 
 * Implements double-submit cookie pattern for CSRF protection:
 * 1. Server generates random token and sets in HTTP-only cookie
 * 2. Client reads token from separate endpoint/header
 * 3. Client sends token in X-CSRF-Token header with requests
 * 4. Server validates token in header matches cookie
 * 
 * This protects against CSRF attacks since attackers cannot read cookies
 * from another domain due to same-origin policy.
 * 
 * IMPORTANT: This module is used by Next.js middleware (Edge Runtime).
 * Do not import Node.js builtins here. Use Web Crypto APIs instead.
 */

/**
 * Generate a cryptographically secure CSRF token
 * @returns {string} 32-byte random token in base64
 */
export function generateCsrfToken() {
  // Use Web Crypto in Edge runtime to generate secure random bytes
  const bytes = new Uint8Array(32)
  // globalThis.crypto is available in Edge Runtime
  globalThis.crypto.getRandomValues(bytes)
  // Return a hex string to avoid any cookie-unsafe characters
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0')
  }
  return hex
}

/**
 * Cookie name for CSRF token (HTTP-only)
 */
export const CSRF_COOKIE_NAME = '__Host-csrf-token'

/**
 * Header name for CSRF token
 */
export const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Cookie options for CSRF token
 */
export const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: 60 * 60 * 24 // 24 hours
}

/**
 * Serialize a cookie value
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value
 * @param {object} options - Cookie options
 * @returns {string} Serialized cookie string
 */
export function serializeCookie(name, value, options = {}) {
  const pairs = [`${name}=${value}`]
  
  if (options.httpOnly) pairs.push('HttpOnly')
  if (options.secure) pairs.push('Secure')
  if (options.sameSite) pairs.push(`SameSite=${options.sameSite}`)
  if (options.path) pairs.push(`Path=${options.path}`)
  if (options.maxAge) pairs.push(`Max-Age=${options.maxAge}`)
  
  return pairs.join('; ')
}

/**
 * Parse cookies from request header
 * @param {string} cookieHeader - Cookie header value
 * @returns {object} Parsed cookies
 */
export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {}
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, ...rest] = cookie.split('=')
    const trimmedName = name?.trim()
    if (trimmedName) {
      cookies[trimmedName] = rest.join('=').trim()
    }
    return cookies
  }, {})
}

/**
 * Validate CSRF token
 * @param {string} tokenFromHeader - Token from X-CSRF-Token header
 * @param {string} tokenFromCookie - Token from cookie
 * @returns {boolean} True if tokens match
 */
export function validateCsrfToken(tokenFromHeader, tokenFromCookie) {
  if (!tokenFromHeader || !tokenFromCookie) {
    return false
  }
  
  // Constant-time string comparison (avoid timing attacks)
  // Works in Edge runtime without Node builtins
  const a = String(tokenFromHeader)
  const b = String(tokenFromCookie)
  let mismatch = a.length ^ b.length
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Check if request method requires CSRF protection
 * @param {string} method - HTTP method
 * @returns {boolean} True if method requires CSRF protection
 */
export function requiresCsrfProtection(method) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  return !safeMethods.includes(method.toUpperCase())
}

/**
 * Get CSRF token from request cookies
 * @param {Request} request - Next.js request object
 * @returns {string|null} CSRF token or null
 */
export function getCsrfTokenFromRequest(request) {
  const cookieHeader = request.headers.get('cookie')
  const cookies = parseCookies(cookieHeader)
  return cookies[CSRF_COOKIE_NAME] || null
}

