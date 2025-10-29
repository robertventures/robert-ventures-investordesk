import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { getCurrentAppTime } from '../../../../lib/appTime.js'
import { calculateFinalWithdrawalPayout } from '../../../../lib/investmentCalculations.js'
import { generateTransactionId } from '../../../../lib/idGenerator.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'

// GET - list all withdrawals pending admin action
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }
    
    const supabase = createServiceClient()
    
    // Get all withdrawals with user info
    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select(`
        *,
        users!inner(id, email, first_name, last_name)
      `)
      .in('status', ['notice', 'pending'])
      .order('requested_at', { ascending: true })
    
    if (error) {
      console.error('Error listing withdrawals:', error)
      return NextResponse.json({ success: false, error: 'Failed to fetch withdrawals' }, { status: 500 })
    }
    
    // Format withdrawals with user info
    const formatted = (withdrawals || []).map(wd => ({
      ...wd,
      userId: wd.users.id,
      userEmail: wd.users.email,
      userName: `${wd.users.first_name} ${wd.users.last_name}`.trim()
    }))
    
    return NextResponse.json({ success: true, withdrawals: formatted })
  } catch (e) {
    console.error('Error listing withdrawals', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - admin action { action: 'approve'|'complete'|'reject', userId, withdrawalId }
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { action, userId, withdrawalId } = body
    if (!action || !userId || !withdrawalId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
    
    const normalizedAction = action === 'approve' ? 'complete' : action
    const supabase = createServiceClient()
    
    // Get user with investment data
    const user = await getUser(userId)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    // Get withdrawal record
    const { data: withdrawal, error: wdError } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .eq('user_id', userId)
      .maybeSingle()
    
    if (wdError || !withdrawal) {
      return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
    }

    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())
    const nowIso = now.toISOString()

    if (normalizedAction === 'complete') {
      // Admin finalizes payout anytime within the 90-day window
      // Robert Ventures must pay principal + accrued interest at payout time
      const investments = Array.isArray(user.investments) ? user.investments : []
      const investment = investments.find(inv => inv.id === withdrawal.investment_id)
      
      if (investment) {
        // Calculate final payout including interest accrued up to payout time
        const finalPayout = calculateFinalWithdrawalPayout(investment, nowIso)

        // Update withdrawal record with final calculated amounts
        const { error: updateWdError } = await supabase
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
            updated_at: nowIso
          })
          .eq('id', withdrawalId)

        if (updateWdError) {
          console.error('Error updating withdrawal:', updateWdError)
          return NextResponse.json({ success: false, error: 'Failed to update withdrawal' }, { status: 500 })
        }

        // Create or update redemption transaction
        const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
        const accrualNotice = withdrawal.accrual_notice || 'This investment keeps earning interest until the withdrawal is paid out. The final payout amount is calculated when funds are sent.'
        
        const { error: txError } = await supabase
          .from('transactions')
          .upsert({
            id: redemptionTxId,
            investment_id: investment.id,
            user_id: userId,
            type: 'redemption',
            amount: finalPayout.finalValue,
            final_amount: finalPayout.finalValue,
            final_earnings: finalPayout.totalEarnings,
            payout_calculated_at: nowIso,
            accrual_notice: accrualNotice,
            status: 'received',
            date: withdrawal.requested_at || withdrawal.notice_start_at || nowIso,
            withdrawal_id: withdrawalId,
            payout_due_by: withdrawal.payout_due_by || null,
            approved_at: nowIso,
            paid_at: nowIso,
            rejected_at: null,
            updated_at: nowIso
          })

        if (txError) {
          console.error('Error updating transaction:', txError)
          return NextResponse.json({ success: false, error: 'Failed to update transaction' }, { status: 500 })
        }

        // Update investment status to withdrawn
        const { error: invError } = await supabase
          .from('investments')
          .update({
            status: 'withdrawn',
            withdrawn_at: nowIso,
            final_value: finalPayout.finalValue,
            total_earnings: finalPayout.totalEarnings,
            updated_at: nowIso
          })
          .eq('id', investment.id)

        if (invError) {
          console.error('Error updating investment:', invError)
          return NextResponse.json({ success: false, error: 'Failed to update investment' }, { status: 500 })
        }

        // Add activity event
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('USR', userId, 'withdrawal_approved'),
            user_id: userId,
            type: 'withdrawal_approved',
            date: nowIso,
            investment_id: investment.id,
            withdrawal_id: withdrawalId,
            amount: finalPayout.finalValue
          })
      } else {
        // Investment not found - data consistency error
        console.warn(`⚠️ WARNING: Completing withdrawal ${withdrawalId} for missing investment ${withdrawal.investment_id}`)
        
        // Update withdrawal as approved but flag inconsistency
        await supabase
          .from('withdrawals')
          .update({
            status: 'approved',
            approved_at: nowIso,
            paid_at: nowIso,
            data_inconsistency: true,
            inconsistency_reason: `Investment ${withdrawal.investment_id} not found at approval time`,
            updated_at: nowIso
          })
          .eq('id', withdrawalId)
      }
    } else if (normalizedAction === 'reject') {
      // Update withdrawal to rejected
      const { error: updateWdError } = await supabase
        .from('withdrawals')
        .update({
          status: 'rejected',
          rejected_at: nowIso,
          updated_at: nowIso
        })
        .eq('id', withdrawalId)

      if (updateWdError) {
        console.error('Error rejecting withdrawal:', updateWdError)
        return NextResponse.json({ success: false, error: 'Failed to reject withdrawal' }, { status: 500 })
      }

      // Revert investment status to active
      const investments = Array.isArray(user.investments) ? user.investments : []
      const investment = investments.find(inv => inv.id === withdrawal.investment_id)
      
      if (investment) {
        // Update or create rejected redemption transaction
        const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
        
        await supabase
          .from('transactions')
          .upsert({
            id: redemptionTxId,
            investment_id: investment.id,
            user_id: userId,
            type: 'redemption',
            amount: withdrawal.amount || 0,
            status: 'rejected',
            date: withdrawal.requested_at || withdrawal.notice_start_at || nowIso,
            withdrawal_id: withdrawalId,
            payout_due_by: withdrawal.payout_due_by || null,
            approved_at: null,
            paid_at: null,
            rejected_at: nowIso,
            updated_at: nowIso
          })

        // Revert investment to active status
        await supabase
          .from('investments')
          .update({
            status: 'active',
            withdrawal_id: null,
            withdrawal_notice_start_at: null,
            payout_due_by: null,
            updated_at: nowIso
          })
          .eq('id', investment.id)

        // Add activity event
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('USR', userId, 'withdrawal_rejected'),
            user_id: userId,
            type: 'withdrawal_rejected',
            date: nowIso,
            investment_id: investment.id,
            withdrawal_id: withdrawalId
          })
      }
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    // Sync transactions immediately after withdrawal action
    const { syncTransactionsNonBlocking } = await import('../../../../lib/transactionSync.js')
    await syncTransactionsNonBlocking()

    // Fetch updated withdrawal
    const { data: updatedWithdrawal } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()

    return NextResponse.json({ success: true, withdrawal: updatedWithdrawal })
  } catch (e) {
    console.error('Error updating withdrawal', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
