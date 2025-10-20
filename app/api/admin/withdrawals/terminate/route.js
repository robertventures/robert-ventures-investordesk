import { NextResponse } from 'next/server'
import { getUser } from '../../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../../lib/supabaseClient.js'
import { getCurrentAppTime } from '../../../../../lib/appTime.js'
import { calculateFinalWithdrawalPayout } from '../../../../../lib/investmentCalculations.js'
import { generateTransactionId, generateWithdrawalId } from '../../../../../lib/idGenerator.js'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware.js'

/**
 * POST - Admin-initiated investment termination
 * Immediately processes withdrawal, bypassing 90-day notice period
 * Admin can override lockup period with explicit confirmation
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { userId, investmentId, adminUserId, overrideLockup } = body

    if (!userId || !investmentId || !adminUserId) {
      return NextResponse.json(
        { success: false, error: 'userId, investmentId, and adminUserId are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    
    // Get user with investment data
    const user = await getUser(userId)
    
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const investments = Array.isArray(user.investments) ? user.investments : []
    const investment = investments.find(inv => inv.id === investmentId)
    
    if (!investment) {
      return NextResponse.json({ success: false, error: 'Investment not found' }, { status: 404 })
    }

    // Only active or withdrawal_notice investments can be terminated
    if (investment.status !== 'active' && investment.status !== 'withdrawal_notice') {
      return NextResponse.json({
        success: false,
        error: `Cannot terminate investment with status '${investment.status}'. Only active or withdrawal_notice investments can be terminated.`
      }, { status: 400 })
    }

    // Check lockup period if override is not enabled
    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())

    if (!overrideLockup && investment.lockup_end_date) {
      const lockupEnd = new Date(investment.lockup_end_date)
      if (now < lockupEnd) {
        const daysRemaining = Math.ceil((lockupEnd - now) / (1000 * 60 * 60 * 24))
        return NextResponse.json({
          success: false,
          error: `Investment is still in lockup period. ${daysRemaining} day(s) remaining until ${lockupEnd.toLocaleDateString()}. Use overrideLockup flag to bypass.`,
          lockupEndDate: investment.lockup_end_date,
          requiresOverride: true
        }, { status: 400 })
      }
    }

    // Calculate final payout including all accrued interest up to termination
    const finalPayout = calculateFinalWithdrawalPayout(investment, now.toISOString())
    const nowIso = now.toISOString()

    // Check for existing withdrawal record
    const { data: existingWithdrawals } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('investment_id', investmentId)
      .neq('status', 'rejected')
      .maybeSingle()
    
    let withdrawalId
    let withdrawalRecord
    
    if (existingWithdrawals) {
      // Update existing withdrawal (e.g., if investment was in withdrawal_notice status)
      withdrawalId = existingWithdrawals.id
      
      const { data: updatedWithdrawal, error: updateError } = await supabase
        .from('withdrawals')
        .update({
          status: 'approved',
          approved_at: nowIso,
          paid_at: nowIso,
          final_amount: finalPayout.finalValue,
          final_earnings: finalPayout.totalEarnings,
          payout_calculated_at: nowIso,
          amount: finalPayout.finalValue,
          principal_amount: finalPayout.principalAmount,
          earnings_amount: finalPayout.totalEarnings,
          admin_terminated: true,
          admin_user_id: adminUserId,
          lockup_overridden: overrideLockup || false,
          updated_at: nowIso
        })
        .eq('id', withdrawalId)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating withdrawal:', updateError)
        return NextResponse.json({ success: false, error: 'Failed to update withdrawal' }, { status: 500 })
      }
      
      withdrawalRecord = updatedWithdrawal
    } else {
      // Generate new withdrawal ID
      const { data: allUsers } = await supabase.from('users').select('id')
      withdrawalId = generateWithdrawalId((allUsers || []).map(u => ({ id: u.id })))
      
      // Create new withdrawal record for admin-initiated termination
      const { data: newWithdrawal, error: insertError } = await supabase
        .from('withdrawals')
        .insert({
          id: withdrawalId,
          investment_id: investmentId,
          user_id: userId,
          amount: finalPayout.finalValue,
          principal_amount: finalPayout.principalAmount,
          earnings_amount: finalPayout.totalEarnings,
          quoted_amount: finalPayout.finalValue,
          quoted_earnings: finalPayout.totalEarnings,
          final_amount: finalPayout.finalValue,
          final_earnings: finalPayout.totalEarnings,
          payout_calculated_at: nowIso,
          accrual_notice: 'Admin-initiated termination. Payout calculated and processed immediately.',
          status: 'approved',
          requested_at: nowIso,
          notice_start_at: nowIso,
          approved_at: nowIso,
          paid_at: nowIso,
          payout_due_by: nowIso,
          admin_terminated: true,
          admin_user_id: adminUserId,
          lockup_overridden: overrideLockup || false,
          investment_snapshot: {
            originalAmount: investment.amount,
            lockupPeriod: investment.lockup_period,
            paymentFrequency: investment.payment_frequency,
            confirmedAt: investment.confirmed_at,
            lockupEndDate: investment.lockup_end_date,
            statusAtRequest: investment.status,
            accruesUntilPayout: false
          },
          created_at: nowIso,
          updated_at: nowIso
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating withdrawal:', insertError)
        return NextResponse.json({ success: false, error: 'Failed to create withdrawal' }, { status: 500 })
      }
      
      withdrawalRecord = newWithdrawal
    }

    // Create/update redemption transaction
    const redemptionTxId = generateTransactionId('INV', investmentId, 'redemption', { withdrawalId })
    
    const { error: txUpsertError } = await supabase
      .from('transactions')
      .upsert({
        id: redemptionTxId,
        investment_id: investmentId,
        user_id: userId,
        type: 'redemption',
        amount: finalPayout.finalValue,
        final_amount: finalPayout.finalValue,
        final_earnings: finalPayout.totalEarnings,
        payout_calculated_at: nowIso,
        accrual_notice: 'Admin-initiated termination. Payout calculated and processed immediately.',
        status: 'received',
        date: nowIso,
        withdrawal_id: withdrawalId,
        payout_due_by: nowIso,
        approved_at: nowIso,
        paid_at: nowIso,
        rejected_at: null,
        admin_terminated: true,
        admin_user_id: adminUserId,
        lockup_overridden: overrideLockup || false,
        created_at: nowIso,
        updated_at: nowIso
      })

    if (txUpsertError) {
      console.error('Error creating redemption transaction:', txUpsertError)
      return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 })
    }

    // Update investment status to withdrawn
    const { error: invUpdateError } = await supabase
      .from('investments')
      .update({
        status: 'withdrawn',
        withdrawn_at: nowIso,
        withdrawal_id: withdrawalId,
        final_value: finalPayout.finalValue,
        total_earnings: finalPayout.totalEarnings,
        admin_terminated: true,
        admin_user_id: adminUserId,
        lockup_overridden: overrideLockup || false,
        updated_at: nowIso
      })
      .eq('id', investmentId)

    if (invUpdateError) {
      console.error('Error updating investment:', invUpdateError)
      return NextResponse.json({ success: false, error: 'Failed to update investment' }, { status: 500 })
    }

    // Add activity event
    const { error: activityError } = await supabase
      .from('activity')
      .insert({
        id: generateTransactionId('USR', userId, 'admin_withdrawal_processed'),
        user_id: userId,
        type: 'admin_withdrawal_processed',
        date: nowIso,
        investment_id: investmentId,
        withdrawal_id: withdrawalId,
        amount: finalPayout.finalValue,
        admin_user_id: adminUserId,
        lockup_overridden: overrideLockup || false
      })

    if (activityError) {
      console.error('Error creating activity:', activityError)
      // Don't fail the whole operation if activity logging fails
    }

    // Sync transactions to update activity events
    // Direct call to transaction sync (no HTTP needed, works in all environments)
    const { syncTransactionsNonBlocking } = await import('../../../../../lib/transactionSync.js')
    await syncTransactionsNonBlocking()

    return NextResponse.json({
      success: true,
      withdrawal: withdrawalRecord,
      finalPayout,
      message: 'Investment terminated successfully. Withdrawal processed immediately.'
    })
  } catch (error) {
    console.error('Error processing admin termination:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

