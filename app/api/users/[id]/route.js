import { NextResponse } from 'next/server'
import { updateUser, getUsers, saveUsers } from '../../../../lib/database'
import { getCurrentAppTime } from '../../../../lib/appTime'
import { generateGlobalInvestmentId, generateTransactionId } from '../../../../lib/idGenerator'

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

      // VALIDATION: User must be verified to create investments
      if (!user.isVerified) {
        return NextResponse.json({ success: false, error: 'Account must be verified before creating investments' }, { status: 403 })
      }

      // VALIDATION: Investment amount must be positive
      if (typeof body.investment.amount === 'number' && body.investment.amount <= 0) {
        return NextResponse.json({ success: false, error: 'Investment amount must be greater than zero' }, { status: 400 })
      }

      // VALIDATION: Investment amount minimum $1,000
      if (typeof body.investment.amount === 'number' && body.investment.amount < 1000) {
        return NextResponse.json({ success: false, error: 'Minimum investment amount is $1,000' }, { status: 400 })
      }

      // VALIDATION: Investment amount must be divisible by $10
      if (typeof body.investment.amount === 'number' && body.investment.amount % 10 !== 0) {
        return NextResponse.json({ success: false, error: 'Investment amount must be in $10 increments' }, { status: 400 })
      }

      // VALIDATION: Payment frequency must be valid
      const validFrequencies = ['compounding', 'monthly']
      if (body.investment.paymentFrequency && !validFrequencies.includes(body.investment.paymentFrequency)) {
        return NextResponse.json({ success: false, error: 'Payment frequency must be "compounding" or "monthly"' }, { status: 400 })
      }

      // VALIDATION: Lockup period must be valid
      const validLockups = ['1-year', '3-year']
      if (body.investment.lockupPeriod && !validLockups.includes(body.investment.lockupPeriod)) {
        return NextResponse.json({ success: false, error: 'Lockup period must be "1-year" or "3-year"' }, { status: 400 })
      }

      // VALIDATION: IRA accounts cannot use monthly payment frequency (Bug #2)
      if (body.investment.accountType === 'ira' && body.investment.paymentFrequency === 'monthly') {
        return NextResponse.json({ success: false, error: 'IRA accounts can only use compounding payment frequency' }, { status: 400 })
      }

      // Use user's account type for new investments
      const userAccountType = user.accountType
      if (userAccountType && body.investment.accountType && body.investment.accountType !== userAccountType) {
        return NextResponse.json({ success: false, error: `Account type must be ${userAccountType} for this user.` }, { status: 400 })
      }
      if (userAccountType && !body.investment.accountType) {
        body.investment.accountType = userAccountType
      }

      // Generate next sequential investment ID (global across all users)
      const investmentId = generateGlobalInvestmentId(usersData.users)
      const timestamp = new Date().toISOString()
      
      const newInvestment = {
        id: investmentId,
        status: 'draft',
        ...body.investment,
        createdAt: timestamp,
        updatedAt: timestamp
      }

      const existing = Array.isArray(user.investments) ? user.investments : []
      // Remove all existing drafts so only one draft exists at a time
      const filtered = existing.filter(inv => inv?.status !== 'draft')
      // Do NOT lock the user's account type on draft investments. Only lock later when investment becomes pending/confirmed.
      const updatedUser = {
        ...user,
        investments: [...filtered, newInvestment],
        updatedAt: new Date().toISOString()
      }
      usersData.users[userIndex] = updatedUser

      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to save investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser, investment: newInvestment })
    }

    // Custom action: verify user account
    if (body._action === 'verifyAccount' && body.verificationCode) {
      const usersData = await getUsers()
      const userIndex = usersData.users.findIndex(u => u.id === id)
      if (userIndex === -1) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }
      const user = usersData.users[userIndex]

      // For now, accept '000000' as valid code. Later can implement real email verification
      if (body.verificationCode !== '000000') {
        return NextResponse.json({ success: false, error: 'Invalid verification code' }, { status: 400 })
      }

      const updatedUser = {
        ...user,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      usersData.users[userIndex] = updatedUser

      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to verify account' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser })
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

      const currentInvestment = investments[invIndex]

      // VALIDATION: Cannot reject an active investment
      if (body.fields.status === 'rejected' && currentInvestment.status === 'active') {
        return NextResponse.json({ success: false, error: 'Cannot reject an active investment' }, { status: 400 })
      }

      // VALIDATION: Investment amount must be positive (if being updated)
      if (typeof body.fields.amount === 'number' && body.fields.amount <= 0) {
        return NextResponse.json({ success: false, error: 'Investment amount must be greater than zero' }, { status: 400 })
      }

      // VALIDATION: Investment amount minimum $1,000 (if being updated)
      if (typeof body.fields.amount === 'number' && body.fields.amount < 1000) {
        return NextResponse.json({ success: false, error: 'Minimum investment amount is $1,000' }, { status: 400 })
      }

      // VALIDATION: Investment amount must be divisible by $10 (if being updated)
      if (typeof body.fields.amount === 'number' && body.fields.amount % 10 !== 0) {
        return NextResponse.json({ success: false, error: 'Investment amount must be in $10 increments' }, { status: 400 })
      }

      // VALIDATION: Payment frequency must be valid (if being updated)
      const validFrequencies = ['compounding', 'monthly']
      if (body.fields.paymentFrequency && !validFrequencies.includes(body.fields.paymentFrequency)) {
        return NextResponse.json({ success: false, error: 'Payment frequency must be "compounding" or "monthly"' }, { status: 400 })
      }

      // VALIDATION: Lockup period must be valid (if being updated)
      const validLockups = ['1-year', '3-year']
      if (body.fields.lockupPeriod && !validLockups.includes(body.fields.lockupPeriod)) {
        return NextResponse.json({ success: false, error: 'Lockup period must be "1-year" or "3-year"' }, { status: 400 })
      }

      // Account type enforcement - must match user's account type
      const userAccountType = user.accountType
      const incomingType = body.fields.accountType
      if (userAccountType && incomingType && incomingType !== userAccountType) {
        return NextResponse.json({ success: false, error: `Account type must be ${userAccountType} for this user.` }, { status: 400 })
      }

      let updatedInvestment = {
        ...investments[invIndex],
        ...body.fields,
        updatedAt: new Date().toISOString()
      }

      // VALIDATION: IRA accounts cannot use monthly payment frequency (Bug #2)
      // Check the merged investment after applying fields
      if (updatedInvestment.accountType === 'ira' && updatedInvestment.paymentFrequency === 'monthly') {
        return NextResponse.json({ success: false, error: 'IRA accounts can only use compounding payment frequency' }, { status: 400 })
      }
      
      // On confirmation, set server-driven confirmation date and lock up end date
      if (body.fields.status === 'active') {
        // Always derive confirmation date from server app time (supports time machine)
        const appTime = await getCurrentAppTime()
        const confirmedDate = new Date(appTime)
        const lockupYears = updatedInvestment.lockupPeriod === '3-year' ? 3 : 1
        
        // Calculate lock up end date if missing
        if (!updatedInvestment.lockupEndDate) {
          const lockupEndDate = new Date(confirmedDate)
          lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)
          updatedInvestment.lockupEndDate = lockupEndDate.toISOString()
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
      // On rejection, stamp server time and audit metadata
      else if (body.fields.status === 'rejected') {
        const appTime = await getCurrentAppTime()
        const rejectedDate = new Date(appTime)
        updatedInvestment.rejectedAt = rejectedDate.toISOString()
        if (body.adminUserId) {
          updatedInvestment.rejectedByAdminId = body.adminUserId
          updatedInvestment.rejectionSource = 'admin'
        } else if (!updatedInvestment.rejectionSource) {
          updatedInvestment.rejectionSource = 'system'
        }

        // Create activity event for investment rejection
        if (!Array.isArray(user.activity)) {
          user.activity = []
        }
        const rejectionEventId = generateTransactionId('INV', updatedInvestment.id, 'investment_rejected')
        const existingRejectionEvent = user.activity.find(ev => ev.id === rejectionEventId)
        if (!existingRejectionEvent) {
          user.activity.push({
            id: rejectionEventId,
            type: 'investment_rejected',
            investmentId: updatedInvestment.id,
            amount: updatedInvestment.amount,
            lockupPeriod: updatedInvestment.lockupPeriod,
            paymentFrequency: updatedInvestment.paymentFrequency,
            date: updatedInvestment.rejectedAt
          })
        }
      }
      
      investments[invIndex] = updatedInvestment

      // If investment transitions out of draft (pending/confirmed), remove ALL remaining drafts
      const transitionedOutOfDraft = investments[invIndex].status === 'pending' || investments[invIndex].status === 'active'
      if (transitionedOutOfDraft) {
        for (let i = investments.length - 1; i >= 0; i--) {
          const inv = investments[i]
          if (!inv) continue
          if (inv.status === 'draft') {
            investments.splice(i, 1)
          }
        }
        // Ensure variable still references the updated instance after potential splice operations
        const idx = investments.findIndex(inv => inv.id === updatedInvestment.id)
        if (idx !== -1) updatedInvestment = investments[idx]
      }

      // Lock user account type only when investment transitions to pending or confirmed
      const isLockingStatus = updatedInvestment.status === 'pending' || updatedInvestment.status === 'active'
      const shouldSetAccountType = isLockingStatus && updatedInvestment.accountType && !user.accountType
      
      // Unlock user account type if investment was rejected and there are no pending/active investments
      let shouldClearAccountType = false
      if (updatedInvestment.status === 'rejected') {
        const hasPendingOrActiveInvestments = investments.some(inv => 
          inv.id !== updatedInvestment.id && (inv.status === 'pending' || inv.status === 'active')
        )
        shouldClearAccountType = !hasPendingOrActiveInvestments && user.accountType
      }
      
      // When unlocking account, also clear account-type-specific fields to avoid stale data
      const accountTypeFields = shouldClearAccountType ? {
        accountType: null,
        jointHolder: null,
        jointHoldingType: null,
        entity: null
      } : {}
      
      const updatedUser = { 
        ...user, 
        investments, 
        ...(shouldSetAccountType ? { accountType: updatedInvestment.accountType } : {}),
        ...accountTypeFields,
        updatedAt: new Date().toISOString() 
      }
      usersData.users[userIndex] = updatedUser
      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to update investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser, investment: updatedInvestment })
    }

    // Custom action: delete draft investment by id
    if (body._action === 'deleteInvestment' && body.investmentId) {
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
      const inv = investments[invIndex]
      if (inv.status !== 'draft') {
        return NextResponse.json({ success: false, error: 'Only draft investments can be deleted' }, { status: 400 })
      }

      // Remove the investment
      investments.splice(invIndex, 1)
      
      // Unlock user account type if there are no pending/active investments remaining after deletion
      let shouldClearAccountType = false
      if (user.accountType) {
        const hasPendingOrActiveInvestments = investments.some(inv => 
          inv.status === 'pending' || inv.status === 'active'
        )
        shouldClearAccountType = !hasPendingOrActiveInvestments
      }
      
      // When unlocking account, also clear account-type-specific fields to avoid stale data
      const accountTypeFields = shouldClearAccountType ? {
        accountType: null,
        jointHolder: null,
        jointHoldingType: null,
        entity: null
      } : {}
      
      const updatedUser = { 
        ...user, 
        investments, 
        ...accountTypeFields,
        updatedAt: new Date().toISOString() 
      }
      usersData.users[userIndex] = updatedUser
      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to delete investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser })
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
      // Include app time for calculations (Time Machine support)
      return NextResponse.json({ 
        success: true, 
        user,
        appTime: usersData.appTime || null
      })
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
