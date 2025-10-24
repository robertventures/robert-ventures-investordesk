import { NextResponse } from 'next/server'
import { getUser, updateUser, addInvestment, updateInvestment as updateInvestmentDB, deleteInvestment as deleteInvestmentDB } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { getCurrentAppTime } from '../../../../lib/appTime.js'
import { decrypt, isEncrypted } from '../../../../lib/encryption.js'
import { signToken, signRefreshToken } from '../../../../lib/auth.js'
import { setAuthCookies } from '../../../../lib/authMiddleware.js'
import { generateSequentialInvestmentId } from '../../../../lib/idGenerator.js'

/**
 * Helper function to format user data for API response
 */
function formatUserForResponse(user) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    phoneNumber: user.phone_number,
    dob: user.dob,
    accountType: user.account_type,
    isAdmin: user.is_admin,
    isVerified: user.is_verified,
    verifiedAt: user.verified_at,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    banking: user.banking,
    entity: user.entity,
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
    authorizedRepresentative: user.authorized_representative || null,
    trustedContact: user.trusted_contact || null
  }
}

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

    // Fetch addresses from the addresses table
    const supabase = createServiceClient()
    const { data: addresses } = await supabase
      .from('addresses')
      .select('*')
      .eq('user_id', id)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: false })

    // Get primary address or use legacy address field
    const primaryAddress = addresses && addresses.length > 0 
      ? addresses.find(addr => addr.is_primary) || addresses[0]
      : null
    
    // Populate the address field from primary address or legacy field
    const addressData = primaryAddress ? {
      street1: primaryAddress.street1,
      street2: primaryAddress.street2,
      city: primaryAddress.city,
      state: primaryAddress.state,
      zip: primaryAddress.zip,
      country: primaryAddress.country
    } : (user.address || null)

    // Convert snake_case to camelCase for frontend
    const safeUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      dob: user.dob,
      address: addressData,
      accountType: user.account_type,
      isAdmin: user.is_admin,
      isVerified: user.is_verified,
      verifiedAt: user.verified_at,
      needsOnboarding: user.needs_onboarding || false,
      onboardingCompletedAt: user.onboarding_completed_at,
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
      banking: user.banking || null,
      addresses: (addresses || []).map(addr => ({
        id: addr.id,
        street1: addr.street1,
        street2: addr.street2,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
        country: addr.country,
        label: addr.label,
        isPrimary: addr.is_primary,
        createdAt: addr.created_at,
        updatedAt: addr.updated_at
      })),
      activity: (user.activity || []).map(act => ({
        ...act,
        investmentId: act.investment_id
      })),
      jointHolder: user.joint_holder || null,
      jointHoldingType: user.joint_holding_type || null,
      entityName: user.entity_name || null,
      entity: user.entity || null,
      authorizedRepresentative: user.authorized_representative || null,
      trustedContact: user.trusted_contact || null
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
    
    // Handle main user SSN - always include field if SSN exists
    if (user.ssn) {
      safeUser.ssn = handleSSN(user.ssn)
    } else {
      // Indicate no SSN on file
      safeUser.ssn = null
    }
    
    // Handle joint holder SSN
    if (safeUser.jointHolder) {
      if (user.joint_holder?.ssn) {
        safeUser.jointHolder = {
          ...safeUser.jointHolder,
          ssn: handleSSN(user.joint_holder.ssn)
        }
      } else {
        safeUser.jointHolder = {
          ...safeUser.jointHolder,
          ssn: null
        }
      }
    }
    
    // Handle authorized representative SSN
    if (safeUser.authorizedRepresentative) {
      if (user.authorized_representative?.ssn) {
        safeUser.authorizedRepresentative = {
          ...safeUser.authorizedRepresentative,
          ssn: handleSSN(user.authorized_representative.ssn)
        }
      } else {
        safeUser.authorizedRepresentative = {
          ...safeUser.authorizedRepresentative,
          ssn: null
        }
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
 * ⚠️ DEPRECATION NOTICE:
 * This endpoint's _action-based operations are deprecated and will be removed in a future version.
 * Please use the new dedicated endpoints instead:
 * 
 * - Profile updates: PUT /api/users/profile (NEW - RECOMMENDED)
 * - Verify account: POST /api/users/account/verify (NEW - replaces _action: 'verifyAccount')
 * - Password changes: POST /api/users/account/change-password (NEW)
 * - Create investment: POST /api/users/investments (NEW - replaces _action: 'startInvestment')
 * - Update investment: PUT /api/users/investments/[id] (NEW - replaces _action: 'updateInvestment')
 * - Delete investment: DELETE /api/users/investments/[id] (NEW - replaces _action: 'deleteInvestment')
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

    // Add deprecation warning if _action is used
    if (_action) {
      console.warn(`⚠️ [DEPRECATED] PUT /api/users/${id} with _action parameter is deprecated.`)
      console.warn(`   See /docs/API-REFACTORING-SUMMARY.md for migration guide.`)
    }

    // Handle special actions
    if (_action === 'startInvestment') {
      // ⚠️ DEPRECATED: Use POST /api/users/investments instead
      console.warn(`⚠️ [DEPRECATED] PUT /api/users/${id} with _action=startInvestment is deprecated. Use POST /api/users/investments instead.`)
      console.warn(`   Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md`)
      // Create a new investment
      if (!investment) {
        return NextResponse.json(
          { success: false, error: 'Investment data is required' },
          { status: 400 }
        )
      }

      // Generate sequential investment ID from database
      const newInvestmentId = await generateSequentialInvestmentId()
      
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
      // ⚠️ DEPRECATED: Use PUT /api/users/investments/[id] instead
      console.warn(`⚠️ [DEPRECATED] PUT /api/users/${id} with _action=updateInvestment is deprecated. Use PUT /api/users/investments/[investmentId] instead.`)
      console.warn(`   Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md`)
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

      // Fetch the full user object with updated investments
      const updatedUser = await getUser(id, true)
      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: 'Failed to fetch updated user data' },
          { status: 500 }
        )
      }

      // Convert snake_case to camelCase for frontend
      const safeUser = {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phoneNumber: updatedUser.phone_number,
        dob: updatedUser.dob,
        address: updatedUser.address,
        accountType: updatedUser.account_type,
        isAdmin: updatedUser.is_admin,
        isVerified: updatedUser.is_verified,
        verifiedAt: updatedUser.verified_at,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at,
        investments: (updatedUser.investments || []).map(inv => ({
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
        withdrawals: updatedUser.withdrawals || [],
        bankAccounts: updatedUser.bank_accounts || [],
        activity: updatedUser.activity || [],
        jointHolder: updatedUser.joint_holder || null,
        jointHoldingType: updatedUser.joint_holding_type || null,
        entityName: updatedUser.entity_name || null,
        authorizedRepresentative: updatedUser.authorized_representative || null
      }

      return NextResponse.json({
        success: true,
        investment: result.investment,
        user: safeUser
      })
    }

    if (_action === 'deleteInvestment') {
      // ⚠️ DEPRECATED: Use DELETE /api/users/investments/[id] instead
      console.warn(`⚠️ [DEPRECATED] PUT /api/users/${id} with _action=deleteInvestment is deprecated. Use DELETE /api/users/investments/[investmentId] instead.`)
      console.warn(`   Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md`)
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
      // ⚠️ DEPRECATED: Use POST /api/users/account/verify instead
      console.warn(`⚠️ [DEPRECATED] PUT /api/users/${id} with _action=verifyAccount is deprecated. Use POST /api/users/account/verify instead.`)
      console.warn(`   Migration guide: /docs/API-REFACTORING-QUICK-GUIDE.md`)
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

    if (_action === 'addBankAccount') {
      // Add a new bank account
      const { bankAccount } = body
      if (!bankAccount) {
        return NextResponse.json(
          { success: false, error: 'Bank account data is required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Check if this is the first bank account
        const { count: bankCount, error: countError } = await supabase
          .from('bank_accounts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', id)

        console.log('Bank account count for user:', bankCount)
        
        // Insert bank account
        const { data: newBank, error: insertError } = await supabase
          .from('bank_accounts')
          .insert({
            id: bankAccount.id,
            user_id: id,
            bank_id: bankAccount.bankId,
            bank_name: bankAccount.bankName,
            bank_logo: bankAccount.bankLogo || null,
            bank_color: bankAccount.bankColor || null,
            account_type: bankAccount.accountType,
            account_name: bankAccount.accountName,
            last4: bankAccount.last4,
            nickname: bankAccount.nickname,
            type: bankAccount.type || 'ach',
            created_at: bankAccount.createdAt || new Date().toISOString(),
            last_used_at: bankAccount.lastUsedAt || new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting bank account:', insertError)
          return NextResponse.json(
            { success: false, error: `Failed to add bank account: ${insertError.message}` },
            { status: 500 }
          )
        }

        // If this is the first bank account, set as default
        if (bankCount === 0) {
          console.log('Setting first bank as default')
          const user = await getUser(id)
          const currentBanking = user?.banking || {}
          
          await updateUser(id, {
            banking: {
              ...currentBanking,
              defaultBankAccountId: bankAccount.id,
              fundingMethod: currentBanking.fundingMethod || 'bank-transfer',
              payoutMethod: currentBanking.payoutMethod || 'bank-account'
            }
          })
        }

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser,
          bankAccount: newBank
        })
      } catch (error) {
        console.error('Error adding bank account:', error)
        return NextResponse.json(
          { success: false, error: `Internal error: ${error.message}` },
          { status: 500 }
        )
      }
    }

    if (_action === 'removeBankAccount') {
      // Remove a bank account
      const { bankAccountId } = body
      if (!bankAccountId) {
        return NextResponse.json(
          { success: false, error: 'Bank account ID is required' },
          { status: 400 }
        )
      }

      try {
        // Get user to check if this is the default bank
        const user = await getUser(id)
        if (!user) {
          return NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          )
        }

        const defaultBankId = user.banking?.defaultBankAccountId || user.banking?.default_bank_account_id
        if (defaultBankId === bankAccountId) {
          return NextResponse.json(
            { success: false, error: 'Cannot remove default bank account. Please set another account as default first.' },
            { status: 400 }
          )
        }

        const supabase = createServiceClient()
        
        // Delete bank account
        const { error: deleteError } = await supabase
          .from('bank_accounts')
          .delete()
          .eq('id', bankAccountId)
          .eq('user_id', id)

        if (deleteError) {
          console.error('Error deleting bank account:', deleteError)
          return NextResponse.json(
            { success: false, error: 'Failed to remove bank account' },
            { status: 500 }
          )
        }

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser
        })
      } catch (error) {
        console.error('Error removing bank account:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to remove bank account' },
          { status: 500 }
        )
      }
    }

    if (_action === 'setDefaultBank') {
      // Set default bank account
      const { bankAccountId } = body
      if (!bankAccountId) {
        return NextResponse.json(
          { success: false, error: 'Bank account ID is required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Verify bank account exists and belongs to user
        const { data: bankAccount, error: fetchError } = await supabase
          .from('bank_accounts')
          .select('id')
          .eq('id', bankAccountId)
          .eq('user_id', id)
          .maybeSingle()

        if (fetchError || !bankAccount) {
          return NextResponse.json(
            { success: false, error: 'Bank account not found' },
            { status: 404 }
          )
        }

        // Update user's default bank
        const user = await getUser(id)
        const currentBanking = user?.banking || {}
        
        const result = await updateUser(id, {
          banking: {
            ...currentBanking,
            defaultBankAccountId: bankAccountId
          }
        })

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
          )
        }

        // Update last_used_at for the bank account
        await supabase
          .from('bank_accounts')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', bankAccountId)

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser
        })
      } catch (error) {
        console.error('Error setting default bank:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to set default bank' },
          { status: 500 }
        )
      }
    }

    if (_action === 'addAddress') {
      // Add a new address
      const { address } = body
      if (!address) {
        return NextResponse.json(
          { success: false, error: 'Address data is required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Check if this is the first address
        const { count: addressCount, error: countError } = await supabase
          .from('addresses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', id)

        console.log('Address count for user:', addressCount)
        
        // Insert address
        const { data: newAddress, error: insertError } = await supabase
          .from('addresses')
          .insert({
            id: address.id || `addr-${Date.now()}`,
            user_id: id,
            street1: address.street1,
            street2: address.street2 || null,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country || 'United States',
            label: address.label || 'Home',
            is_primary: addressCount === 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting address:', insertError)
          return NextResponse.json(
            { success: false, error: `Failed to add address: ${insertError.message}` },
            { status: 500 }
          )
        }

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser,
          address: newAddress
        })
      } catch (error) {
        console.error('Error adding address:', error)
        return NextResponse.json(
          { success: false, error: `Internal error: ${error.message}` },
          { status: 500 }
        )
      }
    }

    if (_action === 'removeAddress') {
      // Remove an address
      const { addressId } = body
      if (!addressId) {
        return NextResponse.json(
          { success: false, error: 'Address ID is required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Check if this is the primary address
        const { data: addressToRemove, error: fetchError } = await supabase
          .from('addresses')
          .select('is_primary')
          .eq('id', addressId)
          .eq('user_id', id)
          .maybeSingle()

        if (fetchError || !addressToRemove) {
          return NextResponse.json(
            { success: false, error: 'Address not found' },
            { status: 404 }
          )
        }

        if (addressToRemove.is_primary) {
          return NextResponse.json(
            { success: false, error: 'Cannot remove primary address. Please set another address as primary first.' },
            { status: 400 }
          )
        }

        // Delete address
        const { error: deleteError } = await supabase
          .from('addresses')
          .delete()
          .eq('id', addressId)
          .eq('user_id', id)

        if (deleteError) {
          console.error('Error deleting address:', deleteError)
          return NextResponse.json(
            { success: false, error: 'Failed to remove address' },
            { status: 500 }
          )
        }

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser
        })
      } catch (error) {
        console.error('Error removing address:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to remove address' },
          { status: 500 }
        )
      }
    }

    if (_action === 'setDefaultAddress') {
      // Set primary address
      const { addressId } = body
      if (!addressId) {
        return NextResponse.json(
          { success: false, error: 'Address ID is required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Verify address exists and belongs to user
        const { data: address, error: fetchError } = await supabase
          .from('addresses')
          .select('id')
          .eq('id', addressId)
          .eq('user_id', id)
          .maybeSingle()

        if (fetchError || !address) {
          return NextResponse.json(
            { success: false, error: 'Address not found' },
            { status: 404 }
          )
        }

        // Set all addresses to non-primary
        await supabase
          .from('addresses')
          .update({ is_primary: false })
          .eq('user_id', id)

        // Set selected address as primary
        const { error: updateError } = await supabase
          .from('addresses')
          .update({ is_primary: true, updated_at: new Date().toISOString() })
          .eq('id', addressId)

        if (updateError) {
          console.error('Error setting primary address:', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to set primary address' },
            { status: 500 }
          )
        }

        // Fetch updated user data
        const updatedUser = await getUser(id, true)
        const safeUser = formatUserForResponse(updatedUser)

        return NextResponse.json({
          success: true,
          user: safeUser
        })
      } catch (error) {
        console.error('Error setting primary address:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to set primary address' },
          { status: 500 }
        )
      }
    }

    if (_action === 'setInitialPassword') {
      // Set initial password for imported users (no current password needed)
      const { password } = body
      if (!password) {
        return NextResponse.json(
          { success: false, error: 'Password is required' },
          { status: 400 }
        )
      }

      // Validate password strength
      if (password.length < 8) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 8 characters' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()

        // Get user auth_id
        const user = await getUser(id)
        if (!user || !user.auth_id) {
          return NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          )
        }

        // Update password directly via admin API (no current password verification needed)
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.auth_id,
          { password: password }
        )

        if (updateError) {
          console.error('Error setting initial password:', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to set password' },
            { status: 500 }
          )
        }

        console.log(`✅ Initial password set for user ${id}`)

        return NextResponse.json({
          success: true,
          message: 'Password set successfully'
        })

      } catch (error) {
        console.error('Error setting initial password:', error)
        return NextResponse.json(
          { success: false, error: 'Internal server error' },
          { status: 500 }
        )
      }
    }

    if (_action === 'changePassword') {
      // Change password (requires current password verification)
      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Both current and new password are required' },
          { status: 400 }
        )
      }

      try {
        const supabase = createServiceClient()
        
        // Get user auth_id
        const user = await getUser(id)
        if (!user || !user.auth_id) {
          return NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
          )
        }

        // Try to sign in with current password to verify it
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword
        })

        if (signInError) {
          return NextResponse.json(
            { success: false, error: 'Current password is incorrect' },
            { status: 400 }
          )
        }

        // Update password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.auth_id,
          { password: newPassword }
        )

        if (updateError) {
          console.error('Error updating password:', updateError)
          return NextResponse.json(
            { success: false, error: 'Failed to update password' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          message: 'Password updated successfully'
        })
      } catch (error) {
        console.error('Error changing password:', error)
        return NextResponse.json(
          { success: false, error: 'Failed to change password' },
          { status: 500 }
        )
      }
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
