import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'

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

    // Find user with this reset token
    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.resetToken === token)

    if (userIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired reset token' },
        { status: 400 }
      )
    }

    const user = usersData.users[userIndex]

    // Check if token is expired
    if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Reset token has expired' },
        { status: 400 }
      )
    }

    // Update password and verify account (since they received the email)
    const timestamp = new Date().toISOString()
    usersData.users[userIndex] = {
      ...user,
      password: newPassword,
      isVerified: true,
      verifiedAt: user.verifiedAt || timestamp, // Set verifiedAt if not already set
      resetToken: null,
      resetTokenExpiry: null,
      updatedAt: timestamp
    }

    // Save updated users
    const saved = await saveUsers(usersData)
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to update password' },
        { status: 500 }
      )
    }

    console.log('Password reset successful for user:', user.email)
    console.log('Account automatically verified:', user.email)

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

