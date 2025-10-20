import { NextResponse } from 'next/server'
import { getUserByEmail, updateUser } from '../../../../lib/supabaseDatabase.js'
import crypto from 'crypto'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../lib/rateLimit.js'

// POST /api/auth/request-reset
// Request a password reset link
export async function POST(request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Apply rate limiting for password reset requests
    const rateLimitResponse = rateLimit(request, RATE_LIMIT_CONFIGS.passwordReset, email)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Find user by email
    const user = await getUserByEmail(email)

    if (!user) {
      // For security, we still return success to prevent email enumeration
      return NextResponse.json({ success: true })
    }

    // Generate a unique reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000).toISOString() // 1 hour from now

    // Update user with reset token
    const result = await updateUser(user.id, {
      resetToken,
      resetTokenExpiry
    })

    if (!result.success) {
      console.error('Failed to save reset token for user:', user.id)
      return NextResponse.json(
        { success: false, error: 'Failed to process request' },
        { status: 500 }
      )
    }

    // In production, you would send an email here
    return NextResponse.json({ 
      success: true,
      // In dev mode, include the token (remove in production!)
      ...(process.env.NODE_ENV === 'development' && { 
        token: resetToken,
        resetUrl: `http://localhost:3000/reset-password?token=${resetToken}`
      })
    })
  } catch (error) {
    console.error('Error in request-reset:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

