import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../../lib/supabaseDatabase.js'
import { getCurrentAppTime } from '../../../../../lib/appTime.js'

/**
 * POST /api/users/[id]/verify
 * Verify user account with code
 * 
 * NOTE: With Supabase Auth, email verification is typically handled automatically.
 * This endpoint is kept for backward compatibility or custom verification flows.
 */
export async function POST(request, { params }) {
  try {
    const { id } = params
    const { verificationCode } = await request.json()

    if (!verificationCode) {
      return NextResponse.json(
        { success: false, error: 'Verification code is required' },
        { status: 400 }
      )
    }

    // Get user
    const user = await getUser(id)
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already verified
    if (user.is_verified) {
      return NextResponse.json(
        { success: false, error: 'Account is already verified' },
        { status: 400 }
      )
    }

    // TODO: Implement actual verification code checking
    // For now, we'll assume any code works (this should be improved)
    // In production, you'd want to:
    // 1. Store verification codes in the database
    // 2. Check if code matches and hasn't expired
    // 3. Or use Supabase Auth's built-in email verification

    // Mark user as verified
    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()

    const result = await updateUser(id, {
      isVerified: true,
      verifiedAt: timestamp
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Failed to verify account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Account verified successfully',
      user: {
        id: result.user.id,
        email: result.user.email,
        isVerified: result.user.is_verified,
        verifiedAt: result.user.verified_at
      }
    })

  } catch (error) {
    console.error('Error in POST /api/users/[id]/verify:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

