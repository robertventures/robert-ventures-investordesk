import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../../../lib/supabaseClient.js'
import { requireAuth, authErrorResponse } from '../../../../../../lib/authMiddleware'
import { getCurrentAppTime } from '../../../../../../lib/appTime.js'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../../../lib/rateLimit'
import { validatePassword, ValidationError } from '../../../../../../lib/validation'

/**
 * POST /api/users/account/change-password
 * Change current user's password
 * 
 * This endpoint replaces: POST /api/users/[id]/password
 * Benefits:
 * - Clearer intent (obviously for password changes)
 * - Better rate limiting (10 requests/hour to prevent abuse)
 * - No need to pass user ID (uses auth token)
 * - Better security monitoring
 * 
 * Request body:
 * {
 *   "currentPassword": "OldPassword123!",
 *   "newPassword": "NewPassword456!"
 * }
 * 
 * Password requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Password changed successfully"
 * }
 */
export async function POST(request) {
  try {
    // Apply strict rate limiting (10 requests per hour to prevent brute force)
    const rateLimitConfig = {
      ...RATE_LIMIT_CONFIGS.default,
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10 // Only 10 attempts per hour
    }
    const rateLimitResponse = rateLimit(request, rateLimitConfig)
    if (rateLimitResponse) {
      console.warn('[POST /api/users/account/change-password] Rate limit exceeded')
      return rateLimitResponse
    }

    // Require authentication
    const authUser = await requireAuth(request)
    if (!authUser) {
      return authErrorResponse('Authentication required', 401)
    }

    console.log(`[POST /api/users/account/change-password] Password change attempt for user: ${authUser.id}`)

    const { currentPassword, newPassword } = await request.json()

    // Validate required fields
    if (!currentPassword || !newPassword) {
      console.warn(`[POST /api/users/account/change-password] Missing password fields for user: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'Both current password and new password are required' },
        { status: 400 }
      )
    }

    // Validate new password strength
    try {
      validatePassword(newPassword, true) // true = require strong password
    } catch (error) {
      if (error instanceof ValidationError) {
        console.warn(`[POST /api/users/account/change-password] Weak password for user: ${authUser.id}`)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      console.warn(`[POST /api/users/account/change-password] New password same as current for user: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get user from database to get email
    const user = await getUser(authUser.id)
    if (!user) {
      console.error(`[POST /api/users/account/change-password] User not found: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password via Supabase Auth
    console.log(`[POST /api/users/account/change-password] Verifying current password for: ${user.email}`)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    })

    if (signInError) {
      console.warn(`[POST /api/users/account/change-password] Invalid current password for user: ${authUser.id}`)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Current password is incorrect. Please try again.' 
        },
        { status: 400 }
      )
    }

    // Update password via Supabase Auth
    console.log(`[POST /api/users/account/change-password] Updating password for user: ${authUser.id}`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.auth_id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('[POST /api/users/account/change-password] Error updating password:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update password. Please try again.' },
        { status: 500 }
      )
    }

    // Update timestamp in users table
    const appTime = await getCurrentAppTime()
    await updateUser(authUser.id, {
      updatedAt: appTime || new Date().toISOString()
    })

    console.log(`[POST /api/users/account/change-password] ✅ Successfully changed password for: ${user.email}`)

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. Please use your new password for future logins.'
    })
    
  } catch (error) {
    console.error('[POST /api/users/account/change-password] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

