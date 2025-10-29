import { NextResponse } from 'next/server'
import { getUser } from '../../../../lib/supabaseDatabase.js'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'

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

    const supabase = createServiceClient()
    const user = await getUser(userId)

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const now = new Date().toISOString()
    let updated = false

    // Update bank accounts in bank_accounts table
    if (bankId) {
      const { data: bankAccount, error: bankError } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('id', bankId)
        .eq('user_id', userId)
        .maybeSingle()
      
      if (bankAccount) {
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({
            connection_status: connectionStatus,
            last_checked_at: now,
            updated_at: now
          })
          .eq('id', bankId)
        
        if (!updateError) {
          updated = true
        }
      }
    }

    if (!updated && bankId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bank account not found' 
      }, { status: 404 })
    }

    // Update user timestamp
    await supabase
      .from('users')
      .update({ updated_at: now })
      .eq('id', userId)

    // Fetch updated user data
    const updatedUser = await getUser(userId)

    return NextResponse.json({ 
      success: true,
      message: `Bank connection status updated to: ${connectionStatus}`,
      user: updatedUser
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

    const user = await getUser(userId)

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 })
    }

    const bankAccounts = Array.isArray(user.bank_accounts) ? user.bank_accounts : []

    return NextResponse.json({ 
      success: true,
      bankAccounts
    })

  } catch (error) {
    console.error('Error fetching bank connection:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

