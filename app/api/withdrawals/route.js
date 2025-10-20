import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/supabaseDatabase.js'
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

    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.id === userId)
    if (userIndex === -1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const user = usersData.users[userIndex]
    if (user.isAdmin) {
      return NextResponse.json({ success: false, error: 'Admins cannot withdraw investments' }, { status: 403 })
    }

    const investments = Array.isArray(user.investments) ? user.investments : []
    const invIndex = investments.findIndex(inv => inv.id === investmentId)
    if (invIndex === -1) {
      return NextResponse.json({ success: false, error: 'Investment not found' }, { status: 404 })
    }

    const investment = investments[invIndex]

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

    if (investment.lockupEndDate) {
      const lockupEnd = new Date(investment.lockupEndDate)
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
    const isMonthly = investment.paymentFrequency === 'monthly'
    const principalAmount = investment.amount
    const compAmount = currentValue.currentValue
    const withdrawableAmount = isMonthly ? principalAmount : compAmount
    const earningsAmount = isMonthly ? 0 : (currentValue.totalEarnings || 0)

    // Create withdrawal record with sequential ID
    const withdrawalId = generateWithdrawalId(usersData.users)
    const nowIso = now.toISOString()
    const accrualNotice = 'This investment keeps earning interest until the withdrawal is paid out. The final payout amount is calculated when funds are sent (within 90 days of your request).'
    const withdrawal = {
      id: withdrawalId,
      investmentId,
      userId,
      amount: withdrawableAmount,
      principalAmount: principalAmount,
      earningsAmount: earningsAmount,
      quotedAmount: withdrawableAmount,
      quotedEarnings: earningsAmount,
      finalAmount: null,
      finalEarnings: null,
      payoutCalculatedAt: null,
      accrualNotice,
      status: 'notice',
      requestedAt: nowIso,
      noticeStartAt,
      payoutDueBy,
      investment: {
        originalAmount: investment.amount,
        lockupPeriod: investment.lockupPeriod,
        paymentFrequency: investment.paymentFrequency,
        confirmedAt: investment.confirmedAt,
        lockupEndDate: investment.lockupEndDate,
        statusAtRequest: investment.status,
        accruesUntilPayout: true
      }
    }

    // Update investment status to reflect withdrawal notice period
    const investmentTransactions = Array.isArray(investment.transactions) ? investment.transactions : []
    const redemptionTxId = generateTransactionId('INV', investmentId, 'redemption', { withdrawalId })
    const existingRedemptionIndex = investmentTransactions.findIndex(tx => tx.id === redemptionTxId)
    const redemptionTransaction = {
      id: redemptionTxId,
      type: 'redemption',
      amount: withdrawableAmount,
      quotedAmount: withdrawableAmount,
      quotedEarnings: earningsAmount,
      quotedAt: nowIso,
      finalAmount: null,
      finalEarnings: null,
      payoutCalculatedAt: null,
      accrualNotice,
      status: 'pending',
      date: nowIso,
      withdrawalId,
      payoutDueBy,
      approvedAt: null,
      paidAt: null,
      rejectedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso
    }
    if (existingRedemptionIndex === -1) {
      investmentTransactions.push(redemptionTransaction)
    } else {
      investmentTransactions[existingRedemptionIndex] = {
        ...investmentTransactions[existingRedemptionIndex],
        ...redemptionTransaction
      }
    }

    investments[invIndex] = {
      ...investment,
      status: 'withdrawal_notice',
      withdrawalNoticeStartAt: noticeStartAt,
      payoutDueBy,
      withdrawalId,
      finalValue: withdrawableAmount,
      totalEarnings: earningsAmount,
      transactions: investmentTransactions,
      updatedAt: nowIso
    }

    // Add withdrawal to user's withdrawals array
    const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
    const updatedUser = {
      ...user,
      investments,
      withdrawals: [...withdrawals, withdrawal],
      updatedAt: new Date().toISOString()
    }

    usersData.users[userIndex] = updatedUser

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to process withdrawal' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      withdrawal,
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

    const usersData = await getUsers()
    const user = usersData.users.find(u => u.id === userId)
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }

    const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
    
    return NextResponse.json({ 
      success: true, 
      withdrawals: withdrawals.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
    })
  } catch (error) {
    console.error('Error fetching withdrawals:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
