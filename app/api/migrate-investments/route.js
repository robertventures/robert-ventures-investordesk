import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../lib/database'

// POST - Migrate existing investments to add missing confirmedAt and lockupEndDate fields
export async function POST(request) {
  try {
    const usersData = await getUsers()
    let migratedCount = 0
    
    for (const user of usersData.users) {
      if (!user.investments || !Array.isArray(user.investments)) continue
      
      let userUpdated = false
      
      for (const investment of user.investments) {
        // Migrate old 'pending' investments that should now be 'confirmed'
        // AND remove lock up/confirmation dates from investments that should just be 'pending'
        if (investment.status === 'pending') {
          // Check if this investment has lock up dates (meaning it was already "confirmed" in old system)
          if (investment.lockupEndDate || investment.confirmedAt) {
            // This was already confirmed, change status to 'confirmed'
            investment.status = 'confirmed'
            investment.updatedAt = new Date().toISOString()
            userUpdated = true
            migratedCount++
          } else {
            // This is truly pending (waiting for admin confirmation)
            // Remove any lock up/confirmation dates that shouldn't be there
            if (investment.confirmedAt) delete investment.confirmedAt
            if (investment.lockupEndDate) delete investment.lockupEndDate
            investment.updatedAt = new Date().toISOString()
            userUpdated = true
            migratedCount++
          }
        }
      }
      
      if (userUpdated) {
        user.updatedAt = new Date().toISOString()
      }
    }
    
    if (migratedCount > 0) {
      const saveResult = await saveUsers(usersData)
      if (!saveResult) {
        return NextResponse.json({ success: false, error: 'Failed to save migrated data' }, { status: 500 })
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully migrated ${migratedCount} investments`,
      migratedCount 
    })
  } catch (error) {
    console.error('Error migrating investments:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
