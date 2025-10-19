#!/usr/bin/env node

/**
 * Verify Supabase connection and display (partial) keys for comparison
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🔑 Verifying Supabase Configuration...\n')

async function verifyKeys() {
  try {
    // Show environment variables (partial for security)
    console.log('1️⃣ Environment Variables:')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!url || !anonKey || !serviceKey) {
      console.log('   ❌ Missing environment variables!')
      console.log(`   URL: ${url ? '✅' : '❌'}`)
      console.log(`   ANON_KEY: ${anonKey ? '✅' : '❌'}`)
      console.log(`   SERVICE_ROLE_KEY: ${serviceKey ? '✅' : '❌'}`)
      return false
    }
    
    console.log(`   URL: ${url}`)
    console.log(`   ANON_KEY: ${anonKey.substring(0, 20)}...${anonKey.substring(anonKey.length - 10)} (${anonKey.length} chars)`)
    console.log(`   SERVICE_ROLE_KEY: ${serviceKey.substring(0, 20)}...${serviceKey.substring(serviceKey.length - 10)} (${serviceKey.length} chars)`)
    console.log()
    
    // Test connection
    console.log('2️⃣ Testing Supabase Connection...')
    const supabase = createServiceClient()
    
    // Try a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (error) {
      console.log(`   ❌ Connection failed: ${error.message}`)
      console.log(`   Error code: ${error.code}`)
      
      if (error.message.includes('API key')) {
        console.log('\n   🔍 Looks like invalid API key!')
        console.log('   Verify these match in Supabase dashboard (Settings → API):')
        console.log(`   - Project URL should be: ${url}`)
        console.log(`   - Keys should start with: eyJ...`)
      }
      
      return false
    }
    
    console.log('   ✅ Connection successful!')
    console.log()
    
    // Test pending_users table specifically
    console.log('3️⃣ Testing pending_users Table Access...')
    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_users')
      .select('*')
      .limit(1)
    
    if (pendingError) {
      console.log(`   ❌ Cannot access pending_users: ${pendingError.message}`)
      
      if (pendingError.message.includes('does not exist')) {
        console.log('\n   🔍 Table does not exist in this database!')
        console.log('   You may have created it in a DIFFERENT Supabase project.')
      } else if (pendingError.message.includes('permission')) {
        console.log('\n   🔍 Permission denied!')
        console.log('   Check Row Level Security policies on pending_users table.')
      }
      
      return false
    }
    
    console.log('   ✅ pending_users table is accessible!')
    console.log()
    
    return true
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message)
    return false
  }
}

verifyKeys()
  .then(success => {
    if (success) {
      console.log('✅ All checks passed!')
      console.log('\nYour local environment is correctly configured.')
      console.log('\nFor Netlify, compare the partial keys above with what you have set.')
      console.log('Make sure there are no extra spaces or line breaks in Netlify env vars.')
    } else {
      console.log('\n❌ Configuration issues detected.')
      console.log('See errors above for details.')
    }
    console.log()
    process.exit(success ? 0 : 1)
  })

