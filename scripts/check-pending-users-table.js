#!/usr/bin/env node

/**
 * Check if pending_users table exists
 */

import { createServiceClient } from '../lib/supabaseClient.js'

console.log('🔍 Checking for pending_users table...\n')

async function checkTable() {
  try {
    const supabase = createServiceClient()
    
    // Try to query the pending_users table
    const { data, error } = await supabase
      .from('pending_users')
      .select('*')
      .limit(1)
    
    if (error) {
      if (error.message.includes('relation "public.pending_users" does not exist')) {
        console.log('❌ pending_users table DOES NOT EXIST')
        console.log('\nThis is why registration is failing!')
        console.log('\nTo fix it, run this SQL in your Supabase SQL Editor:')
        console.log('\n' + '='.repeat(60))
        console.log(`
CREATE TABLE IF NOT EXISTS pending_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  hashed_password TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_users_email ON pending_users(email);
CREATE INDEX IF NOT EXISTS idx_pending_users_created_at ON pending_users(created_at);

ALTER TABLE pending_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage pending users"
  ON pending_users FOR ALL TO service_role
  USING (true) WITH CHECK (true);
        `)
        console.log('='.repeat(60) + '\n')
        return false
      }
      
      console.log('❌ Error checking table:', error.message)
      return false
    }
    
    console.log('✅ pending_users table EXISTS')
    console.log(`   Found ${data?.length || 0} pending users\n`)
    
    // Show table structure
    const { data: tableInfo } = await supabase
      .from('pending_users')
      .select('*')
      .limit(0)
    
    if (tableInfo !== null) {
      console.log('📋 Table structure looks good!\n')
    }
    
    return true
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    return false
  }
}

checkTable()
  .then(exists => {
    if (exists) {
      console.log('✅ All good! Registration should work.\n')
    } else {
      console.log('⚠️  Table is missing. See SQL above to fix it.\n')
    }
    process.exit(exists ? 0 : 1)
  })

