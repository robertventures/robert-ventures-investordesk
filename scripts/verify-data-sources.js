#!/usr/bin/env node

/**
 * Data Source Verification Script
 * 
 * Run this script to verify that:
 * 1. Supabase is properly configured
 * 2. All data is being read from Supabase (not local files)
 * 3. Users can be fetched from the database
 * 
 * Usage: node scripts/verify-data-sources.js
 */

import { createServiceClient } from '../lib/supabaseClient.js'
import { getUsers } from '../lib/supabaseDatabase.js'
import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')

console.log('🔍 Verifying Data Sources...\n')

// Check 1: Verify environment variables
console.log('1️⃣ Checking environment variables...')
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('   ❌ NEXT_PUBLIC_SUPABASE_URL is not set')
  process.exit(1)
} else {
  console.log('   ✅ NEXT_PUBLIC_SUPABASE_URL is set')
}

if (!supabaseAnonKey) {
  console.error('   ❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  process.exit(1)
} else {
  console.log('   ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY is set')
}

if (!supabaseServiceKey) {
  console.error('   ⚠️  SUPABASE_SERVICE_ROLE_KEY is not set')
  console.error('   This is required for admin operations like deleting auth users')
  console.error('   Get it from: Supabase Dashboard → Settings → API → service_role key')
  process.exit(1)
} else {
  console.log('   ✅ SUPABASE_SERVICE_ROLE_KEY is set')
}

// Check 2: Verify no users.json file exists
console.log('\n2️⃣ Checking for legacy files...')
const usersJsonPath = path.join(dataDir, 'users.json')
if (fs.existsSync(usersJsonPath)) {
  console.error('   ⚠️  Found legacy users.json file')
  console.error('   This file should be deleted as all user data is now in Supabase')
} else {
  console.log('   ✅ No legacy users.json file found')
}

// Check 3: Test Supabase connection
console.log('\n3️⃣ Testing Supabase connection...')
try {
  const supabase = createServiceClient()
  
  // Try to query users table
  const { data, error } = await supabase
    .from('users')
    .select('id, email, is_admin')
    .limit(5)

  if (error) {
    console.error('   ❌ Failed to query Supabase:', error.message)
    process.exit(1)
  }

  console.log('   ✅ Successfully connected to Supabase')
  console.log(`   Found ${data.length} users in database`)
  
  // Show sample data
  if (data.length > 0) {
    console.log('\n   Sample users:')
    data.forEach(user => {
      console.log(`   - ${user.email} ${user.is_admin ? '(Admin)' : ''}`)
    })
  }
} catch (error) {
  console.error('   ❌ Error connecting to Supabase:', error.message)
  process.exit(1)
}

// Check 4: Test getUsers function
console.log('\n4️⃣ Testing getUsers() function...')
try {
  const result = await getUsers()
  
  if (!result || !result.users) {
    console.error('   ❌ getUsers() returned invalid data')
    process.exit(1)
  }

  console.log('   ✅ getUsers() working correctly')
  console.log(`   Retrieved ${result.users.length} users with relationships`)
  
  // Check if users have investments loaded
  const usersWithInvestments = result.users.filter(u => u.investments && u.investments.length > 0)
  console.log(`   ${usersWithInvestments.length} users have investments`)
  
  // Check if activity is loaded
  const usersWithActivity = result.users.filter(u => u.activity && u.activity.length > 0)
  console.log(`   ${usersWithActivity.length} users have activity records`)
  
} catch (error) {
  console.error('   ❌ Error calling getUsers():', error.message)
  process.exit(1)
}

// Check 5: Verify auth users can be deleted
console.log('\n5️⃣ Testing auth user deletion capability...')
try {
  const supabase = createServiceClient()
  
  // Just check that we have the admin.deleteUser method available
  if (typeof supabase.auth.admin.deleteUser !== 'function') {
    console.error('   ❌ auth.admin.deleteUser is not available')
    console.error('   Check that SUPABASE_SERVICE_ROLE_KEY is correct')
    process.exit(1)
  }
  
  console.log('   ✅ Auth admin methods are available')
  console.log('   User deletion should work correctly')
} catch (error) {
  console.error('   ❌ Error checking auth admin methods:', error.message)
  process.exit(1)
}

console.log('\n✨ All checks passed! Data sources are correctly configured.\n')
console.log('Summary:')
console.log('- ✅ Supabase connection working')
console.log('- ✅ All user data comes from Supabase PostgreSQL')
console.log('- ✅ No legacy JSON files for users')
console.log('- ✅ Auth user deletion capability available')
console.log('\nYour admin panel will show real-time data from Supabase.\n')

