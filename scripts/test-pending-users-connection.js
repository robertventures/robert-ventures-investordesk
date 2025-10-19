#!/usr/bin/env node

/**
 * Test connection to pending_users table and try to insert a test record
 * This will help diagnose what's failing in production
 */

import { createServiceClient } from '../lib/supabaseClient.js'
import { storePendingUser } from '../lib/pendingUsers.js'
import { hashPassword } from '../lib/auth.js'

console.log('🧪 Testing pending_users connection and functionality...\n')

async function testConnection() {
  try {
    console.log('1️⃣ Environment Check:')
    console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`)
    console.log(`   SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`)
    console.log(`   SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`)
    console.log()

    const supabase = createServiceClient()
    
    // Test 1: Check if table exists
    console.log('2️⃣ Testing table access...')
    const { data: tableData, error: tableError } = await supabase
      .from('pending_users')
      .select('*')
      .limit(1)
    
    if (tableError) {
      console.log(`   ❌ Cannot access table: ${tableError.message}`)
      console.log(`   Error code: ${tableError.code}`)
      console.log(`   Error details:`, tableError)
      return false
    }
    
    console.log('   ✅ Table is accessible')
    console.log()
    
    // Test 2: Try to insert a test record
    console.log('3️⃣ Testing insert operation...')
    const testEmail = `test-${Date.now()}@test.com`
    const testPassword = await hashPassword('TestPassword123!')
    
    const result = await storePendingUser(testEmail, testPassword)
    
    if (result.success) {
      console.log(`   ✅ Successfully inserted test record`)
      console.log(`   Email: ${result.email}`)
      console.log(`   Verification code: ${result.verificationCode}`)
      console.log()
      
      // Clean up test record
      console.log('4️⃣ Cleaning up test record...')
      await supabase
        .from('pending_users')
        .delete()
        .eq('email', testEmail)
      console.log('   ✅ Test record deleted')
      console.log()
      
      return true
    } else {
      console.log(`   ❌ Insert failed: ${result.error}`)
      return false
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    console.error('Stack:', error.stack)
    return false
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('✅ All tests passed! Registration should work.')
      console.log()
      console.log('If production is still failing:')
      console.log('1. Check Netlify environment variables match this database')
      console.log('2. Check Netlify function logs for the actual error')
      console.log('3. Trigger a manual deploy in Netlify (clear cache)')
      console.log()
    } else {
      console.log('❌ Tests failed. See errors above.')
      console.log()
    }
    process.exit(success ? 0 : 1)
  })

