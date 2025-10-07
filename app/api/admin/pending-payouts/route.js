import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'

// GET - List all pending payouts across all users
export async function GET() {
  try {
    const usersData = await getUsers()
    const pendingPayouts = []

    for (const user of usersData.users) {
      if (user.isAdmin) continue
      const investments = Array.isArray(user.investments) ? user.investments : []

      investments.forEach(investment => {
        if (!investment || !Array.isArray(investment.transactions)) return

        investment.transactions.forEach(tx => {
          if (tx.type !== 'distribution') return
          if (tx.status !== 'pending' && tx.status !== 'approved') return

          pendingPayouts.push({
            ...tx,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            investmentId: investment.id,
            investmentAmount: investment.amount || 0,
            lockupPeriod: investment.lockupPeriod || tx.lockupPeriod,
            payoutBankNickname: tx.payoutBankNickname || 'Unknown',
            failureReason: tx.failureReason || null,
            retryCount: tx.retryCount || 0,
            lastRetryAt: tx.lastRetryAt || null
          })
        })
      })
    }

    pendingPayouts.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))

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

    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.id === userId)

    if (userIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const user = usersData.users[userIndex]
    const investments = Array.isArray(user.investments) ? user.investments : []
    const investment = investments.find(inv => Array.isArray(inv.transactions) && inv.transactions.some(tx => tx.id === transactionId))

    if (!investment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction not found' 
      }, { status: 404 })
    }

    const txIndex = investment.transactions.findIndex(tx => tx.id === transactionId)
    const transaction = investment.transactions[txIndex]

    if (!transaction || transaction.type !== 'distribution') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only distribution transactions can be managed' 
      }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === 'retry') {
      // TESTING MODE: Simulate retry logic with mock bank transfer
      // In production, this would call the actual bank API
      // For testing, we simulate an 80% success rate
      
      const retryCount = (transaction.retryCount || 0) + 1
      const retrySuccess = Math.random() > 0.2

      transaction.retryCount = retryCount
      transaction.lastRetryAt = now

      if (retrySuccess) {
        transaction.status = 'received'
        transaction.completedAt = now
        transaction.failureReason = null
      } else {
        transaction.status = 'rejected'
        transaction.failureReason = failureReason || 'Mock bank transfer failed during retry'
      }

    } else if (action === 'complete') {
      transaction.status = 'received'
      transaction.completedAt = now
      transaction.manuallyCompleted = true
      transaction.failureReason = null

    } else if (action === 'fail') {
      transaction.status = 'rejected'
      transaction.failedAt = now
      transaction.failureReason = failureReason || 'Manually marked as failed by admin'
    }

    investment.transactions[txIndex] = transaction
    investment.updatedAt = now
    user.updatedAt = now
    usersData.users[userIndex] = user

    const saved = await saveUsers(usersData)
    if (!saved) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save changes' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      transaction,
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
