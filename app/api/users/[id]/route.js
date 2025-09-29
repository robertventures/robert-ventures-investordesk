import { NextResponse } from 'next/server'
import { updateUser, getUsers, saveUsers } from '../../../../lib/database'
import { getCurrentAppTime } from '../../../../lib/appTime'

// PUT - Update user data
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    console.log('Updating user with data:', body)
    
    // Validate that we have at least one field to update
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields provided for update' },
        { status: 400 }
      )
    }

    // Custom action: change user password
    if (body._action === 'changePassword') {
      const usersData = await getUsers()
      const userIndex = usersData.users.findIndex(u => u.id === id)
      if (userIndex === -1) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
      const user = usersData.users[userIndex]
      const { currentPassword, newPassword } = body
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ success: false, error: 'Missing password fields' }, { status: 400 })
      }
      // Basic current password check (plaintext in demo). In production, use hashing.
      if ((user.password || '') !== currentPassword) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 })
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      const updatedUser = { ...user, password: newPassword, updatedAt: new Date().toISOString() }
      usersData.users[userIndex] = updatedUser
      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser })
    }

    // Custom action: start investment intent (append to user's investments array)
    if (body._action === 'startInvestment' && body.investment) {
      const usersData = await getUsers()
      const userIndex = usersData.users.findIndex(u => u.id === id)
      if (userIndex === -1) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
      const user = usersData.users[userIndex]
      if (user.isAdmin) {
        return NextResponse.json({ success: false, error: 'Admins cannot create investments' }, { status: 403 })
      }

      // Use user's account type for new investments
      const userAccountType = user.accountType
      if (userAccountType && body.investment.accountType && body.investment.accountType !== userAccountType) {
        return NextResponse.json({ success: false, error: `Account type must be ${userAccountType} for this user.` }, { status: 400 })
      }
      if (userAccountType && !body.investment.accountType) {
        body.investment.accountType = userAccountType
      }

      const investmentId = Date.now().toString()
      const newInvestment = {
        id: investmentId,
        status: 'draft',
        ...body.investment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existing = Array.isArray(user.investments) ? user.investments : []
      // Ensure user has account type set from this investment
      const shouldSetAccountType = newInvestment.accountType && !user.accountType
      const updatedUser = {
        ...user,
        investments: [...existing, newInvestment],
        ...(shouldSetAccountType ? { accountType: newInvestment.accountType } : {}),
        updatedAt: new Date().toISOString()
      }
      usersData.users[userIndex] = updatedUser

      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to save investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser, investment: newInvestment })
    }

    // Custom action: update existing investment fields by id
    if (body._action === 'updateInvestment' && body.investmentId && body.fields) {
      const usersData = await getUsers()
      const userIndex = usersData.users.findIndex(u => u.id === id)
      if (userIndex === -1) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
      const user = usersData.users[userIndex]
      if (user.isAdmin) {
        return NextResponse.json({ success: false, error: 'Admins cannot modify investments' }, { status: 403 })
      }
      const investments = Array.isArray(user.investments) ? user.investments : []
      const invIndex = investments.findIndex(inv => inv.id === body.investmentId)
      if (invIndex === -1) {
        return NextResponse.json({ success: false, error: 'Investment not found' }, { status: 404 })
      }

      // Account type enforcement - must match user's account type
      const userAccountType = user.accountType
      const incomingType = body.fields.accountType
      if (userAccountType && incomingType && incomingType !== userAccountType) {
        return NextResponse.json({ success: false, error: `Account type must be ${userAccountType} for this user.` }, { status: 400 })
      }

      const updatedInvestment = {
        ...investments[invIndex],
        ...body.fields,
        updatedAt: new Date().toISOString()
      }
      
      // On confirmation, set server-driven confirmation date and lockdown end date
      if (body.fields.status === 'confirmed') {
        // Always derive confirmation date from server app time (supports time machine)
        const appTime = await getCurrentAppTime()
        const confirmedDate = new Date(appTime)
        const lockupYears = updatedInvestment.lockupPeriod === '3-year' ? 3 : 1
        
        // Calculate lockdown end date if missing
        if (!updatedInvestment.lockdownEndDate) {
          const lockdownEndDate = new Date(confirmedDate)
          lockdownEndDate.setFullYear(lockdownEndDate.getFullYear() + lockupYears)
          updatedInvestment.lockdownEndDate = lockdownEndDate.toISOString()
        }
        
        // Override any client-provided confirmedAt with authoritative server/app time
        updatedInvestment.confirmedAt = confirmedDate.toISOString()

        // Audit metadata: who confirmed and how
        if (body.adminUserId) {
          updatedInvestment.confirmedByAdminId = body.adminUserId
          updatedInvestment.confirmationSource = 'admin'
        } else if (!updatedInvestment.confirmationSource) {
          updatedInvestment.confirmationSource = 'system'
        }
      }
      
      investments[invIndex] = updatedInvestment

      // Ensure user account type is set if this investment has one and user doesn't
      const shouldSetAccountType = updatedInvestment.accountType && !user.accountType
      const updatedUser = { ...user, investments, ...(shouldSetAccountType ? { accountType: updatedInvestment.accountType } : {}), updatedAt: new Date().toISOString() }
      usersData.users[userIndex] = updatedUser
      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to update investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser, investment: updatedInvestment })
    }


    // Fallback: Update user with whatever fields are provided
    const result = await updateUser(id, body)
    console.log('Update result:', result)

    if (result.success) {
      return NextResponse.json({ success: true, user: result.user })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error in PUT /api/users/[id]:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get specific user by ID
export async function GET(request, { params }) {
  try {
    const { id } = params
    const usersData = await getUsers()
    const user = usersData.users.find(user => user.id === id)
    
    if (user) {
      return NextResponse.json({ success: true, user })
    } else {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error in GET /api/users/[id]:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete specific user by ID
export async function DELETE(request, { params }) {
  try {
    const { id } = params
    const usersData = await getUsers()
    const idx = usersData.users.findIndex(u => u.id === id)
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
    }
    const user = usersData.users[idx]
    if (user.isAdmin) {
      return NextResponse.json({ success: false, error: 'Cannot delete admin account' }, { status: 403 })
    }
    usersData.users.splice(idx, 1)
    if (!await saveUsers(usersData)) {
      return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/users/[id]:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
