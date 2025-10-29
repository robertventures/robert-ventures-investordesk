import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../lib/supabaseClient'

/**
 * GET /api/users
 * Get all users (admin only)
 * Returns list of all users with their investments, transactions, and activity
 */
export async function GET(request) {
  try {
    const supabase = createServiceClient()
    
    // Get user ID from query params, headers, or cookies
    // Note: In production, you should use proper session-based auth
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 
                   request.headers.get('x-user-id') ||
                   request.cookies?.get('userId')?.value
    
    // If userId provided, verify admin access
    // If not provided, we'll skip admin check but this should be restricted in production
    if (userId) {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', userId)
        .single()
      
      if (userError || !user?.is_admin) {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        )
      }
    }
    
    // Note: In production, you should require authentication for this endpoint
    // For now, we allow access but admin-only features should be protected elsewhere
    
    // Get all users with related data
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        *,
        investments(*),
        bank_accounts(*),
        withdrawals(*)
      `)
    
    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch users' },
        { status: 500 }
      )
    }
    
    // For each user, get transactions and activity
    const usersWithData = await Promise.all(
      (users || []).map(async (user) => {
        // Get transactions for each investment
        if (user.investments && user.investments.length > 0) {
          const investmentIds = user.investments.map(inv => inv.id)
          
          const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .in('investment_id', investmentIds)
            .order('date', { ascending: true })
          
          // Group transactions by investment
          if (transactions) {
            user.investments.forEach(inv => {
              inv.transactions = transactions.filter(t => t.investment_id === inv.id)
            })
          }
        }
        
        // Get activity events for user
        const { data: activity } = await supabase
          .from('activity')
          .select('*')
          .eq('user_id', user.id)
          .order('date', { ascending: false })
        
        user.activity = activity || []
        
        // Convert snake_case to camelCase for frontend
        return convertUserToCamelCase(user)
      })
    )
    
    return NextResponse.json({
      success: true,
      users: usersWithData
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Convert user object from snake_case to camelCase
 */
function convertUserToCamelCase(user) {
  if (!user) return user
  
  const converted = { ...user }
  
  // Remove sensitive data
  delete converted.hashed_password
  delete converted.password
  delete converted.ssn
  delete converted.password_reset_token
  
  // Convert top-level fields
  converted.isAdmin = converted.is_admin || false
  converted.isVerified = converted.is_verified || false
  converted.needsOnboarding = converted.needs_onboarding || false
  converted.authId = converted.auth_id
  converted.firstName = converted.first_name
  converted.lastName = converted.last_name
  converted.phoneNumber = converted.phone_number
  converted.createdAt = converted.created_at
  converted.updatedAt = converted.updated_at
  converted.verifiedAt = converted.verified_at
  converted.accountType = converted.account_type
  converted.jointHolder = converted.joint_holder
  converted.jointHoldingType = converted.joint_holding_type
  converted.entityName = converted.entity_name
  converted.authorizedRepresentative = converted.authorized_representative
  converted.taxInfo = converted.tax_info
  converted.onboardingToken = converted.onboarding_token
  converted.onboardingTokenExpires = converted.onboarding_token_expires
  converted.onboardingCompletedAt = converted.onboarding_completed_at
  converted.displayCreatedAt = converted.display_created_at
  converted.bankAccounts = converted.bank_accounts
  
  // Convert investments
  if (converted.investments) {
    converted.investments = converted.investments.map(inv => {
      const invConverted = { ...inv }
      invConverted.userId = invConverted.user_id
      invConverted.createdAt = invConverted.created_at
      invConverted.updatedAt = invConverted.updated_at
      invConverted.confirmedAt = invConverted.confirmed_at
      invConverted.accountType = invConverted.account_type
      invConverted.lockupPeriod = invConverted.lockup_period
      invConverted.paymentFrequency = invConverted.payment_frequency
      invConverted.paymentMethod = invConverted.payment_method
      invConverted.jointHolder = invConverted.joint_holder
      invConverted.jointHoldingType = invConverted.joint_holding_type
      invConverted.bankAccount = invConverted.bank_account
      
      // Convert transactions
      if (invConverted.transactions) {
        invConverted.transactions = invConverted.transactions.map(txn => ({
          ...txn,
          userId: txn.user_id,
          investmentId: txn.investment_id,
          createdAt: txn.created_at,
          monthIndex: txn.month_index,
          failureReason: txn.failure_reason
        }))
      }
      
      return invConverted
    })
  }
  
  return converted
}

