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

// POST - admin action { action: 'approve'|'reject', userId, withdrawalId }
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, userId, withdrawalId } = body
    if (!action || !userId || !withdrawalId) {
      return NextResponse.json({ success: false, error: 'Missing fields' }, { status: 400 })
    }
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

    if (action === 'approve') {
      // Admin can approve anytime within the 90-day window
      // No validation needed - Robert Ventures has flexibility to pay before the deadline
      
      // Calculate final payout including partial month interest up to withdrawal date
      const invs = Array.isArray(user.investments) ? user.investments : []
      const invIdx = invs.findIndex(inv => inv.id === wd.investmentId)
      
      if (invIdx !== -1) {
        const investment = invs[invIdx]
        
        // Calculate final value including interest for every day up to withdrawal date
        const finalPayout = calculateFinalWithdrawalPayout(investment, now.toISOString())
        
        // Update withdrawal record with final calculated amounts
        wd.status = 'approved'
        wd.approvedAt = now.toISOString()
        wd.paidAt = now.toISOString()
        wd.amount = finalPayout.finalValue
        wd.principalAmount = finalPayout.principalAmount
        wd.earningsAmount = finalPayout.totalEarnings
        
        // Update investment status to withdrawn with final values
        const transactions = Array.isArray(investment.transactions) ? investment.transactions : []
        const redemptionTxId = generateTransactionId('INV', investment.id, 'redemption', { withdrawalId })
        const txIdx = transactions.findIndex(tx => tx.id === redemptionTxId)
        if (txIdx !== -1) {
          transactions[txIdx] = {
            ...transactions[txIdx],
            status: 'received',
            amount: finalPayout.finalValue,
            approvedAt: now.toISOString(),
            paidAt: now.toISOString(),
            updatedAt: now.toISOString()
          }
        } else {
          transactions.push({
            id: redemptionTxId,
            type: 'redemption',
            amount: finalPayout.finalValue,
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
        // Investment not found, still mark withdrawal as approved but without recalculation
        wd.status = 'approved'
        wd.approvedAt = now.toISOString()
        wd.paidAt = now.toISOString()
      }
      
      user.investments = invs
    } else if (action === 'reject') {
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
    return NextResponse.json({ success: true, withdrawal: wd })
  } catch (e) {
    console.error('Error updating withdrawal', e)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
