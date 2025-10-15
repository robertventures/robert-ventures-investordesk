import { NextResponse } from 'next/server'
import { getUsers } from '../../../../lib/database'
import { seedWealthblockAccounts } from '../../../../lib/seedWealthblockAccounts.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

/**
 * POST /api/admin/seed-wealthblock
 * Seeds real user data from Wealthblock for testing
 * Admin only - NEVER deletes admin accounts
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    // Seed Wealthblock accounts (preserves admin accounts)
    await seedWealthblockAccounts()
    const refreshed = await getUsers()

    return NextResponse.json({ 
      success: true,
      totalUsers: refreshed.users?.length || 0,
      message: 'Wealthblock accounts seeded successfully'
    })
  } catch (error) {
    console.error('Error seeding Wealthblock accounts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed Wealthblock accounts', details: error.message },
      { status: 500 }
    )
  }
}

