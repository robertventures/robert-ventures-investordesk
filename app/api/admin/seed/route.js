import { NextResponse } from 'next/server'
import { getUsers } from '../../../../lib/database'
import { seedTestAccounts } from '../../../../lib/seedAccounts.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    await seedTestAccounts()
    const refreshed = await getUsers()

    return NextResponse.json({ success: true, totalUsers: refreshed.users?.length || 0 })
  } catch (error) {
    console.error('Failed to seed accounts', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

