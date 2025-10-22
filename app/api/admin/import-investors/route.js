import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { signUp } from '../../../../lib/supabaseAuth.js'
import { generateUserId, generateTransactionId, generateSequentialInvestmentId, validateInvestmentId } from '../../../../lib/idGenerator.js'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware.js'
import { getCurrentAppTime } from '../../../../lib/appTime.js'
import { dateOnlyToISO, addYears } from '../../../../lib/dateUtils.js'

/**
 * Import investors from Wealthblock CSV migration
 * POST /api/admin/import-investors
 * 
 * Creates:
 * - Supabase Auth users (with default password)
 * - Database user records (marked for onboarding)
 * - Investment records with historical dates
 * - Activity records for key events
 * - Auto-triggers transaction regeneration for distributions
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

    if (!investors || investors.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No investor data provided' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const results = {
      total: investors.length,
      imported: 0,
      skipped: 0,
      errors: [],
      importedUserIds: []
    }

    // Default password for imported users
    const DEFAULT_PASSWORD = 'Test1234!'

    // Process each investor
    for (const investorData of investors) {
      let authUserId = null
      
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

        // Check for duplicate user in database
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', normalizedEmail)
          .maybeSingle()
        
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
        
        // Get app time for consistent timestamps
        const appTime = await getCurrentAppTime()
        const timestamp = appTime || new Date().toISOString()

        // 1. Create Supabase Auth user
        const authResult = await signUp(normalizedEmail, DEFAULT_PASSWORD, {
          firstName: investorData.firstName || '',
          lastName: investorData.lastName || ''
        })

        if (!authResult.success) {
          results.errors.push({
            email: normalizedEmail,
            error: `Auth creation failed: ${authResult.error}`
          })
          results.skipped++
          continue
        }

        authUserId = authResult.user.id

        // Check if investor has any monthly payout investments (needs bank info)
        const hasMonthlyPayments = investorData.investments && 
          Array.isArray(investorData.investments) &&
          investorData.investments.some(inv => inv.paymentFrequency === 'monthly')
        
        // Determine if onboarding is needed:
        // - No SSN provided → needs onboarding
        // - Has monthly payment investments → needs onboarding (for bank info)
        // - Otherwise → no onboarding needed (compounding investments don't need bank info)
        const needsOnboarding = !investorData.ssn || hasMonthlyPayments

        // 2. Create database user record
        const userRecord = {
          id: userId,
          auth_id: authUserId,
          email: normalizedEmail,
          first_name: investorData.firstName || '',
          last_name: investorData.lastName || '',
          phone_number: investorData.phoneNumber || '',
          dob: investorData.dob || '',
          ssn: investorData.ssn || '', // SSN from import form (will be encrypted by database)
          is_verified: true, // Auto-verify imported accounts (admin-created)
          verified_at: timestamp, // Set verification timestamp
          is_admin: false,
          account_type: investorData.accountType || 'individual',
          needs_onboarding: needsOnboarding,
          created_at: timestamp,
          updated_at: timestamp
        }

        // Add account-type-specific fields
        if (investorData.accountType === 'joint') {
          userRecord.joint_holding_type = investorData.jointHoldingType || null
          userRecord.joint_holder = investorData.jointHolder || null
        } else if (investorData.accountType === 'entity') {
          userRecord.entity_name = investorData.entity?.name || ''
          userRecord.entity_type = investorData.entity?.entityType || 'LLC'
          userRecord.tax_id = investorData.entity?.taxId || ''
          userRecord.entity_registration_date = investorData.entity?.registrationDate || null
          userRecord.entity_address = investorData.entity?.address || null
          userRecord.authorized_representative = investorData.authorizedRepresentative || null
        } else if (investorData.accountType === 'ira') {
          userRecord.ira_type = investorData.ira?.accountType || 'traditional'
          userRecord.ira_custodian = investorData.ira?.custodian || ''
          userRecord.ira_account_number = investorData.ira?.accountNumber || ''
        }

        const { error: userError } = await supabase
          .from('users')
          .insert(userRecord)

        if (userError) {
          // Rollback: Delete auth user
          await supabase.auth.admin.deleteUser(authUserId)
          
          results.errors.push({
            email: normalizedEmail,
            error: `Database insert failed: ${userError.message}`
          })
          results.skipped++
          continue
        }

        // 2.5. Create primary address in addresses table if provided
        if (investorData.address && (
          investorData.address.street1 || 
          investorData.address.city || 
          investorData.address.state || 
          investorData.address.zip
        )) {
          const { error: addressError } = await supabase
            .from('addresses')
            .insert({
              id: `addr-${userId}-${Date.now()}`,
              user_id: userId,
              street1: investorData.address.street1 || '',
              street2: investorData.address.street2 || '',
              city: investorData.address.city || '',
              state: investorData.address.state || '',
              zip: investorData.address.zip || '',
              country: investorData.address.country || 'United States',
              label: 'Home',
              is_primary: true,
              created_at: timestamp,
              updated_at: timestamp
            })

          if (addressError) {
            console.error(`Failed to create address for ${normalizedEmail}:`, addressError)
            // Don't fail the whole import for address errors
          }
        }

        // 3. Create account_created activity
        // Use provided accountCreatedDate if available (for Wealthblock imports),
        // otherwise use current timestamp
        const accountCreatedDate = investorData.accountCreatedDate
          ? dateOnlyToISO(investorData.accountCreatedDate)
          : timestamp
        
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('USR', userId, 'account_created'),
            user_id: userId,
            type: 'account_created',
            date: accountCreatedDate
          })

        // 4. Process investments if provided
        if (investorData.investments && Array.isArray(investorData.investments)) {
          for (const investmentData of investorData.investments) {
            try {
              const investmentResult = await createInvestment(
                supabase,
                userId,
                investmentData,
                appTime
              )
              
              if (!investmentResult.success) {
                console.error(`Failed to create investment for ${normalizedEmail}:`, investmentResult.error)
              }
            } catch (invError) {
              console.error(`Error creating investment for ${normalizedEmail}:`, invError)
            }
          }
        }

        // Success!
        results.imported++
        results.importedUserIds.push(userId)

      } catch (error) {
        console.error('Error importing investor:', error)
        
        // Cleanup: Delete auth user if created
        if (authUserId) {
          try {
            await supabase.auth.admin.deleteUser(authUserId)
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError)
          }
        }
        
        results.errors.push({
          email: investorData.email || 'unknown',
          error: error.message
        })
        results.skipped++
      }
    }

    // 5. Auto-trigger transaction regeneration to calculate distributions
    if (results.imported > 0) {
      console.log(`✅ Successfully imported ${results.imported} users`)
      console.log('🔄 Triggering transaction regeneration to calculate distributions...')
      
      try {
        // Import and call the migrate-transactions POST handler directly
        const { POST: migrateTransactionsHandler } = await import('../../migrate-transactions/route.js')
        
        // Create a mock request with the same headers for auth
        const migrateRequest = new Request(new URL('/api/migrate-transactions', request.url), {
          method: 'POST',
          headers: request.headers
        })
        
        const migrateResponse = await migrateTransactionsHandler(migrateRequest)
        const migrateData = await migrateResponse.json()
        
        if (migrateData.success) {
          results.transactionsRegenerated = true
          results.eventsCreated = migrateData.eventsCreated || 0
          results.activityEventsInserted = migrateData.activityEventsInserted || 0
          results.transactionsUpserted = migrateData.transactionsUpserted || 0
          results.message = `Import successful! Generated ${results.imported} user(s), ${results.transactionsUpserted} transactions, and ${results.activityEventsInserted} activity events. All historical distributions have been calculated.`
          console.log(`✅ Successfully regenerated transactions: ${results.transactionsUpserted} transactions, ${results.activityEventsInserted} activity events`)
        } else {
          throw new Error(migrateData.error || 'Unknown error from migrate-transactions')
        }
        
      } catch (migrateError) {
        console.error('⚠️  Failed to trigger transaction regeneration:', migrateError)
        results.transactionsRegenerated = false
        results.message = `Import successful! However, failed to auto-generate transactions: ${migrateError.message}. Please manually click "Regenerate Transactions" in Operations tab.`
      }
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
 * Create investment record with activity events
 */
async function createInvestment(supabase, userId, investmentData, appTime) {
  try {
    const amount = parseFloat(investmentData.amount) || 0
    if (amount === 0) {
      return { success: false, error: 'Invalid investment amount' }
    }

    // Generate sequential investment ID from database
    const investmentId = await generateSequentialInvestmentId()
    
    // Validate the generated ID
    if (!validateInvestmentId(investmentId)) {
      console.error(`Generated invalid investment ID: ${investmentId}`)
      return { success: false, error: 'Failed to generate valid investment ID' }
    }
    
    // Use provided dates or fallback to app time
    // IMPORTANT: Use dateOnlyToISO to prevent timezone shifting
    // If user enters "2024-11-20", we store "2024-11-20T00:00:00.000Z" (not shifted by timezone)
    const timestamp = appTime || new Date().toISOString()
    
    console.log(`📅 Processing investment dates for user ${userId}:`)
    console.log(`   Raw createdDate: ${investmentData.createdDate}`)
    console.log(`   Raw confirmedDate: ${investmentData.confirmedDate}`)
    console.log(`   Fallback timestamp: ${timestamp}`)
    
    const createdDate = investmentData.createdDate 
      ? dateOnlyToISO(investmentData.createdDate) 
      : timestamp
    const confirmedDate = investmentData.confirmedDate 
      ? dateOnlyToISO(investmentData.confirmedDate)
      : (investmentData.createdDate ? dateOnlyToISO(investmentData.createdDate) : timestamp)
    
    console.log(`   Converted createdDate (submitted_at): ${createdDate}`)
    console.log(`   Converted confirmedDate (confirmed_at): ${confirmedDate}`)
    
    // Calculate lockup end date
    // IMPORTANT: Use addYears to prevent timezone shifting
    const lockupPeriod = investmentData.lockupPeriod || '1-year'
    const lockupYears = lockupPeriod === '3-year' ? 3 : 1
    const lockupEndDate = addYears(confirmedDate, lockupYears)

    // Calculate bonds (amount / 10)
    const bonds = Math.floor(amount / 10)

    // Create investment record
    const { error: investmentError } = await supabase
      .from('investments')
      .insert({
        id: investmentId,
        user_id: userId,
        amount: amount,
        bonds: bonds,
        payment_frequency: investmentData.paymentFrequency || 'compounding',
        lockup_period: lockupPeriod,
        account_type: investmentData.accountType || 'individual',
        status: investmentData.status || 'active',
        submitted_at: createdDate,
        confirmed_at: confirmedDate,
        lockup_end_date: lockupEndDate,
        created_at: createdDate,
        updated_at: confirmedDate
      })

    if (investmentError) {
      return { success: false, error: investmentError.message }
    }

    // Create activity records
    const activities = [
      {
        id: generateTransactionId('INV', investmentId, 'investment_created'),
        user_id: userId,
        type: 'investment_created',
        investment_id: investmentId,
        date: createdDate
      },
      {
        id: generateTransactionId('INV', investmentId, 'investment_confirmed'),
        user_id: userId,
        type: 'investment_confirmed',
        investment_id: investmentId,
        amount: amount,
        date: confirmedDate
      }
    ]

    const { error: activityError } = await supabase
      .from('activity')
      .insert(activities)

    if (activityError) {
      console.error('Failed to create activity records:', activityError)
      // Don't fail the whole import for activity errors
    }

    return { success: true, investmentId }

  } catch (error) {
    return { success: false, error: error.message }
  }
}
