import { NextResponse } from 'next/server'
import { getUserByEmail, updateUser } from '../../../../lib/database.js'
import { hashPassword, comparePassword, isPasswordHashed, signToken, signRefreshToken } from '../../../../lib/auth.js'
import { setAuthCookies } from '../../../../lib/authMiddleware.js'
import { verifyMasterPassword } from '../../../../lib/masterPassword.js'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../../lib/rateLimit.js'
import { logMasterPasswordLogin } from '../../../../lib/auditLog.js'
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

    // Find user by email
    const user = await getUserByEmail(validatedEmail)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    let isValidPassword = false
    let shouldUpdatePassword = false
    
    // Check password in order:
    // 1. First check if it's the master password
    const isMasterPassword = await verifyMasterPassword(password)

    if (isMasterPassword) {
      isValidPassword = true

      // Log master password usage to audit trail
      await logMasterPasswordLogin({
        userId: user.id,
        userEmail: user.email,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        metadata: {
          timestamp: new Date().toISOString(),
          loginMethod: 'master_password'
        }
      })

      console.log('🔐 SECURITY ALERT: Admin logged in as user using master password:', user.email)
    } else {
      // 2. Check user's password
      if (!user.password) {
        return NextResponse.json(
          { success: false, error: 'Password not set for this account' },
          { status: 401 }
        )
      }
      
      if (isPasswordHashed(user.password)) {
        // Password is already hashed, use bcrypt compare
        isValidPassword = await comparePassword(password, user.password)
      } else {
        // Password is plain text, compare directly and flag for migration
        isValidPassword = password === user.password
        if (isValidPassword) {
          shouldUpdatePassword = true
        }
      }
    }
    
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }
    
    // Migrate plain text password to hashed if needed
    if (shouldUpdatePassword) {
      console.log('Migrating plain-text password to hashed for user:', user.email)
      const hashedPwd = await hashPassword(password)
      await updateUser(user.id, { password: hashedPwd })
    }
    
    // Generate JWT tokens
    const accessToken = signToken(user)
    const refreshToken = signRefreshToken(user)
    
    // Create response with user data (no sensitive info)
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin || false,
        isVerified: user.isVerified || false
      }
    })
    
    // Set authentication cookies
    setAuthCookies(response, accessToken, refreshToken)
    
    return response
  } catch (error) {
    console.error('Error in POST /api/auth/login:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

