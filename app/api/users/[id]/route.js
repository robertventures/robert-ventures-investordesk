import { NextResponse } from 'next/server'
import { updateUser, getUsers, saveUsers } from '../../../../lib/database'
import { getCurrentAppTime } from '../../../../lib/appTime'
import { generateGlobalInvestmentId, generateTransactionId } from '../../../../lib/idGenerator'
import { hashPassword, comparePassword, isPasswordHashed } from '../../../../lib/auth'

// PUT - Update user data
export async function PUT(request, { params }) {
  try {
    const { id } = params
    const body = await request.json()
    
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

      // Validate new password strength
      if (newPassword.length < 8) {
        return NextResponse.json({ success: false, error: 'Password must be at least 8 characters' }, { status: 400 })
      }

      // Verify current password using bcrypt
      let isCurrentPasswordValid = false

      if (!user.password) {
        return NextResponse.json({ success: false, error: 'No password set for this account' }, { status: 400 })
      }

      if (isPasswordHashed(user.password)) {
        // Password is hashed, use bcrypt compare
        isCurrentPasswordValid = await comparePassword(currentPassword, user.password)
      } else {
        // Legacy: Password is still plaintext, compare directly but we'll migrate it
        isCurrentPasswordValid = currentPassword === user.password
        console.warn('⚠️  Password migration: User', user.email, 'still has plaintext password')
      }

      if (!isCurrentPasswordValid) {
        return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 400 })
      }

      // Hash the new password before storing
      const hashedNewPassword = await hashPassword(newPassword)

      const updatedUser = {
        ...user,
        password: hashedNewPassword,
        updatedAt: new Date().toISOString()
      }
      usersData.users[userIndex] = updatedUser

      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to update password' }, { status: 500 })
      }

      // Don't return password in response
      const { password: _, ssn: __, ...safeUser } = updatedUser
      return NextResponse.json({ success: true, user: safeUser })
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

      // VALIDATION: Payment method must be valid
      const validPaymentMethods = ['ach', 'wire']
      if (body.investment.paymentMethod && !validPaymentMethods.includes(body.investment.paymentMethod)) {
        return NextResponse.json({ success: false, error: 'Payment method must be "ach" or "wire"' }, { status: 400 })
      }
      
      // Default to ACH if not specified
      if (!body.investment.paymentMethod) {
        body.investment.paymentMethod = 'ach'
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

      // VALIDATION: State machine for investment status transitions
      // Define valid transitions to prevent impossible status changes
      const validTransitions = {
        'draft': ['pending'],                    // Can only submit draft for approval
        'pending': ['active', 'rejected'],       // Can approve or reject pending investments
        'active': ['withdrawal_notice'],         // Can only request withdrawal from active
        'withdrawal_notice': ['withdrawn'],      // Can only complete withdrawal
        'rejected': [],                          // Terminal state - no transitions allowed
        'withdrawn': []                          // Terminal state - no transitions allowed
      }

      const currentStatus = currentInvestment.status
      const requestedStatus = body.fields.status

      if (requestedStatus && currentStatus !== requestedStatus) {
        const allowedStatuses = validTransitions[currentStatus] || []
        if (!allowedStatuses.includes(requestedStatus)) {
          return NextResponse.json({
            success: false,
            error: `Invalid status transition from '${currentStatus}' to '${requestedStatus}'. Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`
          }, { status: 400 })
        }
      }

      // VALIDATION: Investment amount must be positive (if being updated)
      // VALIDATION: Cannot change amount on active investments (breaks calculations)
      // This is critical for tax reporting and audit trail integrity
      if (typeof body.fields.amount === 'number') {
        const currentInvestment = investments[invIndex]
        if (currentInvestment.status === 'active' && currentInvestment.amount !== body.fields.amount) {
          return NextResponse.json({
            success: false,
            error: 'Cannot change investment amount on active investments. Amount is locked for tax reporting and audit compliance.'
          }, { status: 400 })
        }
      }

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

      // VALIDATION: If updating joint holder information in investment, validate required fields
      if (body.fields.jointHolder) {
        if (!body.fields.jointHolder.firstName?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder first name is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.lastName?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder last name is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.email || !/\S+@\S+\.\S+/.test(body.fields.jointHolder.email)) {
          return NextResponse.json({ success: false, error: 'Valid joint holder email is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.phone?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder phone is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.dob) {
          return NextResponse.json({ success: false, error: 'Joint holder date of birth is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.ssn?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder SSN is required' }, { status: 400 })
        }
        // Validate joint holder address fields
        if (!body.fields.jointHolder.address) {
          return NextResponse.json({ success: false, error: 'Joint holder address is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.address.street1?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder street address is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.address.city?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder city is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.address.state?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder state is required' }, { status: 400 })
        }
        if (!body.fields.jointHolder.address.zip?.trim()) {
          return NextResponse.json({ success: false, error: 'Joint holder zip code is required' }, { status: 400 })
        }
        if (body.fields.jointHolder.address.zip.length !== 5) {
          return NextResponse.json({ success: false, error: 'Joint holder zip code must be 5 digits' }, { status: 400 })
        }
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

      // AUTO-APPROVAL FOR ACH INVESTMENTS
      // When status changes to 'pending', automatically approve ACH investments
      if (body.fields.status === 'pending' && updatedInvestment.paymentMethod === 'ach') {
        // Automatically approve ACH investments - change status to active
        updatedInvestment.status = 'active'
        updatedInvestment.autoApproved = true
        updatedInvestment.autoApprovedReason = 'ACH payment method'
        
        // Set confirmation timestamp
        const appTime = await getCurrentAppTime()
        const confirmedDate = new Date(appTime)
        updatedInvestment.confirmedAt = confirmedDate.toISOString()
        updatedInvestment.confirmationSource = 'auto_ach'
        
        // Calculate lockup end date
        const lockupYears = updatedInvestment.lockupPeriod === '3-year' ? 3 : 1
        const lockupEndDate = new Date(confirmedDate)
        lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)
        updatedInvestment.lockupEndDate = lockupEndDate.toISOString()
      }
      // Wire investments remain pending for manual approval
      else if (body.fields.status === 'pending' && updatedInvestment.paymentMethod === 'wire') {
        // Keep as pending, add metadata
        updatedInvestment.requiresManualApproval = true
        updatedInvestment.manualApprovalReason = 'Wire transfer payment method'
      }
      
      // On confirmation, set server-driven confirmation date and lock up end date
      if (body.fields.status === 'active') {
        // Validate investment has all required fields before activation
        if (!updatedInvestment.amount || updatedInvestment.amount <= 0) {
          return NextResponse.json({
            success: false,
            error: 'Cannot activate investment: amount is required and must be greater than zero'
          }, { status: 400 })
        }
        if (!updatedInvestment.paymentFrequency) {
          return NextResponse.json({
            success: false,
            error: 'Cannot activate investment: paymentFrequency is required'
          }, { status: 400 })
        }
        if (!updatedInvestment.lockupPeriod) {
          return NextResponse.json({
            success: false,
            error: 'Cannot activate investment: lockupPeriod is required'
          }, { status: 400 })
        }
        if (!updatedInvestment.accountType) {
          return NextResponse.json({
            success: false,
            error: 'Cannot activate investment: accountType is required'
          }, { status: 400 })
        }

        // Always derive confirmation date from server app time (supports time machine)
        const appTime = await getCurrentAppTime()
        const confirmedDate = new Date(appTime)
        const lockupYears = updatedInvestment.lockupPeriod === '3-year' ? 3 : 1

        // Always recalculate lockup end date on confirmation to ensure consistency
        // This ensures lockupEndDate always matches confirmedAt + lockupPeriod
        const lockupEndDate = new Date(confirmedDate)
        lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)
        updatedInvestment.lockupEndDate = lockupEndDate.toISOString()

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
      
      // Unlock user account type if investment reaches a terminal state (rejected/withdrawn)
      // and there are no other pending/active/withdrawal_notice investments
      let shouldClearAccountType = false
      if (updatedInvestment.status === 'rejected' || updatedInvestment.status === 'withdrawn') {
        const hasPendingOrActiveInvestments = investments.some(inv =>
          inv.id !== updatedInvestment.id &&
          (inv.status === 'pending' || inv.status === 'active' || inv.status === 'withdrawal_notice')
        )
        shouldClearAccountType = !hasPendingOrActiveInvestments && user.accountType
      }

      // Also unlock account type if ALL investments are in terminal states (withdrawn/rejected)
      // This handles the case where all investments were withdrawn previously but account type wasn't unlocked
      if (!shouldClearAccountType && user.accountType) {
        const allInvestmentsTerminal = investments.every(inv =>
          inv.status === 'rejected' || inv.status === 'withdrawn'
        )
        shouldClearAccountType = allInvestmentsTerminal
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

      // Sync transactions immediately after investment status change
      // This ensures distributions, contributions, and activity events are generated
      if (body.fields.status === 'active' || body.fields.status === 'rejected' || body.fields.status === 'withdrawn') {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/migrate-transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (err) {
          console.error('Failed to sync transactions after investment update:', err)
          // Non-blocking: don't fail the request if transaction sync fails
        }
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

      // Check if there are any active withdrawal requests for this investment
      // This prevents orphaned withdrawals that reference deleted investments
      const withdrawals = Array.isArray(user.withdrawals) ? user.withdrawals : []
      const hasActiveWithdrawal = withdrawals.some(wd =>
        wd.investmentId === body.investmentId &&
        (wd.status === 'notice' || wd.status === 'pending')
      )

      if (hasActiveWithdrawal) {
        return NextResponse.json({
          success: false,
          error: 'Cannot delete investment with active withdrawal request. Please reject the withdrawal first or wait for it to be processed.'
        }, { status: 400 })
      }

      // Remove the investment
      investments.splice(invIndex, 1)

      // Clean up any activity events associated with this investment
      // This prevents orphaned events from appearing in the activity feed
      const activity = Array.isArray(user.activity) ? user.activity : []
      const cleanedActivity = activity.filter(event => event.investmentId !== body.investmentId)

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
        activity: cleanedActivity,
        ...accountTypeFields,
        updatedAt: new Date().toISOString()
      }
      usersData.users[userIndex] = updatedUser
      if (!await saveUsers(usersData)) {
        return NextResponse.json({ success: false, error: 'Failed to delete investment' }, { status: 500 })
      }
      return NextResponse.json({ success: true, user: updatedUser })
    }


    // VALIDATION: If updating joint holder information, validate required fields
    if (body.jointHolder) {
      // Validate joint holder required fields
      if (!body.jointHolder.firstName?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder first name is required' }, { status: 400 })
      }
      if (!body.jointHolder.lastName?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder last name is required' }, { status: 400 })
      }
      if (!body.jointHolder.email || !/\S+@\S+\.\S+/.test(body.jointHolder.email)) {
        return NextResponse.json({ success: false, error: 'Valid joint holder email is required' }, { status: 400 })
      }
      if (!body.jointHolder.phone?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder phone is required' }, { status: 400 })
      }
      if (!body.jointHolder.dob) {
        return NextResponse.json({ success: false, error: 'Joint holder date of birth is required' }, { status: 400 })
      }
      if (!body.jointHolder.ssn?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder SSN is required' }, { status: 400 })
      }
      // Validate joint holder address fields
      if (!body.jointHolder.address) {
        return NextResponse.json({ success: false, error: 'Joint holder address is required' }, { status: 400 })
      }
      if (!body.jointHolder.address.street1?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder street address is required' }, { status: 400 })
      }
      if (!body.jointHolder.address.city?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder city is required' }, { status: 400 })
      }
      if (!body.jointHolder.address.state?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder state is required' }, { status: 400 })
      }
      if (!body.jointHolder.address.zip?.trim()) {
        return NextResponse.json({ success: false, error: 'Joint holder zip code is required' }, { status: 400 })
      }
      if (body.jointHolder.address.zip.length !== 5) {
        return NextResponse.json({ success: false, error: 'Joint holder zip code must be 5 digits' }, { status: 400 })
      }
    }

    // VALIDATION: If setting accountType to joint, must also provide jointHoldingType
    if (body.accountType === 'joint' && !body.jointHoldingType && !body.jointHolder) {
      return NextResponse.json({ success: false, error: 'Joint holding type and joint holder information are required for joint accounts' }, { status: 400 })
    }

    // Fallback: Update user with whatever fields are provided
    const result = await updateUser(id, body)

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
