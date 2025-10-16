/**
 * Supabase Database Seeding Script
 * Creates admin account and test users for development
 * 
 * Usage: npm run seed-supabase
 * 
 * Environment variables are loaded via Node's --env-file flag in package.json
 */

import { createServiceClient } from '../lib/supabaseClient.js'
import { signUp } from '../lib/supabaseAuth.js'
import { addUser, addInvestment } from '../lib/supabaseDatabase.js'
import { hashPassword } from '../lib/auth.js'
import { encrypt } from '../lib/encryption.js'

const ADMIN_EMAIL = 'admin@rv.com'
const ADMIN_PASSWORD = 'admin123'

const TEST_EMAIL = 'joe@test.com'
const TEST_PASSWORD = 'test123'

async function seedDatabase() {
  console.log('🌱 Starting Supabase database seeding...\n')

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

    // Seed Admin Account
    console.log('👤 Creating admin account...')
    await seedAdmin()

    // Seed Test User
    console.log('\n👤 Creating test user...')
    await seedTestUser()

    console.log('\n✅ Database seeding completed successfully!')
    console.log('\n📝 Login credentials:')
    console.log(`   Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
    console.log(`   Test User: ${TEST_EMAIL} / ${TEST_PASSWORD}\n`)

  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  }
}

async function seedAdmin() {
  try {
    const supabase = createServiceClient()

    // Check if admin already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', ADMIN_EMAIL)
      .single()

    if (existing) {
      console.log('   ⚠️  Admin account already exists, skipping...')
      return
    }

    // Create admin user data
    const adminData = {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      firstName: 'Admin',
      lastName: 'User',
      isVerified: true,
      verifiedAt: '2025-01-23T00:00:00.000Z',
      isAdmin: true
    }

    const result = await addUser(adminData)

    if (result.success) {
      console.log('   ✅ Admin account created successfully')
    } else {
      console.error('   ❌ Failed to create admin:', result.error)
    }
  } catch (error) {
    console.error('   ❌ Error creating admin:', error.message)
  }
}

async function seedTestUser() {
  try {
    const supabase = createServiceClient()

    // Check if test user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', TEST_EMAIL)
      .single()

    if (existing) {
      console.log('   ⚠️  Test user already exists, skipping...')
      return
    }

    // Create test user data
    const testUserData = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      firstName: 'Joe',
      lastName: 'Test',
      phoneNumber: '+11231231231',
      dob: '1978-04-07',
      ssn: '123-12-3123', // Will be encrypted
      isVerified: true,
      verifiedAt: '2024-10-13T16:29:18.430Z',
      address: {
        street1: '123 Main St',
        street2: 'Apt 4',
        city: 'Miami',
        state: 'Florida',
        zip: '33101',
        country: 'United States'
      }
    }

    const result = await addUser(testUserData)

    if (result.success) {
      console.log('   ✅ Test user created successfully')
      
      // Create a test investment for this user
      console.log('   💰 Creating test investment...')
      await seedTestInvestment(result.user.id)
    } else {
      console.error('   ❌ Failed to create test user:', result.error)
    }
  } catch (error) {
    console.error('   ❌ Error creating test user:', error.message)
  }
}

async function seedTestInvestment(userId) {
  try {
    const investmentData = {
      id: 'INV-10000',
      status: 'draft',
      amount: 1000,
      paymentFrequency: 'monthly',
      lockupPeriod: '3-year',
      bonds: 100,
      accountType: 'individual'
    }

    const result = await addInvestment(userId, investmentData)

    if (result.success) {
      console.log('      ✅ Test investment created')
    } else {
      console.error('      ❌ Failed to create investment:', result.error)
    }
  } catch (error) {
    console.error('      ❌ Error creating investment:', error.message)
  }
}

// Run the seeding
seedDatabase()

