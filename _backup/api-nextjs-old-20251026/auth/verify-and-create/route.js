import { NextResponse } from 'next/server'
import { addUser, getUserByEmail } from '../../../../lib/supabaseDatabase.js'
import { signToken, signRefreshToken } from '../../../../lib/auth.js'
import { setAuthCookies } from '../../../../lib/authMiddleware.js'
import { verifyAndRemovePendingUser } from '../../../../lib/pendingUsers.js'

/**
 * POST /api/auth/verify-and-create
 * Verify confirmation code and create the actual user account
 * Public endpoint for completing registration
 */
export async function POST(request) {
  try {
    const body = await request.json()
    const { email, verificationCode } = body

    if (!email || !verificationCode) {
      return NextResponse.json(
        { success: false, error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    // Verify the pending user and get their data
    console.log('🔍 Attempting to verify pending user:', email)
    const verifyResult = await verifyAndRemovePendingUser(email, verificationCode)
    console.log('📋 Verify result:', { success: verifyResult.success, hasPassword: !!verifyResult.plainPassword })

    if (!verifyResult.success) {
      console.error('❌ Verification failed:', verifyResult.error)
      return NextResponse.json(
        { success: false, error: verifyResult.error },
        { status: 400 }
      )
    }

    // Double-check that user doesn't exist in Supabase
    // (in case they were created between pending registration and now)
    const existingUser = await getUserByEmail(verifyResult.email)
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists. Please sign in.' },
        { status: 409 }
      )
    }

    // Create the actual user in Supabase
    console.log('👤 Creating user account for:', verifyResult.email)
    const userData = {
      email: verifyResult.email,
      password: verifyResult.plainPassword, // Plain password for Supabase Auth
      isVerified: true, // Set as verified immediately since they just verified
      verifiedAt: new Date().toISOString()
    }

    const result = await addUser(userData)

    if (!result.success) {
      console.error('❌ Failed to create user after verification:', result.error)
      console.error('❌ Full error details:', JSON.stringify(result, null, 2))
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create account. Please try again.',
          details: result.error // Return actual error for debugging
        },
        { status: 500 }
      )
    }

    console.log('✅ User created successfully after verification:', {
      id: result.user.id,
      email: result.user.email,
      timestamp: new Date().toISOString()
    })

    // Create authentication session (auto-login after verification)
    const tokenUser = {
      id: result.user.id,
      email: result.user.email,
      isAdmin: result.user.is_admin || false
    }
    const accessToken = signToken(tokenUser)
    const refreshToken = signRefreshToken(tokenUser)

    // Prepare response with user data
    const safeUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      isVerified: result.user.is_verified,
      verifiedAt: result.user.verified_at,
      createdAt: result.user.created_at
    }

    const response = NextResponse.json({
      success: true,
      user: safeUser,
      message: 'Account created and verified successfully'
    }, { status: 201 })

    // Set HTTP-only cookies to authenticate the user
    setAuthCookies(response, accessToken, refreshToken)

    return response

  } catch (error) {
    console.error('❌ CRITICAL ERROR in POST /api/auth/verify-and-create:', error)
    console.error('Error stack:', error.stack)
    console.error('Error message:', error.message)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        // Include error details in development/testing
        debug: process.env.NODE_ENV !== 'production' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    )
  }
}

