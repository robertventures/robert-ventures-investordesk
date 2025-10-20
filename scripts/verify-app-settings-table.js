/**
 * Verify and create app_settings table for Time Machine
 * 
 * This script checks if the app_settings table exists in Supabase
 * and creates it if it doesn't exist.
 * 
 * Usage: npm run verify-app-settings
 */

import { createServiceClient } from '../lib/supabaseClient.js'

async function verifyAppSettingsTable() {
  console.log('🔍 Checking app_settings table...\n')

  try {
    const supabase = createServiceClient()

    // Try to query the table to see if it exists
    const { data, error } = await supabase
      .from('app_settings')
      .select('key')
      .limit(1)

    if (!error) {
      console.log('✅ app_settings table exists!')
      
      // Check if time_machine settings exist
      const { data: timeMachineData } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'time_machine')
        .maybeSingle()

      if (timeMachineData) {
        console.log('\n⏰ Time Machine settings found:')
        console.log(JSON.stringify(timeMachineData, null, 2))
      } else {
        console.log('\n⚠️  No time machine settings found (this is normal for a fresh setup)')
        console.log('   Settings will be created when you first use the time machine')
      }
      
      return
    }

    // If error is about missing table, provide instructions
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      console.error('❌ app_settings table does NOT exist!')
      console.error('\n📝 To create the table, run this SQL in your Supabase SQL Editor:\n')
      console.log(`
-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow service role to access (for API calls)
CREATE POLICY "Service role can manage app settings" ON app_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Optional: Allow admins to read settings (if you want admin UI access)
CREATE POLICY "Admins can read app settings" ON app_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.is_admin = true
    )
  );
`)
      console.log('\n🔗 Supabase SQL Editor: https://supabase.com/dashboard/project/<your-project>/editor')
      process.exit(1)
    }

    // Other error
    console.error('❌ Error checking table:', error)
    process.exit(1)

  } catch (error) {
    console.error('\n❌ Script failed:', error)
    console.error('\nMake sure you have set these environment variables:')
    console.error('- NEXT_PUBLIC_SUPABASE_URL')
    console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('- SUPABASE_SERVICE_ROLE_KEY\n')
    process.exit(1)
  }
}

// Run the verification
verifyAppSettingsTable()

