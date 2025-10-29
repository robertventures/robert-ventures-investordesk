import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'

export async function DELETE(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const supabase = createServiceClient()

    // First, get all non-admin users to count them
    const { data: nonAdminUsers, error: countError } = await supabase
      .from('users')
      .select('id, auth_id')
      .eq('is_admin', false)

    if (countError) {
      console.error('Error counting users:', countError)
      return NextResponse.json({ success: false, error: 'Failed to count users' }, { status: 500 })
    }

    const deletedCount = nonAdminUsers?.length || 0

    if (deletedCount === 0) {
      return NextResponse.json({ success: true, deletedCount: 0 })
    }

    // Delete related data first (due to foreign key constraints)
    // Delete in order: transactions, activity, withdrawals, bank_accounts, investments, users
    
    // Get all investment IDs for non-admin users
    const { data: investments } = await supabase
      .from('investments')
      .select('id, user_id')
      .in('user_id', nonAdminUsers.map(u => u.id))

    const investmentIds = investments?.map(inv => inv.id) || []

    // Delete transactions for these investments
    if (investmentIds.length > 0) {
      await supabase
        .from('transactions')
        .delete()
        .in('investment_id', investmentIds)
    }

    // Delete activity for non-admin users
    await supabase
      .from('activity')
      .delete()
      .in('user_id', nonAdminUsers.map(u => u.id))

    // Delete withdrawals for non-admin users
    await supabase
      .from('withdrawals')
      .delete()
      .in('user_id', nonAdminUsers.map(u => u.id))

    // Delete bank accounts for non-admin users
    await supabase
      .from('bank_accounts')
      .delete()
      .in('user_id', nonAdminUsers.map(u => u.id))

    // Delete investments for non-admin users
    if (investmentIds.length > 0) {
      await supabase
        .from('investments')
        .delete()
        .in('id', investmentIds)
    }

    // Delete users from users table
    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('is_admin', false)

    if (deleteError) {
      console.error('Error deleting users:', deleteError)
      return NextResponse.json({ success: false, error: 'Failed to delete users from database' }, { status: 500 })
    }

    // Delete auth users (from Supabase Auth)
    const authDeletionFailures = []
    for (const user of nonAdminUsers) {
      if (user.auth_id) {
        try {
          const { error: authError } = await supabase.auth.admin.deleteUser(user.auth_id)
          if (authError) {
            console.error('Failed to delete auth user:', user.auth_id, authError)
            authDeletionFailures.push({
              userId: user.id,
              authId: user.auth_id,
              error: authError.message || 'Unknown error'
            })
          }
        } catch (authError) {
          console.error('Failed to delete auth user:', user.auth_id, authError)
          authDeletionFailures.push({
            userId: user.id,
            authId: user.auth_id,
            error: authError.message || 'Unknown error'
          })
        }
      }
    }

    console.log(`Deleted ${deletedCount} non-admin accounts from database`)
    
    if (authDeletionFailures.length > 0) {
      console.error(`Failed to delete ${authDeletionFailures.length} auth users:`, authDeletionFailures)
      return NextResponse.json({ 
        success: false, 
        deletedCount,
        error: `Deleted ${deletedCount} users from database, but failed to delete ${authDeletionFailures.length} auth users. Check console for details.`,
        authDeletionFailures 
      }, { status: 207 }) // 207 Multi-Status for partial success
    }

    return NextResponse.json({ success: true, deletedCount })
  } catch (error) {
    console.error('Failed to delete accounts', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

