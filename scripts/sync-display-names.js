#!/usr/bin/env node

/**
 * Sync Display Names to Supabase Auth
 * 
 * Updates Supabase Auth user_metadata.full_name for all users
 * based on their first_name and last_name from the database.
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🔄 Syncing display names to Supabase Auth...\n')

async function syncDisplayNames() {
  try {
    const supabase = createServiceClient()

    // Get all database users with auth_id
    console.log('1️⃣ Fetching database users...')
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id, auth_id, email, first_name, last_name')
      .not('auth_id', 'is', null)
    
    if (dbError) {
      console.error('   ❌ Error fetching database users:', dbError.message)
      process.exit(1)
    }

    console.log(`   Found ${dbUsers.length} database users with auth_id\n`)

    // Update each auth user's display name
    console.log('2️⃣ Updating Supabase Auth display names...\n')

    let updated = 0
    let skipped = 0
    let failed = 0
    const failures = []

    for (const user of dbUsers) {
      const fullName = user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.first_name || user.last_name || user.email

      try {
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          user.auth_id,
          {
            user_metadata: {
              firstName: user.first_name,
              lastName: user.last_name,
              full_name: fullName
            }
          }
        )

        if (updateError) {
          console.error(`   ❌ Failed to update ${user.email}: ${updateError.message}`)
          failed++
          failures.push({ email: user.email, error: updateError.message })
        } else {
          console.log(`   ✅ Updated ${user.email} → "${fullName}"`)
          updated++
        }
      } catch (err) {
        console.error(`   ❌ Failed to update ${user.email}: ${err.message}`)
        failed++
        failures.push({ email: user.email, error: err.message })
      }
    }

    console.log()
    console.log('📊 Summary:')
    console.log(`   ✅ Successfully updated: ${updated}`)
    console.log(`   ⏭️  Skipped: ${skipped}`)
    if (failed > 0) {
      console.log(`   ❌ Failed: ${failed}`)
      console.log()
      console.log('Failures:')
      failures.forEach(f => {
        console.log(`   - ${f.email}: ${f.error}`)
      })
    }
    console.log()
    console.log('✨ Display name sync complete!\n')
    console.log('💡 New users will automatically have display names set.\n')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

syncDisplayNames()

