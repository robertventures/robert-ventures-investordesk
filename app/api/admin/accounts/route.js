import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/supabaseDatabase.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

export async function DELETE(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const usersData = await getUsers()

    const beforeCount = usersData.users?.length || 0
    usersData.users = (usersData.users || []).filter(user => user.isAdmin)

    const afterCount = usersData.users.length
    const deletedCount = beforeCount - afterCount

    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to delete accounts' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deletedCount })
  } catch (error) {
    console.error('Failed to delete accounts', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

