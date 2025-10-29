import { NextResponse } from 'next/server'
import { updateUser } from '../../../../../lib/supabaseDatabase.js'
import { requireAuth, authErrorResponse, setAuthCookies } from '../../../../../lib/authMiddleware.js'
import { signToken, signRefreshToken } from '../../../../../lib/auth.js'
import { getCurrentAppTime } from '../../../../../lib/appTime.js'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../../lib/rateLimit.js'

/**
 * POST /api/users/account/verify
 * Verify user account with verification code
 * 
 * This endpoint replaces: PUT /api/users/[id] with _action: 'verifyAccount'
 * Benefits:
 * - Clear intent (obviously for account verification)
 * - Specific rate limiting (5 requests/hour to prevent abuse)
 * - Better security monitoring
 * - Simpler permission checks
 * 
 * Request body:
 * {
 *   "code": "000000"  // 6-digit verification code
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Account verified successfully",
 *   "user": {
 *     "id": "USR-123",
 *     "email": "user@example.com",
 *     "isVerified": true,
 *     "verifiedAt": "2024-01-01T00:00:00.000Z"
 *   }
 * }
 */
export async function POST(request) {
  try {
    // Apply strict rate limiting (5 requests per hour)
    const rateLimitConfig = {
      ...RATE_LIMIT_CONFIGS.default,
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5 // Only 5 attempts per hour
    }
    const rateLimitResponse = rateLimit(request, rateLimitConfig)
    if (rateLimitResponse) {
      console.warn('[POST /api/users/account/verify] Rate limit exceeded')
      return rateLimitResponse
    }

    // Require authentication
    const authUser = await requireAuth(request)
    if (!authUser) {
      return authErrorResponse('Authentication required', 401)
    }

    console.log(`[POST /api/users/account/verify] Verification attempt for user: ${authUser.id}`)

    // Check if already verified
    if (authUser.isVerified) {
      console.log(`[POST /api/users/account/verify] User already verified: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'Account is already verified' },
        { status: 400 }
      )
    }

    const { code } = await request.json()

    // Validate code presence
    if (!code) {
      console.warn(`[POST /api/users/account/verify] Missing verification code for user: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      )
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      console.warn(`[POST /api/users/account/verify] Invalid code format for user: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'Verification code must be 6 digits' },
        { status: 400 }
      )
    }

    // TODO: In production, validate against stored verification code
    // For now, accept '000000' as valid code for development
    // In production, this should:
    // 1. Check against a stored verification code in database
    // 2. Check if code has expired (e.g., 15 minutes)
    // 3. Limit number of attempts (e.g., 3-5 attempts)
    // 4. Invalidate code after successful verification
    
    const isValidCode = code === '000000' // TODO: Replace with real validation
    
    if (!isValidCode) {
      console.warn(`[POST /api/users/account/verify] Invalid verification code for user: ${authUser.id}`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid verification code. Please check your email for the correct code.' 
        },
        { status: 400 }
      )
    }

    // Update user as verified
    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()
    
    console.log(`[POST /api/users/account/verify] Marking user as verified: ${authUser.id}`)
    
    const result = await updateUser(authUser.id, {
      isVerified: true,
      verifiedAt: timestamp
    })

    if (!result.success) {
      console.error(`[POST /api/users/account/verify] Failed to update user:`, result.error)
      return NextResponse.json(
        { success: false, error: 'Failed to verify account. Please try again.' },
        { status: 500 }
      )
    }

    // Refresh authentication tokens with verified status
    // This ensures subsequent requests will have isVerified: true in the token
    const tokenUser = {
      id: result.user.id,
      email: result.user.email,
      isAdmin: result.user.is_admin || false,
      isVerified: true
    }
    const accessToken = signToken(tokenUser)
    const refreshToken = signRefreshToken(tokenUser)

    console.log(`[POST /api/users/account/verify] ✅ Successfully verified account for: ${authUser.email}`)

    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Account verified successfully! You can now access all features.',
      user: {
        id: result.user.id,
        email: result.user.email,
        isVerified: result.user.is_verified,
        verifiedAt: result.user.verified_at
      }
    })

    // Set new HTTP-only cookies with updated verification status
    setAuthCookies(response, accessToken, refreshToken)

    return response

  } catch (error) {
    console.error('[POST /api/users/account/verify] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

