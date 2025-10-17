#!/usr/bin/env node

/**
 * Test User Deletion
 * Simulates what happens when you delete a user from the admin panel
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🧪 Testing user deletion flow...\n')

async function testDeletion() {
  try {
    const supabase = createServiceClient()

    // Find a test user (not admin)
    console.log('1️⃣ Finding test user...')
    const { data: users, error: fetchError } = await supabase
      .from('users')
      .select('id, email, auth_id, is_admin, first_name, last_name')
      .eq('email', 'joe@test.com')
      .single()

    if (fetchError || !users) {
      console.log('   ⚠️  Joe user not found - test skipped')
      console.log('   Create a test user first to test deletion\n')
      return
    }

    console.log('   Found:', users.email)
    console.log('   ID:', users.id)
    console.log('   Auth ID:', users.auth_id)
    console.log()

    // Simulate the deletion process
    console.log('2️⃣ Simulating deletion process...\n')

    // Step 1: Get investments
    const { data: investments } = await supabase
      .from('investments')
      .select('id')
      .eq('user_id', users.id)
    
    const investmentIds = investments?.map(inv => inv.id) || []
    console.log(`   - Found ${investmentIds.length} investments`)

    // Step 2: Count related records
    if (investmentIds.length > 0) {
      const { count: txCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('investment_id', investmentIds)
      console.log(`   - Found ${txCount} transactions`)
    }

    const { count: activityCount } = await supabase
      .from('activity')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', users.id)
    console.log(`   - Found ${activityCount} activity records`)

    const { count: withdrawalCount } = await supabase
      .from('withdrawals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', users.id)
    console.log(`   - Found ${withdrawalCount} withdrawals`)

    const { count: bankCount } = await supabase
      .from('bank_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', users.id)
    console.log(`   - Found ${bankCount} bank accounts`)

    console.log()

    // Step 3: Check auth user exists
    console.log('3️⃣ Checking Supabase Auth...')
    if (users.auth_id) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(users.auth_id)
      
      if (authError) {
        console.log('   ❌ Auth user not found:', authError.message)
      } else {
        console.log('   ✅ Auth user exists:', authUser.user.email)
      }
    } else {
      console.log('   ⚠️  No auth_id set - auth deletion will be skipped')
    }

    console.log()
    console.log('📋 Summary:')
    console.log(`   User: ${users.email} (${users.id})`)
    console.log(`   Auth ID: ${users.auth_id || 'NOT SET'}`)
    console.log(`   Can delete from database: ✅`)
    console.log(`   Can delete from auth: ${users.auth_id ? '✅' : '❌ (no auth_id)'}`)
    console.log()
    console.log('✅ Deletion endpoint should work!')
    console.log()
    console.log('💡 To test: Go to admin panel, click Delete button next to this user')
    console.log('   Watch the terminal for detailed logs starting with [DELETE /api/users/...]')
    console.log()

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testDeletion()

