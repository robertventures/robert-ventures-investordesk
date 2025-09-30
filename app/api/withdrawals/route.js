import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'
import { calculateInvestmentValue, calculateWithdrawalAmount } from '../../../lib/investmentCalculations'
import { getCurrentAppTime } from '../../../lib/appTime'

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
    if (investment.status !== 'confirmed') {
      return NextResponse.json({ 
        success: false, 
        error: 'Only confirmed investments can be withdrawn' 
      }, { status: 400 })
    }

    // Calculate current value (as of app time) and set up 90-day notice period
    const appTime = await getCurrentAppTime()
    const now = new Date(appTime || new Date().toISOString())
    const currentValue = calculateInvestmentValue(investment, now.toISOString())
    // Notice period starts now; withdrawal eligible at the later of lock up end or notice end
    const noticeStartAt = now.toISOString()
    const noticeEndDate = new Date(now)
    noticeEndDate.setDate(noticeEndDate.getDate() + 90)
    const lockupEnd = currentValue.lockupEndDate ? new Date(currentValue.lockupEndDate) : new Date(now)
    const payoutEligibleAt = new Date(Math.max(lockupEnd.getTime(), noticeEndDate.getTime())).toISOString()

    // For monthly payout investments: withdraw principal only
    const isMonthly = investment.paymentFrequency === 'monthly'
    const principalAmount = investment.amount
    const compAmount = currentValue.currentValue
    const withdrawableAmount = isMonthly ? principalAmount : compAmount
    const earningsAmount = isMonthly ? 0 : (currentValue.totalEarnings || 0)

    // Create withdrawal record
    const withdrawalId = Date.now().toString()
    const withdrawal = {
      id: withdrawalId,
      investmentId,
      userId,
      amount: withdrawableAmount,
      principalAmount: principalAmount,
      earningsAmount: earningsAmount,
      status: 'notice',
      requestedAt: now.toISOString(),
      noticeStartAt,
      noticeEndAt: noticeEndDate.toISOString(),
      payoutEligibleAt,
      investment: {
        originalAmount: investment.amount,
        lockupPeriod: investment.lockupPeriod,
        paymentFrequency: investment.paymentFrequency,
        confirmedAt: investment.confirmedAt,
        lockupEndDate: investment.lockupEndDate
      }
    }

    // Update investment status to reflect withdrawal notice period
    investments[invIndex] = {
      ...investment,
      status: 'withdrawal_notice',
      withdrawalNoticeStartAt: noticeStartAt,
      withdrawalNoticeEndAt: noticeEndDate.toISOString(),
      payoutEligibleAt,
      withdrawalId,
      finalValue: withdrawableAmount,
      totalEarnings: earningsAmount,
      updatedAt: new Date().toISOString()
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
      message: 'Withdrawal request submitted successfully' 
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
