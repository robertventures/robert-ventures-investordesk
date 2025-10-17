import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { getCurrentAppTime } from '../../../../lib/appTime.js'
import { decrypt, isEncrypted } from '../../../../lib/encryption.js'
import { signToken, signRefreshToken } from '../../../../lib/auth.js'
import { setAuthCookies } from '../../../../lib/authMiddleware.js'

/**
 * GET /api/users/[id]
 * Get user by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = params

    const user = await getUser(id)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Convert snake_case to camelCase for frontend
    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      dob: user.dob,
      address: user.address,
      accountType: user.account_type,
      isAdmin: user.is_admin,
      isVerified: user.is_verified,
      verifiedAt: user.verified_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      investments: user.investments || [],
      withdrawals: user.withdrawals || [],
      bankAccounts: user.bank_accounts || [],
      activity: user.activity || []
    }

    // Decrypt SSN if requested and user has permission
    // (You might want to add authentication checks here)
    const { searchParams } = new URL(request.url)
    const includeSSN = searchParams.get('includeSSN') === 'true'
    
    if (includeSSN && user.ssn) {
      if (isEncrypted(user.ssn)) {
        try {
          safeUser.ssn = decrypt(user.ssn)
        } catch (error) {
          console.error('Failed to decrypt SSN:', error)
          // Don't expose SSN if decryption fails
        }
      } else {
        safeUser.ssn = user.ssn
      }
    }

    return NextResponse.json({
      success: true,
      user: safeUser
    })

  } catch (error) {
    console.error('Error in GET /api/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/[id]
 * Update user profile data
 * 
 * For specific operations, use dedicated endpoints:
 * - Password changes: POST /api/users/[id]/password
 * - Investments: POST /api/users/[id]/investments
 * - Verification: POST /api/users/[id]/verify
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    const { _action, verificationCode, ...updateData } = body

    // Handle special actions
    if (_action === 'verifyAccount') {
      // Verify the code (in production, you'd validate the actual code)
      if (verificationCode !== '000000') {
        return NextResponse.json(
          { success: false, error: 'Invalid verification code' },
          { status: 400 }
        )
      }

      // Update user as verified
      const appTime = await getCurrentAppTime()
      const timestamp = appTime || new Date().toISOString()
      
      const result = await updateUser(id, {
        isVerified: true,
        verifiedAt: timestamp
      })

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      // Create authentication session (auto-login after verification)
      // Generate JWT tokens for this user
      const tokenUser = {
        id: result.user.id,
        email: result.user.email,
        isAdmin: result.user.is_admin || false
      }
      const accessToken = signToken(tokenUser)
      const refreshToken = signRefreshToken(tokenUser)

      // Create response with user data
      const response = NextResponse.json({
        success: true,
        user: {
          id: result.user.id,
          email: result.user.email,
          isVerified: result.user.is_verified,
          verifiedAt: result.user.verified_at
        }
      })

      // Set HTTP-only cookies to authenticate the user
      setAuthCookies(response, accessToken, refreshToken)

      return response
    }

    // Validate that we have at least one field to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields provided for update' },
        { status: 400 }
      )
    }

    // Remove fields that shouldn't be updated via this endpoint
    const restrictedFields = ['id', 'password', 'createdAt', 'isAdmin']
    restrictedFields.forEach(field => delete updateData[field])

    // Update user
    const result = await updateUser(id, updateData)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Convert response to camelCase
    const responseUser = {
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.first_name,
      lastName: result.user.last_name,
      phoneNumber: result.user.phone_number,
      dob: result.user.dob,
      address: result.user.address,
      accountType: result.user.account_type,
      isVerified: result.user.is_verified,
      updatedAt: result.user.updated_at
    }

    return NextResponse.json({
      success: true,
      user: responseUser
    })

  } catch (error) {
    console.error('Error in PUT /api/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/users/[id]
 * Delete user account
 * (Admin only - add authentication middleware)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params

    // TODO: Add admin authentication check here
    // const admin = await requireAdmin(request)
    // if (!admin) return authErrorResponse('Admin access required', 403)

    const supabase = createServiceClient()

    // Delete user from database
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting user:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to delete user' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error in DELETE /api/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
