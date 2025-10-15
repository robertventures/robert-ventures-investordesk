import { verifyToken } from './auth.js'
import { NextResponse } from 'next/server'

/**
 * Extract JWT token from cookies
 * @param {Request} request - Next.js request object
 * @returns {string|null} - JWT token or null
 */
function getTokenFromCookies(request) {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {})
  
  return cookies['auth-token'] || null
}

/**
 * Middleware to require authentication
 * Verifies JWT token and returns user payload
 * @param {Request} request - Next.js request object
 * @returns {object|null} - User payload from JWT or null if invalid
 */
export async function requireAuth(request) {
  const token = getTokenFromCookies(request)
  
  if (!token) {
    return null
  }
  
  const payload = verifyToken(token)
  return payload
}

/**
 * Middleware to require admin authentication
 * Verifies JWT token and checks for admin role
 * @param {Request} request - Next.js request object
 * @returns {object|null} - User payload if admin, null otherwise
 */
export async function requireAdmin(request) {
  const user = await requireAuth(request)
  
  if (!user || !user.isAdmin) {
    return null
  }
  
  return user
}

/**
 * Create a response with authentication error
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @returns {NextResponse} - Error response
 */
export function authErrorResponse(message = 'Unauthorized', status = 401) {
  return NextResponse.json(
    { success: false, error: message },
    { status }
  )
}

/**
 * Set authentication cookies in response
 * @param {NextResponse} response - Next.js response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
export function setAuthCookies(response, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/'
  }
  
  // Set access token (7 days)
  response.cookies.set('auth-token', accessToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
  })
  
  // Set refresh token (30 days)
  response.cookies.set('refresh-token', refreshToken, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 30 // 30 days in seconds
  })
}

/**
 * Clear authentication cookies
 * @param {NextResponse} response - Next.js response object
 */
export function clearAuthCookies(response) {
  response.cookies.set('auth-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
  
  response.cookies.set('refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  })
}

