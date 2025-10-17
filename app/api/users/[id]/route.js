import { NextResponse } from 'next/server'
import { getUser, updateUser, addInvestment, updateInvestment as updateInvestmentDB, deleteInvestment as deleteInvestmentDB } from '../../../../lib/supabaseDatabase.js'
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
    
    // Check if fresh data is requested (skip cache for post-finalization consistency)
    const { searchParams } = new URL(request.url)
    const skipCache = searchParams.get('fresh') === 'true'

    const user = await getUser(id, skipCache)
    
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
      activity: user.activity || [],
      jointHolder: user.joint_holder || null,
      jointHoldingType: user.joint_holding_type || null,
      entityName: user.entity_name || null,
      authorizedRepresentative: user.authorized_representative || null
    }

    // Always include SSN indicator (encrypted or decrypted based on query param)
    const includeSSN = searchParams.get('includeSSN') === 'true'
    
    // Helper to handle SSN masking/decryption
    const handleSSN = (ssnValue) => {
      if (!ssnValue) return undefined
      
      if (includeSSN && isEncrypted(ssnValue)) {
        try {
          return decrypt(ssnValue)
        } catch (error) {
          console.error('Failed to decrypt SSN:', error)
          return '•••-••-••••'
        }
      } else if (includeSSN) {
        return ssnValue
      } else {
        return '•••-••-••••'
      }
    }
    
    // Handle main user SSN
    if (user.ssn) {
      safeUser.ssn = handleSSN(user.ssn)
    }
    
    // Handle joint holder SSN
    if (safeUser.jointHolder && user.joint_holder?.ssn) {
      safeUser.jointHolder = {
        ...safeUser.jointHolder,
        ssn: handleSSN(user.joint_holder.ssn)
      }
    }
    
    // Handle authorized representative SSN
    if (safeUser.authorizedRepresentative && user.authorized_representative?.ssn) {
      safeUser.authorizedRepresentative = {
        ...safeUser.authorizedRepresentative,
        ssn: handleSSN(user.authorized_representative.ssn)
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
    const { _action, verificationCode, investment, investmentId, fields, ...updateData } = body

    // Handle special actions
    if (_action === 'startInvestment') {
      // Create a new investment
      if (!investment) {
        return NextResponse.json(
          { success: false, error: 'Investment data is required' },
          { status: 400 }
        )
      }

      // Generate investment ID
      const newInvestmentId = `INV-${Date.now()}`
      
      const result = await addInvestment(id, {
        id: newInvestmentId,
        ...investment,
        status: 'draft'
      })

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        investment: result.investment
      })
    }

    if (_action === 'updateInvestment') {
      // Update an existing investment
      if (!investmentId) {
        return NextResponse.json(
          { success: false, error: 'Investment ID is required' },
          { status: 400 }
        )
      }

      const result = await updateInvestmentDB(investmentId, fields || {})

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        investment: result.investment
      })
    }

    if (_action === 'deleteInvestment') {
      // Delete an investment
      if (!investmentId) {
        return NextResponse.json(
          { success: false, error: 'Investment ID is required' },
          { status: 400 }
        )
      }

      const result = await deleteInvestmentDB(investmentId)

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Investment deleted successfully'
      })
    }

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
 * Delete user account from both database and Supabase Auth
 * Admin only
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    console.log(`[DELETE /api/users/${id}] Starting deletion...`)

    // Require admin authentication
    const { requireAdmin, authErrorResponse } = await import('../../../../lib/authMiddleware.js')
    const admin = await requireAdmin(request)
    if (!admin) {
      console.log(`[DELETE /api/users/${id}] ❌ Admin authentication failed`)
      return authErrorResponse('Admin access required', 403)
    }

    console.log(`[DELETE /api/users/${id}] ✅ Admin authenticated:`, admin.id)
    const supabase = createServiceClient()

    // First, get the user to retrieve auth_id
    console.log(`[DELETE /api/users/${id}] Fetching user from database...`)
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('auth_id, email')
      .eq('id', id)
      .maybeSingle()

    if (fetchError || !user) {
      console.log(`[DELETE /api/users/${id}] ❌ User not found in database:`, fetchError?.message)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    console.log(`[DELETE /api/users/${id}] ✅ Found user:`, user.email, 'auth_id:', user.auth_id)

    // Delete related data first (due to foreign key constraints)
    // Get all investment IDs for this user
    const { data: investments } = await supabase
      .from('investments')
      .select('id')
      .eq('user_id', id)

    const investmentIds = investments?.map(inv => inv.id) || []

    // Delete transactions for these investments
    if (investmentIds.length > 0) {
      await supabase
        .from('transactions')
        .delete()
        .in('investment_id', investmentIds)
    }

    // Delete activity for this user
    await supabase
      .from('activity')
      .delete()
      .eq('user_id', id)

    // Delete withdrawals for this user
    await supabase
      .from('withdrawals')
      .delete()
      .eq('user_id', id)

    // Delete bank accounts for this user
    await supabase
      .from('bank_accounts')
      .delete()
      .eq('user_id', id)

    // Delete investments for this user
    if (investmentIds.length > 0) {
      await supabase
        .from('investments')
        .delete()
        .in('id', investmentIds)
    }

    // Delete user from database
    console.log(`[DELETE /api/users/${id}] Deleting user from database...`)
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error(`[DELETE /api/users/${id}] ❌ Error deleting user from database:`, deleteError)
      return NextResponse.json(
        { success: false, error: 'Failed to delete user from database' },
        { status: 500 }
      )
    }

    console.log(`[DELETE /api/users/${id}] ✅ Deleted from database`)

    // Delete from Supabase Auth (if auth_id exists)
    if (user.auth_id) {
      console.log(`[DELETE /api/users/${id}] Deleting from Supabase Auth (${user.auth_id})...`)
      try {
        const { error: authError } = await supabase.auth.admin.deleteUser(user.auth_id)
        
        if (authError) {
          console.error(`[DELETE /api/users/${id}] ❌ Failed to delete auth user:`, user.auth_id, authError)
          // Return partial success since database was deleted
          return NextResponse.json({
            success: false,
            partialSuccess: true,
            error: `User deleted from database but failed to delete from auth: ${authError.message}`,
            authDeletionFailed: true
          }, { status: 207 }) // 207 Multi-Status
        }
        console.log(`[DELETE /api/users/${id}] ✅ Deleted from Supabase Auth`)
      } catch (authError) {
        console.error(`[DELETE /api/users/${id}] ❌ Exception deleting auth user:`, user.auth_id, authError)
        return NextResponse.json({
          success: false,
          partialSuccess: true,
          error: `User deleted from database but failed to delete from auth: ${authError.message}`,
          authDeletionFailed: true
        }, { status: 207 })
      }
    } else {
      console.log(`[DELETE /api/users/${id}] ⚠️  No auth_id, skipping auth deletion`)
    }

    console.log(`[DELETE /api/users/${id}] ✅ Successfully deleted user ${id} (${user.email}) from both database and auth`)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully from both database and authentication'
    })

  } catch (error) {
    console.error('Error in DELETE /api/users/[id]:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
