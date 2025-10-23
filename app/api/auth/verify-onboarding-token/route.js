import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { signToken, signRefreshToken } from '../../../../lib/auth.js'
import { setAuthCookies } from '../../../../lib/authMiddleware.js'

/**
 * POST /api/auth/verify-onboarding-token
 * Verify onboarding token and auto-login user
 */
export async function POST(request) {
  try {
    const { token } = await request.json()

    console.log('🔍 [verify-onboarding-token] Token verification requested')
    console.log('Token:', token?.substring(0, 8) + '...' || 'MISSING')

    if (!token) {
      console.error('❌ [verify-onboarding-token] No token provided')
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    console.log('📡 [verify-onboarding-token] Querying database for user with token')
    const currentTime = new Date().toISOString()
    console.log('Current time (UTC):', currentTime)
    
    // Find user with valid token
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        investments (*),
        bank_accounts (*)
      `)
      .eq('onboarding_token', token)
      .gt('onboarding_token_expires', currentTime)
      .eq('needs_onboarding', true)
      .maybeSingle()

    if (error) {
      console.error('❌ [verify-onboarding-token] Database error:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to verify token' },
        { status: 500 }
      )
    }

    console.log('📊 [verify-onboarding-token] Query result:', user ? 'User found' : 'No user found')

    if (!user) {
      console.warn('⚠️ [verify-onboarding-token] No matching user found - possible reasons:')
      console.warn('  1. Token does not match any user')
      console.warn('  2. Token has expired')
      console.warn('  3. User has needs_onboarding = false')
      console.warn('  4. User has already completed onboarding')
      
      // Try to find the user without time/onboarding constraints for debugging
      const { data: debugUser } = await supabase
        .from('users')
        .select('id, email, onboarding_token_expires, needs_onboarding, onboarding_completed_at')
        .eq('onboarding_token', token)
        .maybeSingle()
      
      if (debugUser) {
        console.log('🔍 [verify-onboarding-token] Found user but conditions not met:', {
          userId: debugUser.id,
          email: debugUser.email,
          tokenExpires: debugUser.onboarding_token_expires,
          needsOnboarding: debugUser.needs_onboarding,
          onboardingCompleted: debugUser.onboarding_completed_at,
          isExpired: debugUser.onboarding_token_expires <= currentTime
        })
      }
      
      return NextResponse.json(
        { success: false, error: 'Invalid or expired setup link. Please contact your administrator for a new link.' },
        { status: 401 }
      )
    }

    // Check if already completed onboarding
    if (user.onboarding_completed_at) {
      console.warn('⚠️ [verify-onboarding-token] User already completed onboarding:', user.email)
      return NextResponse.json(
        { success: false, error: 'Account setup already completed. Please sign in normally.' },
        { status: 400 }
      )
    }

    console.log('✅ [verify-onboarding-token] Token valid for user:', user.email)

    // Format user data for response
    const formattedUser = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      dob: user.dob,
      accountType: user.account_type,
      isVerified: user.is_verified,
      needsOnboarding: user.needs_onboarding,
      investments: (user.investments || []).map(inv => ({
        ...inv,
        paymentFrequency: inv.payment_frequency,
        lockupPeriod: inv.lockup_period,
        accountType: inv.account_type,
        bankAccountId: inv.bank_account_id,
        personalInfo: inv.personal_info
      })),
      bankAccounts: user.bank_accounts || []
    }

    // Create authentication session (auto-login)
    const tokenUser = {
      id: user.id,
      email: user.email,
      isAdmin: user.is_admin || false
    }
    
    const accessToken = signToken(tokenUser)
    const refreshToken = signRefreshToken(tokenUser)

    // Create response with user data
    const response = NextResponse.json({
      success: true,
      user: formattedUser,
      message: 'Token verified successfully. You are now logged in.'
    })

    // Set HTTP-only cookies to authenticate the user
    setAuthCookies(response, accessToken, refreshToken)

    console.log(`✅ Onboarding token verified for user: ${user.email}`)

    return response

  } catch (error) {
    console.error('Error in verify-onboarding-token:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

