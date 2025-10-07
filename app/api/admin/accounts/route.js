import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'

export async function DELETE(request) {
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

