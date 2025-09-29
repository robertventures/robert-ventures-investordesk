import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'
import { getCurrentAppTime } from '../../../../lib/appTime'

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
      // Approve only if notice period elapsed
      if (wd.payoutEligibleAt && new Date(now) < new Date(wd.payoutEligibleAt)) {
        return NextResponse.json({ success: false, error: 'Withdrawal not yet eligible for payout' }, { status: 400 })
      }
      wd.status = 'approved'
      wd.approvedAt = now.toISOString()
      wd.paidAt = now.toISOString()
      // Update investment status to withdrawn
      const invs = Array.isArray(user.investments) ? user.investments : []
      const invIdx = invs.findIndex(inv => inv.id === wd.investmentId)
      if (invIdx !== -1) {
        invs[invIdx] = { ...invs[invIdx], status: 'withdrawn', withdrawnAt: now.toISOString(), updatedAt: now.toISOString() }
      }
      user.investments = invs
    } else if (action === 'reject') {
      wd.status = 'rejected'
      wd.rejectedAt = now.toISOString()
      // Revert investment status
      const invs = Array.isArray(user.investments) ? user.investments : []
      const invIdx = invs.findIndex(inv => inv.id === wd.investmentId)
      if (invIdx !== -1) {
        invs[invIdx] = { ...invs[invIdx], status: 'confirmed', updatedAt: now.toISOString(), withdrawalId: undefined, withdrawalNoticeStartAt: undefined, withdrawalNoticeEndAt: undefined, payoutEligibleAt: undefined }
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


