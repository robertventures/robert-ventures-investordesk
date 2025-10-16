#!/usr/bin/env node
/**
 * Update Passwords Script
 * Updates existing account passwords to meet new security requirements
 * 
 * Usage: npm run update-passwords
 * 
 * This script updates:
 * - Admin account (admin@rv.com) → Admin123!
 * - Test user (joe@test.com) → Test123!
 */

import { createServiceClient } from '../lib/supabaseClient.js'
import { getUserByEmail, updateUser } from '../lib/supabaseDatabase.js'

const ADMIN_EMAIL = 'admin@rv.com'
const ADMIN_PASSWORD = 'Admin123!'

const TEST_EMAIL = 'joe@test.com'
const TEST_PASSWORD = 'Test123!'

async function updatePasswords() {
  console.log('🔐 Starting password updates...\n')

  try {
    const supabase = createServiceClient()

    // Check connection
    const { data: connectionTest, error: connectionError } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    if (connectionError) {
      console.error('❌ Cannot connect to Supabase:', connectionError.message)
      console.error('\nMake sure you have set these environment variables:')
      console.error('- NEXT_PUBLIC_SUPABASE_URL')
      console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
      console.error('- SUPABASE_SERVICE_ROLE_KEY\n')
      process.exit(1)
    }

    console.log('✅ Connected to Supabase\n')

    // Update Admin Password
    console.log('👤 Updating admin password...')
    await updateAdminPassword()

    // Update Test User Password
    console.log('\n👤 Updating test user password...')
    await updateTestUserPassword()

    console.log('\n✅ Password updates completed successfully!')
    console.log('\n📝 New login credentials:')
    console.log(`   Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
    console.log(`   Test User: ${TEST_EMAIL} / ${TEST_PASSWORD}\n`)
    console.log('⚠️  Note: Users will need to use these new passwords to log in.\n')

  } catch (error) {
    console.error('\n❌ Password update failed:', error)
    process.exit(1)
  }
}

async function updateAdminPassword() {
  try {
    const supabase = createServiceClient()

    // Find admin user
    const admin = await getUserByEmail(ADMIN_EMAIL)

    if (!admin) {
      console.log('   ⚠️  Admin account not found, skipping...')
      return
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      admin.auth_id,
      { password: ADMIN_PASSWORD }
    )

    if (authError) {
      console.error('   ❌ Failed to update admin password:', authError.message)
      return
    }

    console.log('   ✅ Admin password updated successfully')
  } catch (error) {
    console.error('   ❌ Error updating admin password:', error.message)
  }
}

async function updateTestUserPassword() {
  try {
    const supabase = createServiceClient()

    // Find test user
    const testUser = await getUserByEmail(TEST_EMAIL)

    if (!testUser) {
      console.log('   ⚠️  Test user not found, skipping...')
      return
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      testUser.auth_id,
      { password: TEST_PASSWORD }
    )

    if (authError) {
      console.error('   ❌ Failed to update test user password:', authError.message)
      return
    }

    console.log('   ✅ Test user password updated successfully')
  } catch (error) {
    console.error('   ❌ Error updating test user password:', error.message)
  }
}

// Run the updates
updatePasswords()

