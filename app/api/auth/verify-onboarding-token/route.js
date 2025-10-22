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

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // Find user with valid token
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        investments (*),
        bank_accounts (*)
      `)
      .eq('onboarding_token', token)
      .gt('onboarding_token_expires', new Date().toISOString())
      .eq('needs_onboarding', true)
      .maybeSingle()

    if (error) {
      console.error('Error verifying onboarding token:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to verify token' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired setup link. Please contact your administrator for a new link.' },
        { status: 401 }
      )
    }

    // Check if already completed onboarding
    if (user.onboarding_completed_at) {
      return NextResponse.json(
        { success: false, error: 'Account setup already completed. Please sign in normally.' },
        { status: 400 }
      )
    }

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

