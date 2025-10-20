import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../lib/supabaseDatabase.js'
import { requireAuth, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { validateEmail, ValidationError } from '../../../../lib/validation.js'
import { decrypt, isEncrypted } from '../../../../lib/encryption.js'

/**
 * GET /api/users/profile
 * Get current authenticated user's profile
 * 
 * This endpoint replaces: GET /api/users/[id]
 * Benefits:
 * - No need to pass user ID (uses auth token)
 * - Simpler frontend code
 * - Clearer intent
 * - Better security (users can only access their own profile)
 */
export async function GET(request) {
  try {
    // Get authenticated user from middleware
    const authUser = await requireAuth(request)
    if (!authUser) {
      return authErrorResponse('Authentication required', 401)
    }

    console.log(`[GET /api/users/profile] Fetching profile for user: ${authUser.id}`)

    // Check for fresh data request (skip cache)
    const { searchParams } = new URL(request.url)
    const skipCache = searchParams.get('fresh') === 'true'
    const includeSSN = searchParams.get('includeSSN') === 'true'

    // Fetch full user data
    const user = await getUser(authUser.id, skipCache)
    
    if (!user) {
      console.error(`[GET /api/users/profile] User not found: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

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
      investments: (user.investments || []).map(inv => ({
        ...inv,
        paymentFrequency: inv.payment_frequency,
        lockupPeriod: inv.lockup_period,
        accountType: inv.account_type,
        paymentMethod: inv.payment_method,
        personalInfo: inv.personal_info,
        requiresManualApproval: inv.requires_manual_approval,
        manualApprovalReason: inv.manual_approval_reason,
        submittedAt: inv.submitted_at,
        confirmedAt: inv.confirmed_at,
        confirmedByAdminId: inv.confirmed_by_admin_id,
        confirmationSource: inv.confirmation_source,
        rejectedAt: inv.rejected_at,
        rejectedByAdminId: inv.rejected_by_admin_id,
        rejectionSource: inv.rejection_source,
        lockupEndDate: inv.lockup_end_date,
        withdrawnAt: inv.withdrawn_at,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
        totalEarnings: inv.total_earnings,
        finalValue: inv.final_value,
        withdrawalNoticeStartAt: inv.withdrawal_notice_start_at,
        autoApproved: inv.auto_approved
      })),
      withdrawals: user.withdrawals || [],
      bankAccounts: user.bank_accounts || [],
      activity: (user.activity || []).map(act => ({
        ...act,
        investmentId: act.investment_id
      })),
      jointHolder: user.joint_holder || null,
      jointHoldingType: user.joint_holding_type || null,
      entityName: user.entity_name || null,
      authorizedRepresentative: user.authorized_representative || null
    }

    // Handle SSN fields
    if (user.ssn) {
      safeUser.ssn = handleSSN(user.ssn)
    }
    
    if (safeUser.jointHolder && user.joint_holder?.ssn) {
      safeUser.jointHolder = {
        ...safeUser.jointHolder,
        ssn: handleSSN(user.joint_holder.ssn)
      }
    }
    
    if (safeUser.authorizedRepresentative && user.authorized_representative?.ssn) {
      safeUser.authorizedRepresentative = {
        ...safeUser.authorizedRepresentative,
        ssn: handleSSN(user.authorized_representative.ssn)
      }
    }

    console.log(`[GET /api/users/profile] ✅ Successfully fetched profile for: ${authUser.email}`)

    return NextResponse.json({
      success: true,
      user: safeUser
    })

  } catch (error) {
    console.error('[GET /api/users/profile] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/users/profile
 * Update current authenticated user's profile
 * 
 * This endpoint replaces: PUT /api/users/[id] (without _action)
 * Benefits:
 * - Clear intent (only profile updates)
 * - No confusion with other operations
 * - Better validation
 * - Clearer permissions
 * 
 * Note: For other operations, use dedicated endpoints:
 * - Password changes: POST /api/users/account/change-password
 * - Account verification: POST /api/users/account/verify
 * - Investments: POST /api/users/investments (and related endpoints)
 */
export async function PUT(request) {
  try {
    // Get authenticated user
    const authUser = await requireAuth(request)
    if (!authUser) {
      return authErrorResponse('Authentication required', 401)
    }

    console.log(`[PUT /api/users/profile] Updating profile for user: ${authUser.id}`)

    const body = await request.json()
    
    // Define allowed profile fields (explicitly whitelist what can be updated)
    const allowedFields = [
      'firstName',
      'lastName', 
      'phoneNumber',
      'dob',
      'address',
      'accountType',
      'jointHolder',
      'jointHoldingType',
      'entityName',
      'entityType',
      'taxId',
      'entityRegistrationDate',
      'entityAddress',
      'authorizedRepresentative',
      'iraType',
      'iraCustodian',
      'iraAccountNumber',
      'ssn' // SSN can be updated (will be encrypted in updateUser)
    ]
    
    // Filter update data to only allowed fields
    const updateData = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Validate that we have at least one field to update
    if (Object.keys(updateData).length === 0) {
      console.warn(`[PUT /api/users/profile] No valid fields to update for user: ${authUser.id}`)
      return NextResponse.json(
        { success: false, error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    console.log(`[PUT /api/users/profile] Updating fields:`, Object.keys(updateData))

    // Update user
    const result = await updateUser(authUser.id, updateData)
    
    if (!result.success) {
      console.error(`[PUT /api/users/profile] Update failed:`, result.error)
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
      jointHolder: result.user.joint_holder,
      jointHoldingType: result.user.joint_holding_type,
      entityName: result.user.entity_name,
      authorizedRepresentative: result.user.authorized_representative,
      isVerified: result.user.is_verified,
      updatedAt: result.user.updated_at
    }

    console.log(`[PUT /api/users/profile] ✅ Successfully updated profile for: ${authUser.email}`)

    return NextResponse.json({
      success: true,
      user: responseUser,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('[PUT /api/users/profile] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/profile
 * Partial update of current user's profile
 * 
 * Same as PUT but semantically indicates partial update
 * Useful for single-field updates (e.g., just phone number)
 */
export async function PATCH(request) {
  // Reuse PUT logic (both do partial updates in our case)
  return PUT(request)
}

