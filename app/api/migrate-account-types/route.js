import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'

export async function POST() {
  try {
    const usersData = await getUsers()
    let updatedUsers = 0
    let totalInvestments = 0
    const accountTypeMap = {} // Track account types by user ID

    // Process each user
    for (let i = 0; i < usersData.users.length; i++) {
      const user = usersData.users[i]
      if (user.isAdmin) continue

      const investments = Array.isArray(user.investments) ? user.investments : []

      // Find investments with account types (both confirmed and pending)
      const investmentsWithAccountType = investments.filter(inv => inv.accountType)
      if (investmentsWithAccountType.length > 0) {
        // Get the account type from the first investment that has one
        const accountType = investmentsWithAccountType[0].accountType
        if (accountType && !user.accountType) {
          user.accountType = accountType
          user.lockedAccountType = accountType // Keep for backward compatibility during transition
          accountTypeMap[user.id] = accountType
          updatedUsers++
        }
      }

      totalInvestments += investments.length
    }

    if (await saveUsers(usersData)) {
      return NextResponse.json({
        success: true,
        message: `Migration completed. Updated ${updatedUsers} users with account types. Processed ${totalInvestments} total investments.`,
        details: accountTypeMap
      })
    } else {
      return NextResponse.json({ success: false, error: 'Failed to save migrated data' }, { status: 500 })
    }
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({ success: false, error: 'Migration failed' }, { status: 500 })
  }
}
