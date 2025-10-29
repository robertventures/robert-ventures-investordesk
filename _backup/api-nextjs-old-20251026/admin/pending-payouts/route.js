import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getCurrentAppTime } from '../../../../lib/appTime.js'

// GET - List all pending payouts across all users
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }
    
    const supabase = createServiceClient()
    
    // Get current app time to filter out future-dated distributions
    const currentAppTime = await getCurrentAppTime()
    const currentAppTimeMs = new Date(currentAppTime).getTime()
    
    console.log('🕐 Pending Payouts - Current App Time:', currentAppTime)
    
    // Get all pending/approved distribution transactions with investment and user info
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select(`
        *,
        investments!inner(
          id,
          amount,
          lockup_period,
          payment_frequency,
          user_id,
          users!inner(
            id,
            email,
            first_name,
            last_name,
            is_admin
          )
        )
      `)
      .eq('type', 'distribution')
      .in('status', ['pending', 'approved'])
      .lte('date', currentAppTime)
      .order('date', { ascending: true })
    
    if (error) {
      console.error('Error fetching pending payouts:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch pending payouts' 
      }, { status: 500 })
    }
    
    // Filter out compounding investments and format response
    const pendingPayouts = (transactions || [])
      .filter(tx => {
        const investment = tx.investments
        // Exclude compounding investments - they don't require manual approval
        return investment.payment_frequency !== 'compounding' && tx.payment_frequency !== 'compounding'
      })
      .filter(tx => !tx.investments.users.is_admin) // Exclude admin users
      .map(tx => ({
        ...tx,
        userId: tx.investments.users.id,
        userEmail: tx.investments.users.email,
        userName: `${tx.investments.users.first_name || ''} ${tx.investments.users.last_name || ''}`.trim(),
        investmentId: tx.investments.id,
        investmentAmount: tx.investments.amount || 0,
        lockupPeriod: tx.investments.lockup_period || tx.lockup_period,
        paymentFrequency: tx.investments.payment_frequency || tx.payment_frequency,
        payoutBankNickname: tx.payout_bank_nickname || 'Unknown',
        failureReason: tx.failure_reason || null,
        retryCount: tx.retry_count || 0,
        lastRetryAt: tx.last_retry_at || null
      }))

    return NextResponse.json({ 
      success: true, 
      pendingPayouts,
      count: pendingPayouts.length
    })
  } catch (error) {
    console.error('Error fetching pending payouts:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST - Retry or manually complete a pending payout
// Body: { action: 'retry' | 'complete' | 'fail', userId, transactionId, failureReason? }
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { action, userId, transactionId, failureReason } = body

    if (!action || !userId || !transactionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    if (!['retry', 'complete', 'fail'].includes(action)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid action. Must be: retry, complete, or fail' 
      }, { status: 400 })
    }

    const supabase = createServiceClient()
    
    // Get transaction from database
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*, investments!inner(id, user_id)')
      .eq('id', transactionId)
      .eq('investments.user_id', userId)
      .maybeSingle()
    
    if (txError || !transaction) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction not found' 
      }, { status: 404 })
    }

    if (transaction.type !== 'distribution') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only distribution transactions can be managed' 
      }, { status: 400 })
    }

    const now = new Date().toISOString()
    const updates = { updated_at: now }

    if (action === 'retry') {
      // TESTING MODE: Simulate retry logic with mock bank transfer
      // In production, this would call the actual bank API
      // For testing, we simulate an 80% success rate
      
      const retryCount = (transaction.retry_count || 0) + 1
      const retrySuccess = Math.random() > 0.2

      updates.retry_count = retryCount
      updates.last_retry_at = now

      if (retrySuccess) {
        updates.status = 'received'
        updates.completed_at = now
        updates.failure_reason = null
      } else {
        updates.status = 'rejected'
        updates.failure_reason = failureReason || 'Mock bank transfer failed during retry'
      }

    } else if (action === 'complete') {
      updates.status = 'received'
      updates.completed_at = now
      updates.manually_completed = true
      updates.failure_reason = null

    } else if (action === 'fail') {
      updates.status = 'rejected'
      updates.failed_at = now
      updates.failure_reason = failureReason || 'Manually marked as failed by admin'
    }

    // Update transaction in database
    const { data: updatedTransaction, error: updateError } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transactionId)
      .select()
      .single()
    
    if (updateError) {
      console.error('Failed to update transaction:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to update transaction' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      transaction: updatedTransaction,
      message: `Payout ${action === 'retry' ? 'retried' : action === 'complete' ? 'marked as completed' : 'marked as failed'} successfully`
    })

  } catch (error) {
    console.error('Error managing payout:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
