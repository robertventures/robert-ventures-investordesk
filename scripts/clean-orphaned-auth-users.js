#!/usr/bin/env node

/**
 * Clean Orphaned Auth Users
 * 
 * Deletes Supabase Auth users that don't have corresponding database records.
 * Use this to clean up auth users that were manually created or left over from failed imports.
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🧹 Cleaning orphaned auth users...\n')

async function cleanOrphanedAuthUsers() {
  try {
    const supabase = createServiceClient()

    // Get all database users
    console.log('1️⃣ Fetching database users...')
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('auth_id')
    
    if (dbError) {
      console.error('   ❌ Error fetching database users:', dbError.message)
      process.exit(1)
    }

    const dbAuthIds = new Set(dbUsers.map(u => u.auth_id).filter(Boolean))
    console.log(`   Found ${dbUsers.length} database users\n`)

    // Get all auth users
    console.log('2️⃣ Fetching auth users...')
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('   ❌ Error fetching auth users:', authError.message)
      process.exit(1)
    }

    console.log(`   Found ${authData.users.length} auth users\n`)

    // Find orphaned auth users
    const orphanedAuthUsers = authData.users.filter(u => !dbAuthIds.has(u.id))
    
    if (orphanedAuthUsers.length === 0) {
      console.log('✅ No orphaned auth users found. Nothing to clean up.\n')
      process.exit(0)
    }

    console.log(`3️⃣ Found ${orphanedAuthUsers.length} orphaned auth users:`)
    orphanedAuthUsers.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email} (${u.id})`)
    })
    console.log()

    // Confirm deletion
    console.log('⚠️  WARNING: This will DELETE these auth users permanently!')
    console.log('⚠️  They will no longer be able to log in.')
    console.log()
    
    // Since we're in a script, we'll just proceed
    // In a real scenario, you'd want to confirm with the user
    console.log('4️⃣ Deleting orphaned auth users...\n')

    let deleted = 0
    let failed = 0
    const failures = []

    for (const authUser of orphanedAuthUsers) {
      try {
        const { error } = await supabase.auth.admin.deleteUser(authUser.id)
        
        if (error) {
          console.error(`   ❌ Failed to delete ${authUser.email}: ${error.message}`)
          failed++
          failures.push({ email: authUser.email, error: error.message })
        } else {
          console.log(`   ✅ Deleted ${authUser.email}`)
          deleted++
        }
      } catch (err) {
        console.error(`   ❌ Failed to delete ${authUser.email}: ${err.message}`)
        failed++
        failures.push({ email: authUser.email, error: err.message })
      }
    }

    console.log()
    console.log('📊 Summary:')
    console.log(`   ✅ Successfully deleted: ${deleted}`)
    if (failed > 0) {
      console.log(`   ❌ Failed to delete: ${failed}`)
      console.log()
      console.log('Failures:')
      failures.forEach(f => {
        console.log(`   - ${f.email}: ${f.error}`)
      })
    }
    console.log()
    console.log('✨ Cleanup complete!\n')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

cleanOrphanedAuthUsers()

