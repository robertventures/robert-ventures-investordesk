#!/usr/bin/env node

/**
 * Sync Supabase Auth Users to Users Table
 * 
 * This script syncs users from Supabase Auth to the users table.
 * It's useful when you have auth users but they don't have corresponding
 * database records (which is what the admin panel displays).
 * 
 * Usage: npm run sync-auth-users
 */

import { createServiceClient } from '../lib/supabaseClient.js'
import { generateUserId } from '../lib/idGenerator.js'
import { getCurrentAppTime } from '../lib/appTime.js'

console.log('🔄 Syncing Supabase Auth users to users table...\n')

async function syncAuthToUsers() {
  try {
    const supabase = createServiceClient()
    
    // Step 1: Get all auth users
    console.log('1️⃣ Fetching auth users...')
    const { data: authUsersResponse, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError)
      process.exit(1)
    }
    
    const authUsers = authUsersResponse.users
    console.log(`   Found ${authUsers.length} users in Supabase Auth\n`)
    
    // Step 2: Get existing users in database
    console.log('2️⃣ Fetching existing users from database...')
    const { data: dbUsers, error: dbError } = await supabase
      .from('users')
      .select('auth_id, email, id')
    
    if (dbError) {
      console.error('❌ Error fetching database users:', dbError)
      process.exit(1)
    }
    
    console.log(`   Found ${dbUsers.length} users in database\n`)
    
    // Step 3: Find auth users that don't have database records
    const existingAuthIds = new Set(dbUsers.map(u => u.auth_id).filter(Boolean))
    const missingUsers = authUsers.filter(authUser => !existingAuthIds.has(authUser.id))
    
    console.log(`3️⃣ Analysis:`)
    console.log(`   - Auth users: ${authUsers.length}`)
    console.log(`   - Database users: ${dbUsers.length}`)
    console.log(`   - Missing from database: ${missingUsers.length}\n`)
    
    if (missingUsers.length === 0) {
      console.log('✅ All auth users already have database records. Nothing to sync.\n')
      return { synced: 0, skipped: 0 }
    }
    
    // Step 4: Create database records for missing users
    console.log(`4️⃣ Creating database records for ${missingUsers.length} users...\n`)
    
    const appTime = await getCurrentAppTime()
    const timestamp = appTime || new Date().toISOString()
    
    let synced = 0
    let skipped = 0
    
    for (const authUser of missingUsers) {
      const email = authUser.email
      const userId = await generateUserId()
      
      // Extract metadata
      const firstName = authUser.user_metadata?.firstName || authUser.user_metadata?.first_name || ''
      const lastName = authUser.user_metadata?.lastName || authUser.user_metadata?.last_name || ''
      
      console.log(`   Processing: ${email}`)
      
      // Check if email already exists (shouldn't happen, but be safe)
      const { data: existingByEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()
      
      if (existingByEmail) {
        console.log(`   ⚠️  User with email ${email} already exists, skipping...`)
        skipped++
        continue
      }
      
      // Create user record
      const newUser = {
        id: userId,
        auth_id: authUser.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        phone_number: authUser.phone || '',
        dob: '',
        ssn: '',
        is_verified: authUser.email_confirmed_at ? true : false,
        verified_at: authUser.email_confirmed_at || null,
        is_admin: false,
        address: null,
        created_at: authUser.created_at || timestamp,
        updated_at: timestamp
      }
      
      const { error: insertError } = await supabase
        .from('users')
        .insert(newUser)
      
      if (insertError) {
        console.error(`   ❌ Failed to create user ${email}:`, insertError.message)
        skipped++
        continue
      }
      
      // Create initial activity
      await supabase
        .from('activity')
        .insert({
          id: `TXN-USR-${userId}-account_created-${Date.now()}`,
          user_id: userId,
          type: 'account_created',
          date: authUser.created_at || timestamp
        })
      
      console.log(`   ✅ Created user: ${email} (${userId})`)
      synced++
    }
    
    console.log(`\n5️⃣ Summary:`)
    console.log(`   ✅ Successfully synced: ${synced} users`)
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped: ${skipped} users`)
    }
    console.log(`   📊 Total database users now: ${dbUsers.length + synced}\n`)
    
    return { synced, skipped }
    
  } catch (error) {
    console.error('❌ Error during sync:', error)
    process.exit(1)
  }
}

// Run the sync
syncAuthToUsers()
  .then(({ synced, skipped }) => {
    if (synced > 0) {
      console.log('✨ Sync complete! Refresh your admin panel to see all users.\n')
    } else {
      console.log('✨ No changes needed.\n')
    }
    process.exit(0)
  })
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

