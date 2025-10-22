/**
 * CSRF Client Utility
 * 
 * Client-side helper for managing CSRF tokens in browser requests.
 * Automatically fetches and includes CSRF tokens in API requests.
 * 
 * Usage:
 * import { fetchWithCsrf } from '@/lib/csrfClient'
 * 
 * // Use like normal fetch, but CSRF token is added automatically
 * const response = await fetchWithCsrf('/api/users/profile', {
 *   method: 'PUT',
 *   body: JSON.stringify(data)
 * })
 */

let cachedCsrfToken = null

/**
 * Fetch CSRF token from the server
 * @returns {Promise<string>} CSRF token
 */
export async function getCsrfToken() {
  // Return cached token if available
  if (cachedCsrfToken) {
    return cachedCsrfToken
  }
  
  try {
    const response = await fetch('/api/auth/csrf-token', {
      method: 'GET',
      credentials: 'include' // Include cookies
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch CSRF token')
    }
    
    const data = await response.json()
    
    if (data.success && data.csrfToken) {
      cachedCsrfToken = data.csrfToken
      return cachedCsrfToken
    }
    
    throw new Error('Invalid CSRF token response')
  } catch (error) {
    console.error('❌ Error fetching CSRF token:', error)
    throw error
  }
}

/**
 * Clear cached CSRF token (e.g., after logout or token error)
 */
export function clearCsrfToken() {
  cachedCsrfToken = null
}

/**
 * Refresh CSRF token from server
 * @returns {Promise<string>} New CSRF token
 */
export async function refreshCsrfToken() {
  clearCsrfToken()
  return getCsrfToken()
}

/**
 * Check if HTTP method requires CSRF protection
 * @param {string} method - HTTP method
 * @returns {boolean} True if method requires CSRF token
 */
function requiresCsrfToken(method) {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS']
  return !safeMethods.includes(method?.toUpperCase())
}

/**
 * Fetch wrapper that automatically includes CSRF token
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithCsrf(url, options = {}) {
  const method = options.method || 'GET'
  
  // Only add CSRF token for state-changing requests
  if (requiresCsrfToken(method)) {
    try {
      const csrfToken = await getCsrfToken()
      
      // Add CSRF token to headers
      options.headers = {
        ...options.headers,
        'X-CSRF-Token': csrfToken
      }
    } catch (error) {
      console.error('❌ Failed to add CSRF token to request:', error)
      // Continue with request anyway - server will reject if token required
    }
  }
  
  // Ensure credentials are included (for cookies)
  options.credentials = options.credentials || 'include'
  
  try {
    const response = await fetch(url, options)
    
    // If we get a 403 with CSRF error, clear cached token and retry once
    if (response.status === 403 && requiresCsrfToken(method)) {
      const data = await response.json().catch(() => ({}))
      
      if (data.error?.includes('CSRF')) {
        console.warn('⚠️  CSRF token invalid, refreshing and retrying...')
        
        // Refresh token and retry
        const newToken = await refreshCsrfToken()
        options.headers = {
          ...options.headers,
          'X-CSRF-Token': newToken
        }
        
        return fetch(url, options)
      }
    }
    
    return response
  } catch (error) {
    console.error('❌ Fetch with CSRF failed:', error)
    throw error
  }
}

/**
 * Initialize CSRF token on page load
 * Call this in your app layout or main component
 */
export function initCsrfToken() {
  if (typeof window !== 'undefined') {
    // Fetch token on page load to cache it
    getCsrfToken().catch(error => {
      console.error('❌ Failed to initialize CSRF token:', error)
    })
  }
}

