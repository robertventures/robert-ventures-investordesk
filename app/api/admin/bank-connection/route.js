import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/supabaseDatabase.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

// POST - Update bank connection status for testing
// Body: { userId, bankId, connectionStatus: 'connected' | 'disconnected' | 'error' }
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }
    const body = await request.json()
    const { userId, bankId, connectionStatus } = body

    if (!userId || !connectionStatus) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId and connectionStatus are required' 
      }, { status: 400 })
    }

    if (!['connected', 'disconnected', 'error'].includes(connectionStatus)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid connectionStatus. Must be: connected, disconnected, or error' 
      }, { status: 400 })
    }

    const usersData = await getUsers()
    const userIndex = usersData.users.findIndex(u => u.id === userId)

    if (userIndex === -1) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const user = usersData.users[userIndex]
    const now = new Date().toISOString()
    let updated = false

    // Update bank accounts array if exists
    if (Array.isArray(user.bankAccounts) && bankId) {
      const bankIndex = user.bankAccounts.findIndex(b => b.id === bankId)
      if (bankIndex !== -1) {
        user.bankAccounts[bankIndex].connectionStatus = connectionStatus
        user.bankAccounts[bankIndex].lastCheckedAt = now
        updated = true
      }
    }

    // Update investment-specific bank accounts
    if (Array.isArray(user.investments)) {
      user.investments.forEach((inv, invIndex) => {
        if (inv.banking?.bank && (!bankId || inv.banking.bank.id === bankId)) {
          if (!user.investments[invIndex].banking) {
            user.investments[invIndex].banking = {}
          }
          if (!user.investments[invIndex].banking.bank) {
            user.investments[invIndex].banking.bank = {}
          }
          user.investments[invIndex].banking.bank.connectionStatus = connectionStatus
          user.investments[invIndex].banking.bank.lastCheckedAt = now
          updated = true
        }
      })
    }

    if (!updated && bankId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bank account not found' 
      }, { status: 404 })
    }

    user.updatedAt = now
    usersData.users[userIndex] = user

    const saved = await saveUsers(usersData)
    if (!saved) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save changes' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: `Bank connection status updated to: ${connectionStatus}`,
      user
    })

  } catch (error) {
    console.error('Error updating bank connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// GET - Get bank connection status for a user
export async function GET(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'userId is required' 
      }, { status: 400 })
    }

    const usersData = await getUsers()
    const user = usersData.users.find(u => u.id === userId)

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const bankAccounts = Array.isArray(user.bankAccounts) ? user.bankAccounts : []
    const investmentBanks = []

    if (Array.isArray(user.investments)) {
      user.investments.forEach(inv => {
        if (inv.banking?.bank) {
          investmentBanks.push({
            investmentId: inv.id,
            bank: inv.banking.bank
          })
        }
      })
    }

    return NextResponse.json({ 
      success: true,
      bankAccounts,
      investmentBanks
    })

  } catch (error) {
    console.error('Error fetching bank connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

