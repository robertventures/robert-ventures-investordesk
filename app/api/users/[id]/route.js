import { NextResponse } from 'next/server'
import { updateUser, getUsers, saveUsers } from '../../../../lib/database'

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

      const investmentId = Date.now().toString()
      const newInvestment = {
        id: investmentId,
        status: 'draft',
        ...body.investment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const existing = Array.isArray(user.investments) ? user.investments : []
      const updatedUser = {
        ...user,
        investments: [...existing, newInvestment],
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
      const updatedInvestment = {
        ...investments[invIndex],
        ...body.fields,
        updatedAt: new Date().toISOString()
      }
      investments[invIndex] = updatedInvestment
      const updatedUser = { ...user, investments, updatedAt: new Date().toISOString() }
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
