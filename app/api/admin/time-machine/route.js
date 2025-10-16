import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/supabaseDatabase.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

// GET - Get current app time
export async function GET(request) {
  try {
    const usersData = await getUsers()
    const realTime = new Date()
    
    // Calculate app time using offset (time continues to flow from set point)
    let appTime
    if (usersData.timeOffset !== undefined && usersData.timeOffset !== null) {
      appTime = new Date(realTime.getTime() + usersData.timeOffset).toISOString()
    } else {
      appTime = realTime.toISOString()
    }
    
    return NextResponse.json({ 
      success: true, 
      appTime,
      realTime: realTime.toISOString(),
      isTimeMachineActive: usersData.timeOffset !== undefined && usersData.timeOffset !== null,
      timeOffset: usersData.timeOffset || null,
      timeOffsetSetAt: usersData.timeOffsetSetAt || null,
      autoApproveDistributions: usersData.autoApproveDistributions === true
    })
  } catch (error) {
    console.error('Error getting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Set app time (time machine) and/or toggle auto-approve distributions
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { appTime, autoApproveDistributions } = body
    
    const usersData = await getUsers()
    let needsSync = false

    // Update app time if provided
    if (appTime !== undefined) {
      // Validate the date
      const desiredTime = new Date(appTime)
      if (isNaN(desiredTime.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
      }

      // Calculate and store the time offset (in milliseconds)
      // This allows time to continue flowing from the set point
      const realTime = new Date()
      usersData.timeOffset = desiredTime.getTime() - realTime.getTime()
      usersData.timeOffsetSetAt = realTime.toISOString()
      usersData.timeMachineSetBy = admin.userId
      needsSync = true
      
      console.log('Time Machine set:', {
        desiredTime: desiredTime.toISOString(),
        realTime: realTime.toISOString(),
        offsetMs: usersData.timeOffset,
        offsetDays: Math.round(usersData.timeOffset / (1000 * 60 * 60 * 24))
      })
    }

    // Update auto-approve distributions if provided
    if (autoApproveDistributions !== undefined) {
      usersData.autoApproveDistributions = autoApproveDistributions === true
      // Auto-approve toggle changes require transaction sync to apply to new distributions
      needsSync = true
    }

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to save settings' }, { status: 500 })
    }

    // Calculate current app time for response
    const realTime = new Date()
    let currentAppTime
    if (usersData.timeOffset !== undefined && usersData.timeOffset !== null) {
      currentAppTime = new Date(realTime.getTime() + usersData.timeOffset).toISOString()
    } else {
      currentAppTime = realTime.toISOString()
    }
    
    // Respond immediately - let transaction sync happen in background if needed
    const response = NextResponse.json({
      success: true,
      appTime: currentAppTime,
      realTime: realTime.toISOString(),
      timeOffset: usersData.timeOffset || null,
      autoApproveDistributions: usersData.autoApproveDistributions === true,
      message: needsSync ? 'Settings updated successfully. Transactions will sync in background.' : 'Settings updated successfully.'
    })

    // Sync transactions in background (non-blocking) only if needed
    if (needsSync) {
      import('../../../../lib/transactionSync.js').then(({ syncTransactionsNonBlocking }) => {
        syncTransactionsNonBlocking().catch(err => {
          console.error('Failed to sync transactions after settings update:', err)
        })
      })
    }

    return response
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Reset app time to real time and reset auto-approve toggle
export async function DELETE(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const usersData = await getUsers()

    // Reset to real time (but preserve auto-approve setting)
    delete usersData.timeOffset
    delete usersData.timeOffsetSetAt
    delete usersData.timeMachineSetBy
    // Keep autoApproveDistributions setting - it should persist independently

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to reset app time' }, { status: 500 })
    }

    // Respond immediately - let transaction sync happen in background
    const response = NextResponse.json({
      success: true,
      appTime: new Date().toISOString(),
      autoApproveDistributions: usersData.autoApproveDistributions === true,
      message: 'App time reset to real time. Transactions will sync in background.'
    })

    // Sync transactions in background (non-blocking)
    // This regenerates all distributions/contributions based on real time
    // Fire-and-forget: run in background without blocking response
    import('../../../../lib/transactionSync.js').then(({ syncTransactionsNonBlocking }) => {
      syncTransactionsNonBlocking().catch(err => {
        console.error('Failed to sync transactions after time machine reset:', err)
      })
    })

    return response
  } catch (error) {
    console.error('Error resetting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
