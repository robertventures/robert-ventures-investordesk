import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'

// GET - List all pending payouts across all users
export async function GET() {
  try {
    const usersData = await getUsers()
    const pendingPayouts = []

    // Collect all pending/failed payout transactions
    for (const user of usersData.users) {
      if (user.isAdmin) continue
      
      const transactions = Array.isArray(user.transactions) ? user.transactions : []
      const investments = Array.isArray(user.investments) ? user.investments : []
      
      // Find monthly_distribution events with pending or failed status
      transactions.forEach(tx => {
        if (tx.type === 'monthly_distribution' && 
            (tx.payoutStatus === 'pending' || tx.payoutStatus === 'failed')) {
          
          // Find the related investment
          const investment = investments.find(inv => inv.id === tx.investmentId)
          
          pendingPayouts.push({
            ...tx,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            investmentAmount: investment?.amount || 0,
            lockupPeriod: investment?.lockupPeriod || tx.lockupPeriod,
            payoutBankNickname: tx.payoutBankNickname || 'Unknown',
            failureReason: tx.failureReason || null,
            retryCount: tx.retryCount || 0,
            lastRetryAt: tx.lastRetryAt || null
          })
        }
      })
    }

    // Sort by date (oldest first)
    pendingPayouts.sort((a, b) => new Date(a.date) - new Date(b.date))

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
    const transactions = Array.isArray(user.transactions) ? user.transactions : []
    const txIndex = transactions.findIndex(tx => tx.id === transactionId)

    if (txIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        error: 'Transaction not found' 
      }, { status: 404 })
    }

    const transaction = transactions[txIndex]

    if (transaction.type !== 'monthly_distribution') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only monthly distribution transactions can be managed' 
      }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === 'retry') {
      // Simulate retry logic - in production, this would call the bank API
      // For now, we'll mark it as completed if retry is successful
      // You can add real bank transfer logic here
      
      const retryCount = (transaction.retryCount || 0) + 1
      
      // Simulate: 80% success rate on retry
      const retrySuccess = Math.random() > 0.2
      
      if (retrySuccess) {
        transaction.payoutStatus = 'completed'
        transaction.completedAt = now
        transaction.retryCount = retryCount
        transaction.lastRetryAt = now
        transaction.failureReason = null
      } else {
        transaction.payoutStatus = 'failed'
        transaction.retryCount = retryCount
        transaction.lastRetryAt = now
        transaction.failureReason = failureReason || 'Bank connection failed during retry'
      }

    } else if (action === 'complete') {
      // Manually mark as completed (admin override)
      transaction.payoutStatus = 'completed'
      transaction.completedAt = now
      transaction.manuallyCompleted = true
      transaction.failureReason = null

    } else if (action === 'fail') {
      // Manually mark as failed with reason
      transaction.payoutStatus = 'failed'
      transaction.failedAt = now
      transaction.failureReason = failureReason || 'Manually marked as failed by admin'
    }

    transactions[txIndex] = transaction
    user.transactions = transactions
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

