import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../../lib/database'
import { generateUserId, generateTransactionId } from '../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'

/**
 * Import investors from CSV/Wealthblock migration
 * POST /api/admin/import-investors
 */
export async function POST(request) {
  try {
    // Verify admin authentication
    const admin = await requireAdmin(request)
    if (!admin) {
      return authErrorResponse('Admin access required', 403)
    }

    const body = await request.json()
    const { investors } = body

    const usersData = await getUsers()

    if (!investors || investors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No investor data provided' },
        { status: 400 }
      )
    }

    const results = {
      total: investors.length,
      imported: 0,
      skipped: 0,
      errors: [],
      importedUserIds: []
    }

    // Process each investor
    for (const investorData of investors) {
      try {
        // Validate required fields
        if (!investorData.email) {
          results.errors.push({
            email: 'unknown',
            error: 'Email is required'
          })
          results.skipped++
          continue
        }

        const normalizedEmail = investorData.email.toLowerCase().trim()

        // Check for duplicate
        const existingUser = usersData.users.find(
          u => u.email.toLowerCase().trim() === normalizedEmail
        )
        
        if (existingUser) {
          results.errors.push({
            email: normalizedEmail,
            error: 'User already exists'
          })
          results.skipped++
          continue
        }

        // Generate user ID
        const userId = await generateUserId()
        const timestamp = investorData.createdAt || new Date().toISOString()

        // Build user object
        const newUser = {
          id: userId,
          email: normalizedEmail,
          firstName: investorData.firstName || '',
          lastName: investorData.lastName || '',
          phoneNumber: investorData.phoneNumber || '',
          dob: investorData.dob || '',
          ssn: '', // SSN will be requested during onboarding for security
          password: '', // Will be set when user accepts invite
          address: investorData.address || null,
          accountType: investorData.accountType || 'individual',
          verificationCode: '',
          isVerified: investorData.isVerified !== undefined ? investorData.isVerified : true,
          verifiedAt: investorData.verifiedAt || timestamp,
          isAdmin: false,
          needsOnboarding: true, // Flag for onboarding flow
          onboardingCompleted: false,
          investments: [],
          bankAccounts: [], // Bank accounts will be linked during onboarding
          createdAt: timestamp,
          updatedAt: timestamp,
          activity: []
        }

        // Add account-type-specific fields
        if (investorData.accountType === 'joint' && investorData.jointHolder) {
          newUser.jointHolder = investorData.jointHolder
          newUser.jointHoldingType = investorData.jointHoldingType || 'joint-tenants'
        } else if (investorData.accountType === 'entity' && investorData.entity) {
          newUser.entity = investorData.entity
          newUser.authorizedRepresentative = investorData.authorizedRepresentative
          newUser.taxInfo.tinType = 'EIN'
        } else if (investorData.accountType === 'ira' && investorData.ira) {
          newUser.ira = investorData.ira
        }

        // Add tax compliance fields if provided
        if (investorData.taxInfo) {
          newUser.taxInfo = {
            ...newUser.taxInfo,
            ...investorData.taxInfo
          }
        }

        // Add account creation activity
        newUser.activity.push({
          id: generateTransactionId('USR', userId, 'account_created'),
          type: 'account_created',
          date: timestamp
        })

        // Process investments if provided
        if (investorData.investments && Array.isArray(investorData.investments)) {
          for (const investmentData of investorData.investments) {
            const investment = processInvestmentImport(investmentData, userId, newUser)
            if (investment) {
              newUser.investments.push(investment.investment)
              newUser.activity.push(...investment.activities)
            }
          }
        }

        // Process distributions if provided (standalone transactions not tied to investments)
        if (investorData.distributions && Array.isArray(investorData.distributions)) {
          for (const dist of investorData.distributions) {
            newUser.activity.push({
              id: dist.id || generateTransactionId('TX', userId, 'distribution'),
              type: 'distribution',
              amount: parseFloat(dist.amount) || 0,
              date: dist.date || new Date().toISOString(),
              description: dist.description || '',
              status: 'completed'
            })
          }
        }

        // Process contributions if provided (standalone transactions not tied to investments)
        if (investorData.contributions && Array.isArray(investorData.contributions)) {
          for (const cont of investorData.contributions) {
            newUser.activity.push({
              id: cont.id || generateTransactionId('TX', userId, 'contribution'),
              type: 'contribution',
              amount: parseFloat(cont.amount) || 0,
              date: cont.date || new Date().toISOString(),
              description: cont.description || ''
            })
          }
        }

        // Add user to database
        usersData.users.push(newUser)
        results.imported++
        results.importedUserIds.push(userId)

      } catch (error) {
        console.error('Error importing investor:', error)
        results.errors.push({
          email: investorData.email || 'unknown',
          error: error.message
        })
        results.skipped++
      }
    }

    // Save updated users data
    const saved = await saveUsers(usersData)
    if (!saved) {
      return NextResponse.json(
        { success: false, error: 'Failed to save imported data' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('Error importing investors:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * Process investment data for import
 */
function processInvestmentImport(investmentData, userId, user) {
  try {
    const investmentId = investmentData.id || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const amount = parseFloat(investmentData.amount) || 0
    const bonds = investmentData.bonds || Math.floor(amount / 10)
    
    const investmentDate = investmentData.investmentDate || investmentData.confirmedAt || new Date().toISOString()
    const submittedAt = investmentData.submittedAt || investmentDate
    const confirmedAt = investmentData.confirmedAt || investmentDate

    // Calculate lockup end date
    const lockupPeriod = investmentData.lockupPeriod || '1-year'
    const lockupYears = lockupPeriod === '3-year' ? 3 : 1
    const lockupEndDate = new Date(confirmedAt)
    lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)

    const investment = {
      id: investmentId,
      amount,
      bonds,
      paymentFrequency: investmentData.paymentFrequency || 'compounding',
      lockupPeriod,
      accountType: investmentData.accountType || user.accountType,
      status: investmentData.status || 'active',
      investmentDate,
      submittedAt,
      confirmedAt,
      lockupEndDate: lockupEndDate.toISOString(),
      earningsMethod: investmentData.earningsMethod || 
        (investmentData.paymentFrequency === 'monthly' ? 'bank-account' : 'compounding'),
      bankApproved: investmentData.bankApproved !== undefined ? investmentData.bankApproved : true,
      bankApprovedBy: investmentData.bankApprovedBy || 'import',
      bankApprovedAt: investmentData.bankApprovedAt || confirmedAt,
      adminApproved: investmentData.adminApproved !== undefined ? investmentData.adminApproved : true,
      adminApprovedBy: investmentData.adminApprovedBy || 'import',
      adminApprovedAt: investmentData.adminApprovedAt || confirmedAt,
      createdAt: submittedAt,
      updatedAt: confirmedAt,
      transactions: investmentData.transactions || []
    }

    // Add payout details for monthly accounts
    if (investment.paymentFrequency === 'monthly' && investmentData.payoutDetails) {
      investment.payoutDetails = investmentData.payoutDetails
    }

    // Create activity events
    const activities = []

    // Investment created
    activities.push({
      id: generateTransactionId('INV', investmentId, 'created'),
      type: 'investment_created',
      investmentId,
      date: submittedAt
    })

    // Investment approved
    activities.push({
      id: generateTransactionId('INV', investmentId, 'approved'),
      type: 'investment_approved',
      investmentId,
      date: investmentData.adminApprovedAt || confirmedAt
    })

    // Investment confirmed
    activities.push({
      id: generateTransactionId('INV', investmentId, 'confirmed'),
      type: 'investment_confirmed',
      investmentId,
      amount,
      date: confirmedAt
    })

    // Add historical transactions from investment.transactions array
    if (investmentData.transactions && Array.isArray(investmentData.transactions)) {
      for (const tx of investmentData.transactions) {
        if (tx.type === 'distribution' || tx.type === 'interest_payment') {
          activities.push({
            id: tx.id || generateTransactionId('TX', investmentId, 'distribution'),
            type: 'distribution',
            investmentId,
            amount: tx.amount || 0,
            date: tx.date || new Date().toISOString(),
            status: tx.status || 'completed'
          })
        } else if (tx.type === 'contribution' || tx.type === 'additional_investment') {
          activities.push({
            id: tx.id || generateTransactionId('TX', investmentId, 'contribution'),
            type: 'contribution',
            investmentId,
            amount: tx.amount || 0,
            date: tx.date || new Date().toISOString()
          })
        }
      }
    }

    return {
      investment,
      activities
    }

  } catch (error) {
    console.error('Error processing investment import:', error)
    return null
  }
}

