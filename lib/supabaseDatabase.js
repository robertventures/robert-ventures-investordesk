/**
 * Supabase Database Operations
 * Replaces lib/database.js with Supabase PostgreSQL operations
 * 
 * PERFORMANCE: All read operations are cached with 30-60 second TTLs
 * Cache is automatically invalidated on writes
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
    // PERFORMANCE FIX: Disable caching for user data in serverless environments
    // In-memory cache is unreliable across multiple serverless instances
    // This ensures data consistency after updates (investments, withdrawals, etc.)
    // If caching is needed in the future, use a distributed cache (Redis, etc.)
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

    // Note: Caching disabled for data consistency in serverless environments

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
    
    // PERFORMANCE FIX: Caching disabled for data consistency in serverless environments
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

    // Note: Caching disabled for data consistency

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
    const authResult = await signUp(normalizedEmail, userData.password || '', {
      firstName: userData.firstName,
      lastName: userData.lastName
    })

    if (!authResult.success) {
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
      console.error('Error inserting user:', insertError)
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

    console.log('New user added:', normalizedEmail)
    
    // Note: Cache invalidation not needed (caching disabled)
    
    return { success: true, user: insertedUser }
  } catch (error) {
    console.error('Error in addUser:', error)
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
      taxInfo: 'tax_info'
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
      .single()

    if (error) {
      console.error('Error updating user:', error)
      return { success: false, error: error.message }
    }

    console.log('User updated:', userId)
    
    // Note: Cache invalidation not needed (caching disabled)
    
    return { success: true, user: data }
  } catch (error) {
    console.error('Error in updateUser:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get all users (admin function)
 * PERFORMANCE: Uses optimized batch queries
 * @param {boolean} skipCache - Skip cache and force fresh data (deprecated - caching disabled)
 * @returns {Promise<{users: Array}>}
 */
export async function getUsers(skipCache = false) {
  try {
    // PERFORMANCE FIX: Caching disabled for data consistency in serverless environments
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

      // Map transactions to investments
      const transactionsByInvestment = {}
      allTransactions.forEach(tx => {
        if (!transactionsByInvestment[tx.investment_id]) {
          transactionsByInvestment[tx.investment_id] = []
        }
        transactionsByInvestment[tx.investment_id].push(tx)
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
      isActive: timeSettings.isActive || false
    }

    // Note: Caching disabled for data consistency

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

    // Note: Cache invalidation not needed (caching disabled)

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

    // Convert camelCase to snake_case
    const dbData = {}
    const fieldMap = {
      paymentFrequency: 'payment_frequency',
      lockupPeriod: 'lockup_period',
      accountType: 'account_type',
      paymentMethod: 'payment_method',
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

    dbData.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('investments')
      .update(dbData)
      .eq('id', investmentId)
      .select()
      .single()

    if (error) {
      console.error('Error updating investment:', error)
      return { success: false, error: error.message }
    }

    // Note: Cache invalidation not needed (caching disabled)

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

    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', investmentId)

    if (error) {
      console.error('Error deleting investment:', error)
      return { success: false, error: error.message }
    }

    // Note: Cache invalidation not needed (caching disabled)

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
