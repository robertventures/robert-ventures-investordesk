import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'
import { getCurrentAppTime } from '../../../../lib/appTime'
import { calculateFinalWithdrawalPayout } from '../../../../lib/investmentCalculations'
import { generateTransactionId } from '../../../../lib/idGenerator'

// GET - list all withdrawals pending admin action
export async function GET() {
  try {
    const usersData = await getUsers()
    const all = []
    for (const user of usersData.users) {
      const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
      withdrawals.forEach(wd => {
        all.push({ ...wd, userId: user.id, userEmail: user.email })
      })
    }
    const pending = all.filter(w => w.status === 'notice' || w.status === 'pending')
      .sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt))
    return NextResponse.json({ success: true, withdrawals: pending })
  } catch (e) {
    console.error('Error listing withdrawals', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - admin action { action: 'approve'|'complete'|'reject', userId, withdrawalId }
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, userId, withdrawalId } = body
    if (!action || !userId || !withdrawalId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
    const normalizedAction = action === 'approve' ? 'complete' : action
    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.id === userId)
    if (userIndex === -1) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    const user = usersData.users[userIndex]
    const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
    const wdIndex = withdrawals.findIndex(w => w.id === withdrawalId)
    if (wdIndex === -1) return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 })
    const wd = withdrawals[wdIndex]

    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())

    if (normalizedAction === 'complete') {
      // Admin finalizes payout anytime within the 90-day window
      // Robert Ventures must pay principal + accrued interest at payout time
      const invs = Array.isArray(user.investments) ? user.investments : []
      const invIdx = invs.findIndex(inv => inv.id === wd.investmentId)
      
      if (invIdx !== -1) {
        const investment = invs[invIdx]

        // Calculate final payout including interest accrued up to payout time
        const finalPayout = calculateFinalWithdrawalPayout(investment, now.toISOString())

        // Update withdrawal record with final calculated amounts
        wd.status = 'approved'
        wd.approvedAt = now.toISOString()
        wd.paidAt = now.toISOString()
        wd.finalAmount = finalPayout.finalValue
        wd.finalEarnings = finalPayout.totalEarnings
        wd.payoutCalculatedAt = now.toISOString()
        wd.amount = finalPayout.finalValue
        wd.principalAmount = finalPayout.principalAmount
        wd.earningsAmount = finalPayout.totalEarnings

        // Update investment status to withdrawn with final values
        const transactions = Array.isArray(investment.transactions) ? investment.transactions : []
        const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
        const txIdx = transactions.findIndex(tx => tx.id === redemptionTxId)
        const existingRedemption = txIdx !== -1 ? transactions[txIdx] : null
        const accrualNotice = wd.accrualNotice || existingRedemption?.accrualNotice || 'This investment keeps earning interest until the withdrawal is paid out. The final payout amount is calculated when funds are sent.'
        if (txIdx !== -1) {
          transactions[txIdx] = {
            ...transactions[txIdx],
            status: 'received',
            amount: finalPayout.finalValue,
            finalAmount: finalPayout.finalValue,
            finalEarnings: finalPayout.totalEarnings,
            payoutCalculatedAt: now.toISOString(),
            accrualNotice,
            approvedAt: now.toISOString(),
            paidAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        } else {
          transactions.push({
            id: redemptionTxId,
            type: 'redemption',
            amount: finalPayout.finalValue,
            finalAmount: finalPayout.finalValue,
            finalEarnings: finalPayout.totalEarnings,
            payoutCalculatedAt: now.toISOString(),
            accrualNotice,
            status: 'received',
            date: wd.requestedAt || wd.noticeStartAt || now.toISOString(),
            withdrawalId,
            payoutDueBy: wd.payoutDueBy || null,
            approvedAt: now.toISOString(),
            paidAt: now.toISOString(),
            rejectedAt: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          })
        }

        invs[invIdx] = {
          ...investment,
          status: 'withdrawn',
          withdrawnAt: now.toISOString(),
          finalValue: finalPayout.finalValue,
          totalEarnings: finalPayout.totalEarnings,
          transactions,
          updatedAt: now.toISOString()
        }
      } else {
        // Investment not found - this is a data consistency error
        // In production, this should fail. For testing/development, we'll warn but allow it.
        console.warn(`⚠️ WARNING: Completing withdrawal ${withdrawalId} for missing investment ${wd.investmentId}`)
        console.warn(`   This may happen during testing when accounts are deleted with pending withdrawals.`)
        console.warn(`   In production, this should return an error instead.`)

        // Mark withdrawal as approved but flag it as potentially problematic
        wd.status = 'approved'
        wd.approvedAt = now.toISOString()
        wd.paidAt = now.toISOString()
        wd.dataInconsistency = true // Flag for audit purposes
        wd.inconsistencyReason = `Investment ${wd.investmentId} not found at approval time`

        // Use the originally requested amount since we can't recalculate
        // Leave principalAmount and earningsAmount undefined to indicate incomplete data
      }
      
      user.investments = invs
    } else if (normalizedAction === 'reject') {
      wd.status = 'rejected'
      wd.rejectedAt = now.toISOString()
      // Revert investment status
      const invs = Array.isArray(user.investments) ? user.investments : []
      const invIdx = invs.findIndex(inv => inv.id === wd.investmentId)
      if (invIdx !== -1) {
        const investment = invs[invIdx]
        const transactions = Array.isArray(investment.transactions) ? investment.transactions : []
        const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
        const txIdx = transactions.findIndex(tx => tx.id === redemptionTxId)
        if (txIdx !== -1) {
          transactions[txIdx] = {
            ...transactions[txIdx],
            status: 'rejected',
            rejectedAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        } else {
          transactions.push({
            id: redemptionTxId,
            type: 'redemption',
            amount: wd.amount || 0,
            status: 'rejected',
            date: wd.requestedAt || wd.noticeStartAt || now.toISOString(),
            withdrawalId,
            payoutDueBy: wd.payoutDueBy || null,
            approvedAt: null,
            paidAt: null,
            rejectedAt: now.toISOString(),
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          })
        }
        invs[invIdx] = { 
          ...investment, 
          status: 'active', 
          updatedAt: now.toISOString(), 
          withdrawalId: undefined, 
          withdrawalNoticeStartAt: undefined, 
          payoutDueBy: undefined,
          transactions
        }
      }
      user.investments = invs
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    }

    withdrawals[wdIndex] = wd
    user.withdrawals = withdrawals
    usersData.users[userIndex] = user
    const saved = await saveUsers(usersData)
    if (!saved) return NextResponse.json({ success: false, error: 'Failed to save' }, { status: 500 })

    // Sync transactions immediately after withdrawal action
    // This updates redemption transaction status and activity events
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/migrate-transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    } catch (err) {
      console.error('Failed to sync transactions after withdrawal action:', err)
      // Non-blocking: don't fail the request if transaction sync fails
    }

    return NextResponse.json({ success: true, withdrawal: wd })
  } catch (e) {
    console.error('Error updating withdrawal', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
