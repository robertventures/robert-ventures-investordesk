import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'

export async function POST() {
  try {
    console.log('Starting migration: confirmed -> active status')
    const usersData = await getUsers()
    let migrationCount = 0

    // Update all users' investments
    for (let userIndex = 0; userIndex < usersData.users.length; userIndex++) {
      const user = usersData.users[userIndex]
      if (!user.investments || !Array.isArray(user.investments)) continue

      let hasChanges = false
      for (let invIndex = 0; invIndex < user.investments.length; invIndex++) {
        const investment = user.investments[invIndex]
        if (investment && investment.status === 'confirmed') {
          investment.status = 'active'
          hasChanges = true
          migrationCount++
          console.log(`Migrated investment ${investment.id} for user ${user.email} from confirmed to active`)
        }
      }

      if (hasChanges) {
        usersData.users[userIndex] = {
          ...user,
          updatedAt: new Date().toISOString()
        }
      }
    }

    if (migrationCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No investments needed migration - all investments already use correct status',
        migrationCount: 0
      })
    }

    const saved = await saveUsers(usersData)
    if (!saved) {
      return NextResponse.json({
        success: false,
        error: 'Failed to save migrated data'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${migrationCount} investment(s) from 'confirmed' to 'active' status`,
      migrationCount
    })

  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error during migration'
    }, { status: 500 })
  }
}
