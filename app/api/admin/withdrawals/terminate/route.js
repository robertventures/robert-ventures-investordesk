import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../../lib/database'
import { getCurrentAppTime } from '../../../../../lib/appTime'
import { calculateFinalWithdrawalPayout } from '../../../../../lib/investmentCalculations'
import { generateTransactionId, generateWithdrawalId } from '../../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../../lib/authMiddleware'

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

    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.id === userId)
    
    if (userIndex === -1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const user = usersData.users[userIndex]
    const investments = Array.isArray(user.investments) ? user.investments : []
    const invIndex = investments.findIndex(inv => inv.id === investmentId)
    
    if (invIndex === -1) {
      return NextResponse.json({ success: false, error: 'Investment not found' }, { status: 404 })
    }

    const investment = investments[invIndex]

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

    if (!overrideLockup && investment.lockupEndDate) {
      const lockupEnd = new Date(investment.lockupEndDate)
      if (now < lockupEnd) {
        const daysRemaining = Math.ceil((lockupEnd - now) / (1000 * 60 * 60 * 24))
        return NextResponse.json({
          success: false,
          error: `Investment is still in lockup period. ${daysRemaining} day(s) remaining until ${lockupEnd.toLocaleDateString()}. Use overrideLockup flag to bypass.`,
          lockupEndDate: investment.lockupEndDate,
          requiresOverride: true
        }, { status: 400 })
      }
    }

    // Calculate final payout including all accrued interest up to termination
    const finalPayout = calculateFinalWithdrawalPayout(investment, now.toISOString())
    const nowIso = now.toISOString()

    // Create or update withdrawal record
    const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
    const existingWithdrawalIndex = withdrawals.findIndex(w => w.investmentId === investmentId && w.status !== 'rejected')
    
    let withdrawalId
    if (existingWithdrawalIndex !== -1) {
      // Update existing withdrawal (e.g., if investment was in withdrawal_notice status)
      withdrawalId = withdrawals[existingWithdrawalIndex].id
      withdrawals[existingWithdrawalIndex] = {
        ...withdrawals[existingWithdrawalIndex],
        status: 'approved',
        approvedAt: nowIso,
        paidAt: nowIso,
        finalAmount: finalPayout.finalValue,
        finalEarnings: finalPayout.totalEarnings,
        payoutCalculatedAt: nowIso,
        amount: finalPayout.finalValue,
        principalAmount: finalPayout.principalAmount,
        earningsAmount: finalPayout.totalEarnings,
        adminTerminated: true,
        adminUserId,
        lockupOverridden: overrideLockup || false,
        updatedAt: nowIso
      }
    } else {
      // Create new withdrawal record for admin-initiated termination
      withdrawalId = generateWithdrawalId(usersData.users)
      const withdrawal = {
        id: withdrawalId,
        investmentId,
        userId,
        amount: finalPayout.finalValue,
        principalAmount: finalPayout.principalAmount,
        earningsAmount: finalPayout.totalEarnings,
        quotedAmount: finalPayout.finalValue,
        quotedEarnings: finalPayout.totalEarnings,
        finalAmount: finalPayout.finalValue,
        finalEarnings: finalPayout.totalEarnings,
        payoutCalculatedAt: nowIso,
        accrualNotice: 'Admin-initiated termination. Payout calculated and processed immediately.',
        status: 'approved',
        requestedAt: nowIso,
        noticeStartAt: nowIso,
        approvedAt: nowIso,
        paidAt: nowIso,
        payoutDueBy: nowIso,
        adminTerminated: true,
        adminUserId,
        lockupOverridden: overrideLockup || false,
        investment: {
          originalAmount: investment.amount,
          lockupPeriod: investment.lockupPeriod,
          paymentFrequency: investment.paymentFrequency,
          confirmedAt: investment.confirmedAt,
          lockupEndDate: investment.lockupEndDate,
          statusAtRequest: investment.status,
          accruesUntilPayout: false
        },
        createdAt: nowIso,
        updatedAt: nowIso
      }
      withdrawals.push(withdrawal)
    }

    // Create/update redemption transaction
    const transactions = Array.isArray(investment.transactions) ? investment.transactions : []
    const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
    const txIdx = transactions.findIndex(tx => tx.id === redemptionTxId)
    
    const redemptionTransaction = {
      id: redemptionTxId,
      type: 'redemption',
      amount: finalPayout.finalValue,
      finalAmount: finalPayout.finalValue,
      finalEarnings: finalPayout.totalEarnings,
      payoutCalculatedAt: nowIso,
      accrualNotice: 'Admin-initiated termination. Payout calculated and processed immediately.',
      status: 'received',
      date: nowIso,
      withdrawalId,
      payoutDueBy: nowIso,
      approvedAt: nowIso,
      paidAt: nowIso,
      rejectedAt: null,
      adminTerminated: true,
      adminUserId,
      lockupOverridden: overrideLockup || false,
      createdAt: nowIso,
      updatedAt: nowIso
    }

    if (txIdx !== -1) {
      transactions[txIdx] = { ...transactions[txIdx], ...redemptionTransaction }
    } else {
      transactions.push(redemptionTransaction)
    }

    // Update investment status to withdrawn
    investments[invIndex] = {
      ...investment,
      status: 'withdrawn',
      withdrawnAt: nowIso,
      withdrawalId,
      finalValue: finalPayout.finalValue,
      totalEarnings: finalPayout.totalEarnings,
      transactions,
      adminTerminated: true,
      adminUserId,
      lockupOverridden: overrideLockup || false,
      updatedAt: nowIso
    }

    // Add activity event
    const activity = Array.isArray(user.activity) ? user.activity : []
    activity.push({
      id: generateTransactionId('USR', userId, 'admin_withdrawal_processed'),
      type: 'admin_withdrawal_processed',
      date: nowIso,
      investmentId,
      withdrawalId,
      amount: finalPayout.finalValue,
      adminUserId,
      lockupOverridden: overrideLockup || false
    })

    // Update user data
    const updatedUser = {
      ...user,
      investments,
      withdrawals,
      activity,
      updatedAt: nowIso
    }

    usersData.users[userIndex] = updatedUser

    // Save changes
    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to save termination' }, { status: 500 })
    }

    // Sync transactions to update activity events
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/migrate-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err) {
      console.error('Failed to sync transactions after termination:', err)
      // Non-blocking: don't fail the request if transaction sync fails
    }

    return NextResponse.json({
      success: true,
      withdrawal: withdrawals[existingWithdrawalIndex !== -1 ? existingWithdrawalIndex : withdrawals.length - 1],
      finalPayout,
      message: 'Investment terminated successfully. Withdrawal processed immediately.'
    })
  } catch (error) {
    console.error('Error processing admin termination:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

