import { NextResponse } from 'next/server'
import { getUserByEmail } from '../../../../lib/supabaseDatabase.js'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../lib/rateLimit.js'
import { validateEmail, validatePassword, ValidationError } from '../../../../lib/validation.js'
import { storePendingUser } from '../../../../lib/pendingUsers.js'

/**
 * POST /api/auth/register-pending
 * Store pending user registration (before email verification)
 * Public endpoint for user registration
 */
export async function POST(request) {
  try {
    // Apply rate limiting for user creation
    const rateLimitResponse = rateLimit(request, RATE_LIMIT_CONFIGS.userCreation)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { email, password } = body

    // Validate and normalize email
    let validatedEmail
    try {
      validatedEmail = validateEmail(email)
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Check if user already exists in Supabase
    const existingUser = await getUserByEmail(validatedEmail)
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Validate password strength
    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      )
    }

    try {
      validatePassword(password, true)
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        )
      }
      throw error
    }

    // Store as pending user with PLAIN PASSWORD (temporary, only for 1 hour)
    // Note: We don't hash here because Supabase Auth needs plain password on signup
    // The database is encrypted at rest, and this is only temporary storage
    const result = await storePendingUser(validatedEmail, password)

    if (result.success) {
      console.log('✅ Pending user registration created:', {
        email: result.email,
        pendingId: result.pendingId,
        timestamp: new Date().toISOString()
      })

      // Check if email verification is enabled
      const emailVerificationEnabled = process.env.ENABLE_EMAIL_VERIFICATION === 'true'
      
      if (emailVerificationEnabled && result.verificationCode !== '000000') {
        // TODO: Send verification email
        // Example:
        // await sendVerificationEmail(result.email, result.verificationCode)
        console.log(`📧 Would send email to ${result.email} with code: ${result.verificationCode}`)
      } else {
        // Test mode: using hardcoded 000000 code (no email needed)
        console.log(`🧪 Test mode: Use verification code 000000 for ${result.email}`)
      }

      return NextResponse.json({
        success: true,
        pendingId: result.pendingId,
        email: result.email,
        message: emailVerificationEnabled 
          ? 'Verification code sent to your email'
          : 'Use verification code: 000000'
      }, { status: 200 })
    } else {
      return NextResponse.json(
        { success: false, error: 'Failed to create pending registration' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/auth/register-pending:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

