import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'

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
    const body = await request.json()
    const { appTime, adminUserId } = body
    
    if (!adminUserId || !appTime) {
      return NextResponse.json(
        { success: false, error: 'adminUserId and appTime are required' },
        { status: 400 }
      )
    }

    // Verify admin permissions
    const usersData = await getUsers()
    const admin = usersData.users.find(u => u.id === adminUserId && u.isAdmin)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Validate the date
    const newAppTime = new Date(appTime)
    if (isNaN(newAppTime.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 })
    }

    // Set the app time
    usersData.appTime = newAppTime.toISOString()
    usersData.timeMachineSetBy = adminUserId
    usersData.timeMachineSetAt = new Date().toISOString()
    
    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to save app time' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      appTime: usersData.appTime,
      message: 'App time updated successfully'
    })
  } catch (error) {
    console.error('Error setting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Reset app time to real time
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const adminUserId = searchParams.get('adminUserId')
    
    if (!adminUserId) {
      return NextResponse.json(
        { success: false, error: 'adminUserId is required' },
        { status: 400 }
      )
    }

    // Verify admin permissions
    const usersData = await getUsers()
    const admin = usersData.users.find(u => u.id === adminUserId && u.isAdmin)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    // Reset to real time
    delete usersData.appTime
    delete usersData.timeMachineSetBy
    delete usersData.timeMachineSetAt
    
    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to reset app time' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      appTime: new Date().toISOString(),
      message: 'App time reset to real time'
    })
  } catch (error) {
    console.error('Error resetting app time:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
