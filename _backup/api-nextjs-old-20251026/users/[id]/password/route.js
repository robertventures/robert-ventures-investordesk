import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../../lib/supabaseClient.js'
import { hashPassword, comparePassword, isPasswordHashed } from '../../../../../lib/auth.js'
import { getCurrentAppTime } from '../../../../../lib/appTime.js'

/**
 * POST /api/users/[id]/password
 * Change user password
 * 
 * ⚠️ DEPRECATION NOTICE:
 * This endpoint is deprecated and will be removed in a future version.
 * Please use POST /api/users/account/change-password instead.
 * 
 * Benefits of new endpoint:
 * - No need to pass user ID (uses auth token)
 * - Better rate limiting
 * - Clearer intent
 * - Better security monitoring
 * 
 * Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md
 */
export async function POST(request, { params }) {
  try {
    const { id } = params
    
    // Log deprecation warning
    console.warn(`⚠️ [DEPRECATED] POST /api/users/${id}/password is deprecated. Use POST /api/users/account/change-password instead.`)
    console.warn(`   Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md`)
    
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Missing password fields' },
        { status: 400 }
      )
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Get user from Supabase
    const user = await getUser(id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password via Supabase Auth
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    })

    if (signInError) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Update password via Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.auth_id,
      { password: newPassword }
    )

    if (updateError) {
      console.error('Error updating password:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Update timestamp in users table
    const appTime = await getCurrentAppTime()
    await updateUser(id, {
      updatedAt: appTime || new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/users/[id]/password:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

