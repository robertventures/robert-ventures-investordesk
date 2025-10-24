/**
 * Supabase Database Operations
 * Replaces lib/database.js with Supabase PostgreSQL operations
 * 
 * CACHING: Currently DISABLED for testing and development
 * - Cache infrastructure exists in lib/cache.js
 * - Can be enabled in production by removing skipCache checks below
 * - Currently all reads go directly to database for data consistency during testing
 */

import { createServiceClient } from './supabaseClient.js'
import { signUp } from './supabaseAuth.js'
import { generateUserId, generateTransactionId } from './idGenerator.js'
import { encrypt, decrypt, isEncrypted } from './encryption.js'
import { getCurrentAppTime } from './appTime.js'
import cache, { CACHE_KEYS, CACHE_TTL } from './cache.js'

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @param {boolean} skipCache - Skip cache and force fresh data
 * @returns {Promise<object|null>}
 */
export async function getUser(userId, skipCache = false) {
  try {
    // CACHING DISABLED: Always fetch fresh data for testing/development
    // To enable caching, uncomment the block below:
    // if (!skipCache) {
    //   const cached = cache.get(CACHE_KEYS.USER_BY_ID(userId))
    //   if (cached) return cached
    // }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        investments (*),
        bank_accounts (*),
        withdrawals (*)
      `)
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error getting user:', error)
      return null
    }
    
    if (!data) {
      console.error('User not found:', userId)
      return null
    }

    // Process investments to include transactions and activity
    if (data && data.investments) {
      for (let i = 0; i < data.investments.length; i++) {
        const investment = data.investments[i]
        
        // Get transactions for this investment
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*')
          .eq('investment_id', investment.id)
          .order('date', { ascending: true })

        investment.transactions = transactions || []
      }
    }

    // Get activity
    if (data) {
      const { data: activity } = await supabase
        .from('activity')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })

      data.activity = activity || []
    }

    // CACHING DISABLED: Uncomment to enable caching in production
    // if (data && !skipCache) {
    //   cache.set(CACHE_KEYS.USER_BY_ID(userId), data, CACHE_TTL.USER)
    // }

    return data
  } catch (error) {
    console.error('Error in getUser:', error)
    return null
  }
}

/**
 * Get user by email
 * @param {string} email - User email
 * @param {boolean} skipCache - Skip cache and force fresh data
 * @returns {Promise<object|null>}
 */
export async function getUserByEmail(email, skipCache = false) {
  try {
    const normalizedEmail = email.toLowerCase().trim()
    
    // CACHING DISABLED: Always fetch fresh data for testing/development
    // To enable caching, uncomment the block below:
    // if (!skipCache) {
    //   const cached = cache.get(CACHE_KEYS.USER_BY_EMAIL(normalizedEmail))
    //   if (cached) return cached
    // }
    
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (error) {
      console.error('Error getting user by email:', error)
      return null
    }
    
    if (!data) {
      // No user found
      return null
    }

    // CACHING DISABLED: Uncomment to enable caching in production
    // if (data && !skipCache) {
    //   cache.set(CACHE_KEYS.USER_BY_EMAIL(normalizedEmail), data, CACHE_TTL.USER)
    // }

    return data
  } catch (error) {
    console.error('Error in getUserByEmail:', error)
    return null
  }
}

/**
 * Create a new user
 * @param {object} userData - User data
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function addUser(userData) {
  try {
    const supabase = createServiceClient()

    const normalizedEmail = userData.email.toLowerCase().trim()

    // Check for existing user
    const existing = await getUserByEmail(normalizedEmail)
    if (existing) {
      console.log('Duplicate user detected:', normalizedEmail)
      return { success: false, error: 'User with this email already exists' }
    }

    // Generate user ID
    const userId = await generateUserId()

    // Use app time for timestamps
    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()

    // Encrypt SSN if provided
    let encryptedSSN = userData.ssn || ''
    if (encryptedSSN && !isEncrypted(encryptedSSN)) {
      try {
        encryptedSSN = encrypt(encryptedSSN)
        console.log('SSN encrypted for new user:', normalizedEmail)
      } catch (error) {
        console.error('Failed to encrypt SSN:', error)
        return { success: false, error: 'Failed to secure sensitive data' }
      }
    }

    // Create auth user first
    // Note: password can be plain text OR pre-hashed (from pending users verification)
    const authResult = await signUp(normalizedEmail, userData.password || '', {
      firstName: userData.firstName,
      lastName: userData.lastName
    })

    if (!authResult.success) {
      console.error('❌ Supabase Auth signup failed:', authResult.error)
      return { success: false, error: authResult.error }
    }

    // Create user record
    const newUser = {
      id: userId,
      auth_id: authResult.user.id,
      email: normalizedEmail,
      first_name: userData.firstName || '',
      last_name: userData.lastName || '',
      phone_number: userData.phoneNumber || '',
      dob: userData.dob || '',
      ssn: encryptedSSN,
      is_verified: userData.isVerified || false,
      verified_at: userData.verifiedAt || null,
      is_admin: userData.isAdmin || false,
      address: userData.address || null,
      created_at: timestamp,
      updated_at: timestamp
    }

    const { data: insertedUser, error: insertError } = await supabase
      .from('users')
      .insert(newUser)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error inserting user record:', insertError)
      // Clean up auth user
      await supabase.auth.admin.deleteUser(authResult.user.id)
      return { success: false, error: insertError.message }
    }

    // Create initial activity
    await supabase
      .from('activity')
      .insert({
        id: generateTransactionId('USR', userId, 'account_created'),
        user_id: userId,
        type: 'account_created',
        date: timestamp
      })

    console.log('✅ New user added:', normalizedEmail)
    
    // Cache invalidation not needed (caching disabled)
    // cache.delete(CACHE_KEYS.ALL_USERS)
    
    return { success: true, user: insertedUser }
  } catch (error) {
    console.error('❌ Fatal error in addUser:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update user data
 * @param {string} userId - User ID
 * @param {object} updateData - Fields to update
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function updateUser(userId, updateData) {
  try {
    const supabase = createServiceClient()

    // Encrypt SSN if being updated
    if (updateData.ssn && !isEncrypted(updateData.ssn)) {
      try {
        updateData.ssn = encrypt(updateData.ssn)
        console.log('SSN encrypted for user update:', userId)
      } catch (error) {
        console.error('Failed to encrypt SSN:', error)
        return { success: false, error: 'Failed to secure sensitive data' }
      }
    }

    // Convert camelCase to snake_case for database
    const dbData = {}
    const fieldMap = {
      firstName: 'first_name',
      lastName: 'last_name',
      phoneNumber: 'phone_number',
      isVerified: 'is_verified',
      verifiedAt: 'verified_at',
      isAdmin: 'is_admin',
      accountType: 'account_type',
      jointHolder: 'joint_holder',
      jointHoldingType: 'joint_holding_type',
      entityName: 'entity_name',
      authorizedRepresentative: 'authorized_representative',
      taxInfo: 'tax_info',
      needsOnboarding: 'needs_onboarding',
      onboardingToken: 'onboarding_token',
      onboardingTokenExpires: 'onboarding_token_expires',
      onboardingCompletedAt: 'onboarding_completed_at'
    }

    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key] || key
      dbData[dbKey] = value
    }

    dbData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('users')
      .update(dbData)
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (error) {
      console.error('Error updating user:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      console.error('User not found for update:', userId)
      return { success: false, error: 'User not found' }
    }

    console.log('User updated:', userId)
    
    // Cache invalidation not needed (caching disabled)
    // cache.delete(CACHE_KEYS.USER_BY_ID(userId))
    // cache.delete(CACHE_KEYS.ALL_USERS)
    // if (data.email) {
    //   cache.delete(CACHE_KEYS.USER_BY_EMAIL(data.email.toLowerCase()))
    // }
    
    return { success: true, user: data }
  } catch (error) {
    console.error('Error in updateUser:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all users (admin function)
 * PERFORMANCE: Uses optimized batch queries
 * @param {boolean} skipCache - Skip cache and force fresh data (not currently used)
 * @returns {Promise<{users: Array}>}
 */
export async function getUsers(skipCache = false) {
  try {
    // CACHING DISABLED: Always fetch fresh data for testing/development
    // To enable caching, uncomment the block below:
    // if (!skipCache) {
    //   const cached = cache.get(CACHE_KEYS.ALL_USERS)
    //   if (cached) return cached
    // }

    const supabase = createServiceClient()

    // Fetch users with all related data
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        investments (*),
        bank_accounts (*),
        withdrawals (*)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error getting users:', error)
      return { users: [] }
    }

    // PERFORMANCE FIX: Batch fetch all transactions and activity at once instead of N+1 queries
    if (data && data.length > 0) {
      // Collect all investment IDs and user IDs
      const investmentIds = []
      const userIds = data.map(u => u.id)
      
      data.forEach(user => {
        if (user.investments && user.investments.length > 0) {
          investmentIds.push(...user.investments.map(inv => inv.id))
        }
      })

      // Batch fetch all transactions for all investments
      let allTransactions = []
      if (investmentIds.length > 0) {
        const { data: transactions } = await supabase
          .from('transactions')
          .select('*')
          .in('investment_id', investmentIds)
          .order('date', { ascending: true })
        
        allTransactions = transactions || []
      }

      // Batch fetch all activity for all users
      const { data: allActivity } = await supabase
        .from('activity')
        .select('*')
        .in('user_id', userIds)
        .order('date', { ascending: false })

      // Map transactions to investments and convert to camelCase
      const transactionsByInvestment = {}
      allTransactions.forEach(tx => {
        // Convert snake_case database fields to camelCase for frontend
        const transaction = {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          status: tx.status,
          date: tx.date,
          investmentId: tx.investment_id
        }
        
        // Add optional fields if they exist
        if (tx.display_date) transaction.displayDate = tx.display_date
        if (tx.month_index) transaction.monthIndex = tx.month_index
        if (tx.lockup_period) transaction.lockupPeriod = tx.lockup_period
        if (tx.payment_frequency) transaction.paymentFrequency = tx.payment_frequency
        if (tx.payout_method) transaction.payoutMethod = tx.payout_method
        if (tx.payout_bank_id) transaction.payoutBankId = tx.payout_bank_id
        if (tx.payout_bank_nickname) transaction.payoutBankNickname = tx.payout_bank_nickname
        if (tx.principal !== undefined) transaction.principal = tx.principal
        if (tx.distribution_tx_id) transaction.distributionTxId = tx.distribution_tx_id
        if (tx.withdrawal_id) transaction.withdrawalId = tx.withdrawal_id
        if (tx.payout_due_by) transaction.payoutDueBy = tx.payout_due_by
        if (tx.confirmed_at) transaction.confirmedAt = tx.confirmed_at
        if (tx.approved_at) transaction.approvedAt = tx.approved_at
        if (tx.rejected_at) transaction.rejectedAt = tx.rejected_at
        if (tx.completed_at) transaction.completedAt = tx.completed_at
        if (tx.failed_at) transaction.failedAt = tx.failed_at
        if (tx.auto_approved !== undefined) transaction.autoApproved = tx.auto_approved
        if (tx.manually_completed !== undefined) transaction.manuallyCompleted = tx.manually_completed
        if (tx.failure_reason) transaction.failureReason = tx.failure_reason
        if (tx.retry_count !== undefined) transaction.retryCount = tx.retry_count
        if (tx.last_retry_at) transaction.lastRetryAt = tx.last_retry_at
        if (tx.legacy_reference_id) transaction.legacyReferenceId = tx.legacy_reference_id
        if (tx.created_at) transaction.createdAt = tx.created_at
        if (tx.updated_at) transaction.updatedAt = tx.updated_at
        
        if (!transactionsByInvestment[tx.investment_id]) {
          transactionsByInvestment[tx.investment_id] = []
        }
        transactionsByInvestment[tx.investment_id].push(transaction)
      })

      // Map activity to users
      const activityByUser = {}
      if (allActivity) {
        allActivity.forEach(act => {
          if (!activityByUser[act.user_id]) {
            activityByUser[act.user_id] = []
          }
          activityByUser[act.user_id].push(act)
        })
      }

      // Assign to users and investments
      data.forEach(user => {
        user.activity = activityByUser[user.id] || []
        
        if (user.investments && user.investments.length > 0) {
          user.investments.forEach(investment => {
            // Convert snake_case to camelCase for investment fields
            investment.paymentFrequency = investment.payment_frequency
            investment.lockupPeriod = investment.lockup_period
            investment.accountType = investment.account_type
            investment.submittedAt = investment.submitted_at
            investment.confirmedAt = investment.confirmed_at
            investment.rejectedAt = investment.rejected_at
            investment.lockupEndDate = investment.lockup_end_date
            investment.withdrawnAt = investment.withdrawn_at
            investment.totalEarnings = investment.total_earnings
            investment.createdAt = investment.created_at
            investment.updatedAt = investment.updated_at
            investment.confirmedByAdminId = investment.confirmed_by_admin_id
            investment.confirmationSource = investment.confirmation_source
            investment.rejectedByAdminId = investment.rejected_by_admin_id
            investment.rejectionSource = investment.rejection_source
            
            investment.transactions = transactionsByInvestment[investment.id] || []
          })
        }
      })
    }

    // Get app settings for time machine
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'time_machine')
      .maybeSingle()

    const timeSettings = settings?.value || {}

    const result = {
      users: data || [],
      timeOffset: timeSettings.timeOffset || null,
      timeOffsetSetAt: timeSettings.timeOffsetSetAt || null,
      timeMachineSetBy: timeSettings.timeMachineSetBy || null,
      autoApproveDistributions: timeSettings.autoApproveDistributions || false,
      isActive: timeSettings.isActive || false
    }

    // CACHING DISABLED: Uncomment to enable caching in production
    // if (!skipCache) {
    //   cache.set(CACHE_KEYS.ALL_USERS, result, CACHE_TTL.USERS)
    // }

    return result
  } catch (error) {
    console.error('Error in getUsers:', error)
    return { users: [] }
  }
}

/**
 * Add investment to user
 * @param {string} userId - User ID
 * @param {object} investmentData - Investment data
 * @returns {Promise<{success: boolean, investment?: object, error?: string}>}
 */
export async function addInvestment(userId, investmentData) {
  try {
    const supabase = createServiceClient()

    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()

    const investment = {
      id: investmentData.id,
      user_id: userId,
      status: investmentData.status || 'draft',
      amount: investmentData.amount,
      payment_frequency: investmentData.paymentFrequency,
      lockup_period: investmentData.lockupPeriod,
      bonds: investmentData.bonds,
      account_type: investmentData.accountType,
      created_at: timestamp,
      updated_at: timestamp
    }

    const { data, error } = await supabase
      .from('investments')
      .insert(investment)
      .select()
      .single()

    if (error) {
      console.error('Error adding investment:', error)
      return { success: false, error: error.message }
    }

    // Create investment activity
    await supabase
      .from('activity')
      .insert({
        id: generateTransactionId('INV', investment.id, 'investment_created'),
        user_id: userId,
        type: 'investment_created',
        investment_id: investment.id,
        amount: investment.amount,
        date: timestamp
      })

    // Cache invalidation not needed (caching disabled)
    // cache.delete(CACHE_KEYS.USER_BY_ID(userId))
    // cache.delete(CACHE_KEYS.ALL_USERS)

    return { success: true, investment: data }
  } catch (error) {
    console.error('Error in addInvestment:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update investment
 * @param {string} investmentId - Investment ID
 * @param {object} updateData - Fields to update
 * @returns {Promise<{success: boolean, investment?: object, error?: string}>}
 */
export async function updateInvestment(investmentId, updateData) {
  try {
    const supabase = createServiceClient()

    // Get current investment state to check for status changes
    const { data: currentInvestment } = await supabase
      .from('investments')
      .select('status, user_id, amount, lockup_period')
      .eq('id', investmentId)
      .maybeSingle()

    // Convert camelCase to snake_case
    const dbData = {}
    const fieldMap = {
      paymentFrequency: 'payment_frequency',
      lockupPeriod: 'lockup_period',
      accountType: 'account_type',
      paymentMethod: 'payment_method',
      bankAccountId: 'bank_account_id',
      personalInfo: 'personal_info',
      requiresManualApproval: 'requires_manual_approval',
      manualApprovalReason: 'manual_approval_reason',
      submittedAt: 'submitted_at',
      confirmedAt: 'confirmed_at',
      confirmedByAdminId: 'confirmed_by_admin_id',
      confirmationSource: 'confirmation_source',
      rejectedAt: 'rejected_at',
      rejectedByAdminId: 'rejected_by_admin_id',
      rejectionSource: 'rejection_source',
      lockupEndDate: 'lockup_end_date',
      withdrawnAt: 'withdrawn_at',
      totalEarnings: 'total_earnings',
      finalValue: 'final_value'
    }

    for (const [key, value] of Object.entries(updateData)) {
      const dbKey = fieldMap[key] || key
      dbData[dbKey] = value
    }

    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()
    dbData.updated_at = timestamp

    // Automatically set confirmedAt when status changes to active (if not already provided)
    if (currentInvestment && updateData.status === 'active' && currentInvestment.status !== 'active' && !updateData.confirmedAt) {
      dbData.confirmed_at = timestamp
      
      // Also calculate and set lockupEndDate if not already provided
      if (!updateData.lockupEndDate && currentInvestment.lockup_period) {
        const lockupYears = currentInvestment.lockup_period === '3-year' ? 3 : 1
        const lockupEnd = new Date(timestamp)
        lockupEnd.setFullYear(lockupEnd.getFullYear() + lockupYears)
        dbData.lockup_end_date = lockupEnd.toISOString()
      }
    }

    const { data, error } = await supabase
      .from('investments')
      .update(dbData)
      .eq('id', investmentId)
      .select()
      .maybeSingle()

    if (error || !data) {
      console.error('Error updating investment:', error)
      return { success: false, error: error?.message || 'Investment not found' }
    }

    // Create activity entries for status changes
    if (currentInvestment && updateData.status && currentInvestment.status !== updateData.status) {
      const timestamp = appTime || new Date().toISOString()
      const userId = currentInvestment.user_id
      const amount = currentInvestment.amount

      // Status changed from draft -> pending (submitted)
      if (currentInvestment.status === 'draft' && updateData.status === 'pending') {
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('INV', investmentId, 'investment_submitted'),
            user_id: userId,
            type: 'investment_submitted',
            investment_id: investmentId,
            date: timestamp
          })
      }

      // Status changed from pending -> active (confirmed)
      if (currentInvestment.status === 'pending' && updateData.status === 'active') {
        // Create investment_confirmed activity only (not approved - they're the same thing)
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('INV', investmentId, 'investment_confirmed'),
            user_id: userId,
            type: 'investment_confirmed',
            investment_id: investmentId,
            date: timestamp
          })
      }

      // Status changed from pending -> rejected
      if (currentInvestment.status === 'pending' && updateData.status === 'rejected') {
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('INV', investmentId, 'investment_rejected'),
            user_id: userId,
            type: 'investment_rejected',
            investment_id: investmentId,
            amount: amount,
            date: timestamp
          })
      }
    }

    // Cache invalidation not needed (caching disabled)
    // if (currentInvestment && currentInvestment.user_id) {
    //   cache.delete(CACHE_KEYS.USER_BY_ID(currentInvestment.user_id))
    // }
    // cache.delete(CACHE_KEYS.ALL_USERS)

    return { success: true, investment: data }
  } catch (error) {
    console.error('Error in updateInvestment:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete investment
 * @param {string} investmentId - Investment ID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteInvestment(investmentId) {
  try {
    const supabase = createServiceClient()

    // Get investment to get user_id before deleting
    const { data: investment } = await supabase
      .from('investments')
      .select('user_id')
      .eq('id', investmentId)
      .maybeSingle()

    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', investmentId)

    if (error) {
      console.error('Error deleting investment:', error)
      return { success: false, error: error.message }
    }

    // Cache invalidation not needed (caching disabled)
    // if (investment && investment.user_id) {
    //   cache.delete(CACHE_KEYS.USER_BY_ID(investment.user_id))
    // }
    // cache.delete(CACHE_KEYS.ALL_USERS)

    return { success: true }
  } catch (error) {
    console.error('Error in deleteInvestment:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Add transaction
 * @param {string} investmentId - Investment ID
 * @param {object} transactionData - Transaction data
 * @returns {Promise<{success: boolean, transaction?: object, error?: string}>}
 */
export async function addTransaction(investmentId, transactionData) {
  try {
    const supabase = createServiceClient()

    // Get investment to get user_id
    const { data: investment, error: fetchError } = await supabase
      .from('investments')
      .select('user_id')
      .eq('id', investmentId)
      .maybeSingle()

    if (fetchError || !investment) {
      return { success: false, error: 'Investment not found' }
    }

    const transaction = {
      id: transactionData.id,
      investment_id: investmentId,
      user_id: investment.user_id,
      type: transactionData.type,
      amount: transactionData.amount,
      date: transactionData.date,
      status: transactionData.status,
      description: transactionData.description,
      metadata: transactionData.metadata || {}
    }

    const { data, error } = await supabase
      .from('transactions')
      .insert(transaction)
      .select()
      .single()

    if (error) {
      console.error('Error adding transaction:', error)
      return { success: false, error: error.message }
    }

    // Note: Cache invalidation not needed (caching disabled)

    return { success: true, transaction: data }
  } catch (error) {
    console.error('Error in addTransaction:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get app time settings (Time Machine)
 * @returns {Promise<{timeOffset: number|null, appTime: string|null}>}
 */
export async function getAppTimeSettings() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'time_machine')
      .maybeSingle()

    if (error || !data) {
      return { timeOffset: null, appTime: null }
    }

    const settings = data.value || {}
    return {
      timeOffset: settings.timeOffset || null,
      appTime: settings.appTime || null
    }
  } catch (error) {
    console.error('Error getting app time settings:', error)
    return { timeOffset: null, appTime: null }
  }
}

/**
 * Update app time settings
 * @param {object} settings - Time machine settings
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updateAppTimeSettings(settings) {
  try {
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'time_machine',
        value: settings,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Error updating app time settings:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updateAppTimeSettings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Log audit event
 * @param {object} eventData - Audit event data
 * @returns {Promise<{success: boolean}>}
 */
export async function logAuditEvent(eventData) {
  try {
    const supabase = createServiceClient()

    await supabase
      .from('audit_log')
      .insert({
        user_id: eventData.userId,
        admin_id: eventData.adminId,
        action: eventData.action,
        resource_type: eventData.resourceType,
        resource_id: eventData.resourceId,
        details: eventData.details || {},
        ip_address: eventData.ipAddress,
        user_agent: eventData.userAgent
      })

    return { success: true }
  } catch (error) {
    console.error('Error logging audit event:', error)
    return { success: false }
  }
}

/**
 * Legacy function - No longer needed with Supabase
 * Supabase automatically persists changes
 * @deprecated Use specific update functions instead
 * @returns {Promise<boolean>}
 */
export async function saveUsers(usersData) {
  console.warn('saveUsers() is deprecated with Supabase. Changes are automatically persisted.')
  // Return true for backward compatibility
  // Routes calling this should be refactored to use specific update functions
  return true
}

/**
 * Legacy function - No longer needed with Supabase
 * Database enforces uniqueness constraints
 * @deprecated Supabase enforces email uniqueness
 * @returns {Promise<{removed: number}>}
 */
export async function cleanupDuplicateUsers() {
  console.warn('cleanupDuplicateUsers() is deprecated with Supabase. Database enforces uniqueness.')
  return { removed: 0 }
}
