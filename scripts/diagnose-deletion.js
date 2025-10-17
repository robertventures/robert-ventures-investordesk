#!/usr/bin/env node

/**
 * Diagnose User Deletion Issues
 * 
 * Checks why user deletion might not be working correctly
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🔍 Diagnosing user deletion issues...\n')

async function diagnose() {
  try {
    // Check 1: Service role key
    console.log('1️⃣ Checking service role key...')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('   ❌ SUPABASE_SERVICE_ROLE_KEY not set!')
      console.error('   This is required to delete auth users.')
      console.error('   Get it from: Supabase Dashboard → Settings → API → service_role')
      process.exit(1)
    }
    console.log('   ✅ Service role key is set\n')

    const supabase = createServiceClient()

    // Check 2: Database users
    console.log('2️⃣ Checking database users...')
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('id, email, auth_id, is_admin')
      .order('created_at', { ascending: false })

    if (dbError) {
      console.error('   ❌ Error querying database:', dbError.message)
      process.exit(1)
    }

    const nonAdminUsers = dbUsers.filter(u => !u.is_admin)
    console.log(`   Found ${dbUsers.length} total users`)
    console.log(`   Found ${nonAdminUsers.length} non-admin users`)
    console.log(`   Found ${dbUsers.filter(u => u.is_admin).length} admin users\n`)

    // Check 3: Auth users
    console.log('3️⃣ Checking Supabase Auth users...')
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
      
      if (authError) {
        console.error('   ❌ Error listing auth users:', authError.message)
        console.error('   This usually means the service role key is invalid.')
        process.exit(1)
      }

      console.log(`   Found ${authData.users.length} auth users\n`)

      // Check 4: Find mismatches
      console.log('4️⃣ Checking for sync issues...')
      
      // Database users without auth_id
      const usersWithoutAuthId = nonAdminUsers.filter(u => !u.auth_id)
      if (usersWithoutAuthId.length > 0) {
        console.log(`   ⚠️  ${usersWithoutAuthId.length} database users without auth_id:`)
        usersWithoutAuthId.forEach(u => {
          console.log(`      - ${u.email} (${u.id})`)
        })
        console.log()
      }

      // Auth users without database record
      const authUserIds = new Set(authData.users.map(u => u.id))
      const dbAuthIds = new Set(dbUsers.map(u => u.auth_id).filter(Boolean))
      
      const orphanedAuthUsers = authData.users.filter(u => !dbAuthIds.has(u.id))
      if (orphanedAuthUsers.length > 0) {
        console.log(`   ⚠️  ${orphanedAuthUsers.length} auth users without database record:`)
        orphanedAuthUsers.forEach(u => {
          console.log(`      - ${u.email} (${u.id})`)
        })
        console.log()
      }

      // Check 5: Test deletion capability
      console.log('5️⃣ Testing auth deletion capability...')
      
      if (typeof supabase.auth.admin.deleteUser !== 'function') {
        console.error('   ❌ auth.admin.deleteUser method not available')
        console.error('   Service role key may be invalid')
        process.exit(1)
      }
      
      console.log('   ✅ Auth admin methods available\n')

      // Summary
      console.log('📊 Summary:')
      console.log(`   - Database users: ${dbUsers.length}`)
      console.log(`   - Database non-admin: ${nonAdminUsers.length}`)
      console.log(`   - Auth users: ${authData.users.length}`)
      console.log(`   - Users without auth_id: ${usersWithoutAuthId.length}`)
      console.log(`   - Orphaned auth users: ${orphanedAuthUsers.length}`)
      console.log()

      if (usersWithoutAuthId.length === 0 && orphanedAuthUsers.length === 0) {
        console.log('✅ No sync issues detected!')
        console.log()
        console.log('If deletion still fails:')
        console.log('1. Check browser console for errors')
        console.log('2. Check server logs during deletion')
        console.log('3. Verify the DELETE endpoint is being called')
        console.log('4. Try deleting manually from Supabase dashboard to test permissions')
      } else {
        console.log('⚠️  Sync issues detected!')
        console.log()
        if (orphanedAuthUsers.length > 0) {
          console.log('Run this to sync auth users to database:')
          console.log('  npm run sync-auth-users')
        }
        if (usersWithoutAuthId.length > 0) {
          console.log('Users without auth_id cannot be deleted from auth.')
          console.log('These may be legacy users or improperly created.')
        }
      }

    } catch (authError) {
      console.error('   ❌ Error accessing Supabase Auth:', authError.message)
      console.error('   Service role key may be invalid or missing permissions')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

diagnose()

