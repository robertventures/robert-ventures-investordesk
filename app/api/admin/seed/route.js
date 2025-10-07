import { NextResponse } from 'next/server'
import { getUsers } from '../../../../lib/database'
import { seedTestAccounts } from '../../../../lib/seedAccounts.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { adminUserId } = body || {}

    if (!adminUserId) {
      return NextResponse.json({ success: false, error: 'adminUserId is required' }, { status: 400 })
    }

    const usersData = await getUsers()
    const admin = usersData.users?.find(u => u.id === adminUserId && u.isAdmin)
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
    }

    await seedTestAccounts()
    const refreshed = await getUsers()

    return NextResponse.json({ success: true, totalUsers: refreshed.users?.length || 0 })
  } catch (error) {
    console.error('Failed to seed accounts', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

