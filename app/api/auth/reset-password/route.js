import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { hashPassword } from '../../../../lib/auth'

// POST /api/auth/reset-password
// Reset password with a valid token
export async function POST(request) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Token and new password are required' },
        { status: 400 }
      )
    }

    // Validate password requirements
    const hasUppercase = /[A-Z]/.test(newPassword)
    const hasNumber = /[0-9]/.test(newPassword)
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword)
    const hasMinLength = newPassword.length >= 8

    if (!hasUppercase || !hasNumber || !hasSpecial || !hasMinLength) {
      return NextResponse.json(
        { success: false, error: 'Password does not meet requirements' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Find user with this reset token
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('reset_token', token)
      .maybeSingle()

    if (findError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    // Check if token is expired
    if (user.reset_token_expiry && new Date(user.reset_token_expiry) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    // Hash the new password before storing
    const hashedPassword = await hashPassword(newPassword)

    // Update password via Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      user.auth_id,
      { password: newPassword }
    )

    if (authError) {
      console.error('Error updating password in Supabase Auth:', authError)
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      )
    }

    // Update user record and verify account
    const timestamp = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_verified: true,
        verified_at: user.verified_at || timestamp,
        reset_token: null,
        reset_token_expiry: null,
        updated_at: timestamp
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user record:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true,
      message: 'Password reset successful. Your account has been verified.'
    })
  } catch (error) {
    console.error('Error in reset-password:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

