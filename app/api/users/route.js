import { NextResponse } from 'next/server'
import { getUsers, addUser, getUserByEmail } from '../../../lib/supabaseDatabase.js'
import { getCurrentAppTime } from '../../../lib/appTime'
import { hashPassword } from '../../../lib/auth'
import { requireAdmin, requireAuth, authErrorResponse } from '../../../lib/authMiddleware'
import { rateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit'
import { validateEmail, validatePassword, ValidationError } from '../../../lib/validation'

// GET - Retrieve all users or a specific user by email
// REQUIRES AUTHENTICATION: Admin for all users, or authenticated user for their own data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const action = searchParams.get('action')

    // Admin-only operations: cleanup and listing all users
    if (action === 'cleanup' || !email) {
      const admin = await requireAdmin(request)
      if (!admin) {
        return authErrorResponse('Admin access required', 403)
      }

      if (action === 'cleanup') {
        // Cleanup is no longer needed with Supabase (database enforces uniqueness)
        return NextResponse.json({ success: true, message: 'Cleanup not needed with Supabase' })
      }

      // Get all users (admin only)
      const usersData = await getUsers()
      const appTime = await getCurrentAppTime()

      // Convert snake_case to camelCase for frontend compatibility
      const users = (usersData.users || []).map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        phoneNumber: u.phone_number,
        dob: u.dob,
        address: u.address,
        isAdmin: u.is_admin,
        isVerified: u.is_verified,
        verifiedAt: u.verified_at,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        investments: u.investments || [],
        withdrawals: u.withdrawals || [],
        bankAccounts: u.bank_accounts || [],
        activity: u.activity || []
      }))

      return NextResponse.json({
        success: true,
        users,
        timeMachine: {
          appTime: appTime || new Date().toISOString(),
          isActive: !!appTime,
          realTime: new Date().toISOString()
        }
      })
    }

    // Get specific user by email - require authentication
    const authUser = await requireAuth(request)
    if (!authUser) {
      return authErrorResponse('Authentication required', 401)
    }

    // Validate email format
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

    // Users can only access their own data unless they're admin
    if (validatedEmail !== authUser.email && !authUser.isAdmin) {
      return authErrorResponse('You can only access your own user data', 403)
    }

    const dbUser = await getUserByEmail(validatedEmail)
    if (dbUser) {
      // Convert snake_case to camelCase
      const user = {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.first_name,
        lastName: dbUser.last_name,
        phoneNumber: dbUser.phone_number,
        dob: dbUser.dob,
        ssn: dbUser.ssn,
        address: dbUser.address,
        isAdmin: dbUser.is_admin,
        isVerified: dbUser.is_verified,
        verifiedAt: dbUser.verified_at,
        createdAt: dbUser.created_at,
        updatedAt: dbUser.updated_at
      }
      
      // Don't expose sensitive fields to non-admin users
      if (!authUser.isAdmin) {
        const { ssn, ...safeUser } = user
        return NextResponse.json({ success: true, user: safeUser })
      }
      return NextResponse.json({ success: true, user })
    } else {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error in GET /api/users:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new user
// Public endpoint for user registration
// Admin-created users can be created via the import system
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

    // Check if user already exists
    const existingUser = await getUserByEmail(validatedEmail)
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password if provided
    let userData = { email: validatedEmail }
    if (password) {
      // Validate password strength
      try {
        validatePassword(password, true)
        userData.password = await hashPassword(password)
      } catch (error) {
        if (error instanceof ValidationError) {
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
          )
        }
        throw error
      }
    }

    // Add new user
    const result = await addUser(userData)

    if (result.success) {
      console.log('✅ User created successfully:', {
        id: result.user.id,
        email: result.user.email,
        timestamp: new Date().toISOString()
      })
      // Convert snake_case to camelCase and don't return sensitive data
      const safeUser = {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.first_name,
        lastName: result.user.last_name,
        isVerified: result.user.is_verified,
        createdAt: result.user.created_at
      }
      return NextResponse.json({ success: true, user: safeUser }, { status: 201 })
    } else {
      console.error('❌ Failed to create user:', result.error)
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in POST /api/users:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
