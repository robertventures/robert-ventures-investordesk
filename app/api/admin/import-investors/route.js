import { NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseClient.js'
import { signUp } from '../../../../lib/supabaseAuth.js'
import { generateUserId, generateTransactionId } from '../../../../lib/idGenerator'
import { requireAdmin, authErrorResponse } from '../../../../lib/authMiddleware'
import { getCurrentAppTime } from '../../../../lib/appTime.js'

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

        // 2. Create database user record
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: userId,
            auth_id: authUserId,
            email: normalizedEmail,
            first_name: investorData.firstName || '',
            last_name: investorData.lastName || '',
            phone_number: investorData.phoneNumber || '',
            dob: investorData.dob || '',
            ssn: '', // Will be filled during onboarding
            is_verified: false, // Needs email verification
            verified_at: null,
            is_admin: false,
            address: investorData.address || null,
            account_type: investorData.accountType || 'individual',
            created_at: timestamp,
            updated_at: timestamp
          })

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

        // 3. Create account_created activity
        await supabase
          .from('activity')
          .insert({
            id: generateTransactionId('USR', userId, 'account_created'),
            user_id: userId,
            type: 'account_created',
            date: timestamp
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

    // 5. Auto-trigger transaction regeneration
    // NOTE: The migrate-transactions endpoint currently uses the legacy file-based approach
    // and needs to be refactored to work with Supabase. For now, we'll skip auto-triggering
    // and let admins manually trigger regeneration via the Operations tab.
    if (results.imported > 0) {
      console.log(`✅ Successfully imported ${results.imported} users`)
      console.log('⚠️  Please manually click "Regenerate Transactions" in the Operations tab to calculate distributions')
      results.transactionsRegenerated = false
      results.message = 'Import successful! Please click "Regenerate Transactions" in Operations tab to calculate distributions.'
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

    // Generate investment ID
    const investmentId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Use provided dates or fallback to app time
    const timestamp = appTime || new Date().toISOString()
    const createdDate = investmentData.createdDate || timestamp
    const confirmedDate = investmentData.confirmedDate || investmentData.createdDate || timestamp
    
    // Calculate lockup end date
    const lockupPeriod = investmentData.lockupPeriod || '1-year'
    const lockupYears = lockupPeriod === '3-year' ? 3 : 1
    const lockupEndDate = new Date(confirmedDate)
    lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)

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
        lockup_end_date: lockupEndDate.toISOString(),
        created_at: createdDate,
        updated_at: confirmedDate
      })

    if (investmentError) {
      return { success: false, error: investmentError.message }
    }

    // Create activity records
    const activities = [
      {
        id: generateTransactionId('INV', investmentId, 'created'),
        user_id: userId,
        type: 'investment_created',
        investment_id: investmentId,
        date: createdDate
      },
      {
        id: generateTransactionId('INV', investmentId, 'confirmed'),
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
