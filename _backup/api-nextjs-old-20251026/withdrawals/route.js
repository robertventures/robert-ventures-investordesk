import { NextResponse } from 'next/server'
import { getUser } from '../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../lib/supabaseClient.js'
import { calculateInvestmentValue, calculateWithdrawalAmount } from '../../../lib/investmentCalculations.js'
import { getCurrentAppTime } from '../../../lib/appTime.js'
import { generateWithdrawalId, generateTransactionId } from '../../../lib/idGenerator.js'

// POST - Create withdrawal request
export async function POST(request) {
  try {
    const body = await request.json()
    const { userId, investmentId } = body
    
    if (!userId || !investmentId) {
      return NextResponse.json(
        { success: false, error: 'userId and investmentId are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // Get user with investment data
    const user = await getUser(userId)
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    if (user.is_admin) {
      return NextResponse.json({ success: false, error: 'Admins cannot withdraw investments' }, { status: 403 })
    }

    const investments = Array.isArray(user.investments) ? user.investments : []
    const investment = investments.find(inv => inv.id === investmentId)
    
    if (!investment) {
      return NextResponse.json({ success: false, error: 'Investment not found' }, { status: 404 })
    }

    // Check if investment is eligible for withdrawal
    if (investment.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Only active investments can be withdrawn'
      }, { status: 400 })
    }

    // Check if lockup period has expired
    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())

    if (investment.lockup_end_date) {
      const lockupEnd = new Date(investment.lockup_end_date)
      if (now < lockupEnd) {
        const daysRemaining = Math.ceil((lockupEnd - now) / (1000 * 60 * 60 * 24))
        return NextResponse.json({
          success: false,
          error: `Cannot withdraw before lockup period ends. ${daysRemaining} day(s) remaining until ${lockupEnd.toLocaleDateString()}.`
        }, { status: 400 })
      }
    }

    // Calculate current value (as of app time) and set up withdrawal timeline
    // Robert Ventures has 90 days from the withdrawal request to provide funds + interest
    const currentValue = calculateInvestmentValue(investment, now.toISOString())
    // Notice period starts now; payout must be completed within 90 days
    const noticeStartAt = now.toISOString()
    const payoutDueByDate = new Date(now)
    payoutDueByDate.setDate(payoutDueByDate.getDate() + 90)
    const payoutDueBy = payoutDueByDate.toISOString()

    // For monthly payout investments: withdraw principal only
    const isMonthly = investment.payment_frequency === 'monthly'
    const principalAmount = investment.amount
    const compAmount = currentValue.currentValue
    const withdrawableAmount = isMonthly ? principalAmount : compAmount
    const earningsAmount = isMonthly ? 0 : (currentValue.totalEarnings || 0)

    // Generate withdrawal ID
    const { data: allUsers } = await supabase.from('users').select('id')
    const withdrawalId = generateWithdrawalId((allUsers || []).map(u => ({ id: u.id })))
    
    const nowIso = now.toISOString()
    const accrualNotice = 'This investment keeps earning interest until the withdrawal is paid out. The final payout amount is calculated when funds are sent (within 90 days of your request).'
    
    // Create withdrawal record in Supabase
    const { data: withdrawalRecord, error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert({
        id: withdrawalId,
        investment_id: investmentId,
        user_id: userId,
        amount: withdrawableAmount,
        principal_amount: principalAmount,
        earnings_amount: earningsAmount,
        quoted_amount: withdrawableAmount,
        quoted_earnings: earningsAmount,
        final_amount: null,
        final_earnings: null,
        payout_calculated_at: null,
        accrual_notice: accrualNotice,
        status: 'notice',
        requested_at: nowIso,
        notice_start_at: noticeStartAt,
        payout_due_by: payoutDueBy,
        investment_snapshot: {
          originalAmount: investment.amount,
          lockupPeriod: investment.lockup_period,
          paymentFrequency: investment.payment_frequency,
          confirmedAt: investment.confirmed_at,
          lockupEndDate: investment.lockup_end_date,
          statusAtRequest: investment.status,
          accruesUntilPayout: true
        },
        created_at: nowIso,
        updated_at: nowIso
      })
      .select()
      .single()

    if (withdrawalError) {
      console.error('Error creating withdrawal:', withdrawalError)
      return NextResponse.json({ success: false, error: 'Failed to create withdrawal' }, { status: 500 })
    }

    // Create redemption transaction in Supabase
    const redemptionTxId = generateTransactionId('INV', investmentId, 'redemption', { withdrawalId })
    
    const { error: txError } = await supabase
      .from('transactions')
      .upsert({
        id: redemptionTxId,
        investment_id: investmentId,
        user_id: userId,
        type: 'redemption',
        amount: withdrawableAmount,
        quoted_amount: withdrawableAmount,
        quoted_earnings: earningsAmount,
        quoted_at: nowIso,
        final_amount: null,
        final_earnings: null,
        payout_calculated_at: null,
        accrual_notice: accrualNotice,
        status: 'pending',
        date: nowIso,
        withdrawal_id: withdrawalId,
        payout_due_by: payoutDueBy,
        approved_at: null,
        paid_at: null,
        rejected_at: null,
        created_at: nowIso,
        updated_at: nowIso
      })

    if (txError) {
      console.error('Error creating redemption transaction:', txError)
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 })
    }

    // Update investment status to withdrawal_notice
    const { error: invError } = await supabase
      .from('investments')
      .update({
        status: 'withdrawal_notice',
        withdrawal_notice_start_at: noticeStartAt,
        payout_due_by: payoutDueBy,
        withdrawal_id: withdrawalId,
        final_value: withdrawableAmount,
        total_earnings: earningsAmount,
        updated_at: nowIso
      })
      .eq('id', investmentId)

    if (invError) {
      console.error('Error updating investment:', invError)
      return NextResponse.json({ success: false, error: 'Failed to update investment' }, { status: 500 })
    }

    // Add activity event
    const { error: activityError } = await supabase
      .from('activity')
      .insert({
        id: generateTransactionId('USR', userId, 'withdrawal_requested'),
        user_id: userId,
        type: 'withdrawal_requested',
        date: nowIso,
        investment_id: investmentId,
        withdrawal_id: withdrawalId,
        amount: withdrawableAmount
      })

    if (activityError) {
      console.error('Error creating activity:', activityError)
      // Don't fail the whole operation if activity logging fails
    }

    return NextResponse.json({ 
      success: true, 
      withdrawal: withdrawalRecord,
      message: 'Withdrawal request submitted successfully. This investment keeps earning interest until funds are sent (within 90 days of your request).'
    })
  } catch (error) {
    console.error('Error processing withdrawal:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get withdrawal history for a user
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    
    if (userError || !user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get withdrawals for this user
    const { data: withdrawals, error: withdrawalsError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false })
    
    if (withdrawalsError) {
      console.error('Error fetching withdrawals:', withdrawalsError)
      return NextResponse.json({ success: false, error: 'Failed to fetch withdrawals' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      withdrawals: withdrawals || []
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
