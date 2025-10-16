import { NextResponse } from 'next/server'
import { getUsers } from '../../../../lib/database'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

/**
 * POST /api/admin/seed-wealthblock
 * Seeds real user data from Wealthblock for testing
 * Admin only - NEVER deletes admin accounts
 * 
 * NOTE: This endpoint dynamically imports seedWealthblockAccounts.js
 * If the file doesn't exist (in production), it returns an error.
 * The file is gitignored for security (contains real PII).
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    // Dynamically import seedWealthblockAccounts (file is gitignored)
    let seedWealthblockAccounts
    try {
      const module = await import('../../../../lib/seedWealthblockAccounts.js')
      seedWealthblockAccounts = module.seedWealthblockAccounts || module.default
    } catch (importError) {
      console.warn('⚠️  seedWealthblockAccounts.js not found (this is expected in production)')
      return NextResponse.json(
        { 
          success: false, 
          error: 'Seed file not available',
          details: 'lib/seedWealthblockAccounts.js is gitignored. Create it locally from the template: cp lib/seedWealthblockAccounts.template.js lib/seedWealthblockAccounts.js'
        },
        { status: 404 }
      )
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

