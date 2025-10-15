import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

// GET - Get current app time
export async function GET(request) {
  try {
    const usersData = await getUsers()
    const appTime = usersData.appTime || new Date().toISOString()
    
    return NextResponse.json({ 
      success: true, 
      appTime,
      realTime: new Date().toISOString(),
      isTimeMachineActive: usersData.appTime !== undefined
    })
  } catch (error) {
    console.error('Error getting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Set app time (time machine)
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { appTime } = body
    
    if (!appTime) {
      return NextResponse.json(
        { success: false, error: 'appTime is required' },
        { status: 400 }
      )
    }

    const usersData = await getUsers()

    // Validate the date
    const newAppTime = new Date(appTime)
    if (isNaN(newAppTime.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
    }

    // Set the app time
    usersData.appTime = newAppTime.toISOString()
    usersData.timeMachineSetBy = admin.userId
    usersData.timeMachineSetAt = new Date().toISOString()

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to save app time' }, { status: 500 })
    }

    // Respond immediately - let transaction sync happen in background
    const response = NextResponse.json({
      success: true,
      appTime: usersData.appTime,
      message: 'App time updated successfully. Transactions will sync in background.'
    })

    // Sync transactions in background (non-blocking)
    // This regenerates all distributions/contributions based on the new app time
    // Don't await this - let it run after response is sent
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/migrate-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error('Failed to sync transactions after time machine update:', err)
    })

    return response
  } catch (error) {
    console.error('Error setting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Reset app time to real time
export async function DELETE(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const usersData = await getUsers()

    // Reset to real time
    delete usersData.appTime
    delete usersData.timeMachineSetBy
    delete usersData.timeMachineSetAt

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to reset app time' }, { status: 500 })
    }

    // Respond immediately - let transaction sync happen in background
    const response = NextResponse.json({
      success: true,
      appTime: new Date().toISOString(),
      message: 'App time reset to real time. Transactions will sync in background.'
    })

    // Sync transactions in background (non-blocking)
    // This regenerates all distributions/contributions based on real time
    // Don't await this - let it run after response is sent
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/migrate-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error('Failed to sync transactions after time machine reset:', err)
    })

    return response
  } catch (error) {
    console.error('Error resetting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
