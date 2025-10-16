import { NextResponse } from 'next/server'
import { getUserByEmail } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { verifyMasterPassword } from '../../../../lib/masterPassword.js'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../lib/rateLimit.js'
import { logAuditEvent } from '../../../../lib/supabaseDatabase.js'
import { validateEmail, ValidationError } from '../../../../lib/validation.js'

export async function POST(request) {
  try {
    const { email, password } = await request.json()

    // Validate input
    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      )
    }

    // Validate and normalize email
    let validatedEmail
    try {
      validatedEmail = validateEmail(email)
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' }, // Don't reveal which field is invalid
          { status: 401 }
        )
      }
      throw error
    }

    // Apply rate limiting - strict limits for authentication
    // Uses both IP and email to prevent attacks targeting specific accounts
    const rateLimitResponse = rateLimit(request, RATE_LIMIT_CONFIGS.auth, validatedEmail)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = createServiceClient()

    // Check if master password first
    const isMasterPassword = await verifyMasterPassword(password)

    if (isMasterPassword) {
      // Master password login - find user and create session
      const user = await getUserByEmail(validatedEmail)
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Invalid email or password' },
          { status: 401 }
        )
      }

      // Log master password usage
      await logAuditEvent({
        userId: user.id,
        adminId: 'MASTER_PASSWORD',
        action: 'master_password_login',
        resourceType: 'auth',
        resourceId: user.id,
        details: { email: user.email },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      })

      console.log('🔐 SECURITY ALERT: Admin logged in as user using master password:', user.email)

      // Create Supabase session for this user
      const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: user.email
      })

      if (sessionError || !sessionData) {
        console.error('Failed to create master password session:', sessionError)
        return NextResponse.json(
          { success: false, error: 'Failed to create session' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          isAdmin: user.is_admin || false,
          isVerified: user.is_verified || false
        },
        session: {
          access_token: sessionData.properties.action_link.split('token=')[1] || null
        }
      })
    }

    // Regular password login with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: validatedEmail,
      password
    })

    if (authError || !authData.user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get user data from our users table
    const user = await getUserByEmail(validatedEmail)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Return user data with session
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin || false,
        isVerified: user.is_verified || false
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token
      }
    })
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

