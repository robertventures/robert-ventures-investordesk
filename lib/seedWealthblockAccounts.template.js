/**
 * Seed Wealthblock Accounts - Template
 *
 * 🔒 IMPORTANT: This is a TEMPLATE file
 * 
 * To use:
 * 1. Copy this file to: lib/seedWealthblockAccounts.js
 * 2. Replace template data with REAL Wealthblock user data
 * 3. Add more users as you capture them from screenshots
 * 4. Seed locally: npm run seed-wealthblock
 * 5. Use Time Machine to generate months/years of activity
 * 6. When ready: Export database and upload to production
 * 
 * Note: lib/seedWealthblockAccounts.js is GITIGNORED
 *       Keep real data there - it will never be committed
 */

import { generateTransactionId } from './idGenerator.js'
import { getUsers, saveUsers } from './database.js'

// ============================================================================
// WEALTHBLOCK USER DATA
// ============================================================================
// Replace this template with REAL user data from Wealthblock
// This file is gitignored - safe to keep real PII here

const WEALTHBLOCK_USERS = [
  {
    // TEMPLATE - Replace with real Wealthblock data
    wealthblockId: '1234567890',
    accountType: 'individual',
    
    // Personal Information
    firstName: 'Jane',
    middleName: '',
    lastName: 'Doe',
    email: 'jane.doe@test.com',
    phoneNumber: '+15551234567',
    dob: '1985-03-15',
    ssn: '123-45-6789',
    
    // Address
    address: {
      street1: '123 Example Street',
      street2: '',
      city: 'San Francisco',
      state: 'California',
      zip: '94102',
      country: 'United States'
    },
    
    // Identity Verification
    identificationType: 'drivers-license',
    identificationDocument: 'Drivers License.pdf',
    nationality: 'United States',
    
    // Accreditation
    accreditationStatus: 'net-worth-1m',
    accreditationVerified: true,
    
    // KYC Status
    kycStatus: 'manually-approved',
    kycApprovedAt: '2024-01-15T10:00:00.000Z',
    
    // Account Status
    isVerified: true,
    verifiedAt: '2024-01-15T10:00:00.000Z',
    createdAt: '2024-01-15T10:00:00.000Z',
    
    // Bank Account
    bankAccounts: [
      {
        accountHolder: 'Jane Doe',
        routingNumber: '123456789',
        accountNumber: '9876543210',
        accountType: 'checking',
        isPrimary: true
      }
    ],
    
    // Investments
    investments: [
      {
        offerName: 'Fixed-Rate Bonds',
        amount: 10000,
        paymentFrequency: 'compounding',
        lockupPeriod: '3-year',
        interestRate: 10.0,
        
        startDate: '2024-01-15T10:00:00.000Z',
        submittedAt: '2024-01-15T10:00:00.000Z',
        confirmedAt: '2024-01-15T10:00:00.000Z',
        
        status: 'active',
        paymentMethod: 'ACH',
        paymentStatus: 'payment-received',
        
        bankApproved: true,
        bankApprovedBy: 'system',
        bankApprovedAt: '2024-01-15T10:00:00.000Z',
        adminApproved: true,
        adminApprovedBy: 'system',
        adminApprovedAt: '2024-01-15T10:00:00.000Z',
        
        eSignStatus: 'complete',
        eSignCompletedAt: '2024-01-15T10:00:00.000Z'
      },
      {
        offerName: 'Fixed-Rate Bonds',
        amount: 5000,
        paymentFrequency: 'monthly',
        lockupPeriod: '1-year',
        interestRate: 10.0,
        
        startDate: '2024-02-01T10:00:00.000Z',
        submittedAt: '2024-02-01T10:00:00.000Z',
        confirmedAt: '2024-02-01T10:00:00.000Z',
        
        status: 'active',
        paymentMethod: 'ACH',
        paymentStatus: 'payment-received',
        
        bankApproved: true,
        bankApprovedBy: 'system',
        bankApprovedAt: '2024-02-01T10:00:00.000Z',
        adminApproved: true,
        adminApprovedBy: 'system',
        adminApprovedAt: '2024-02-01T10:00:00.000Z',
        
        eSignStatus: 'complete',
        eSignCompletedAt: '2024-02-01T10:00:00.000Z',
        
        payoutDetails: {
          accountHolder: 'Jane Doe',
          routingNumber: '123456789',
          accountNumber: '9876543210',
          accountType: 'checking'
        }
      }
    ]
  }
  
  // ADD MORE USERS HERE AS YOU CAPTURE THEM FROM WEALTHBLOCK
  
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generate user ID (format: USR-2001, USR-2002, etc.)
// Use 2000+ range to distinguish from test accounts (1000+ range)
function generateWealthblockUserId(counter) {
  return `USR-${2000 + counter}`
}

// Generate investment ID (format: INV-20000, INV-20001, etc.)
function generateWealthblockInvestmentId(counter) {
  return `INV-${20000 + counter}`
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

export async function seedWealthblockAccounts() {
  console.log('🌱 Starting Wealthblock account seeding...')
  console.log('📁 Target: Netlify Blobs or local data/users.json')
  console.log('🎯 Purpose: Testing with real user data from Wealthblock\n')

  // Read existing users
  let usersData = await getUsers()
  if (!usersData || !usersData.users) {
    usersData = { users: [] }
  }

  // Remove existing Wealthblock test accounts (NEVER removes admin accounts)
  const originalCount = usersData.users.length
  usersData.users = usersData.users.filter(u => {
    // ALWAYS keep admin accounts
    if (u.isAdmin) {
      return true
    }
    // Remove accounts with wealthblock test email pattern or wealthblockId
    return !u.email.includes('.robert@test.com') && !u.wealthblockId
  })
  const removed = originalCount - usersData.users.length
  if (removed > 0) {
    console.log(`🗑️  Removed ${removed} existing Wealthblock test accounts\n`)
  }

  let userCounter = usersData.users.length + 1
  let investmentCounter = 0
  let createdCount = 0

  // Process each Wealthblock user
  for (const wbUser of WEALTHBLOCK_USERS) {
    const userId = generateWealthblockUserId(userCounter)
    
    console.log(`\n📊 Creating Wealthblock User: ${wbUser.firstName} ${wbUser.lastName}`)
    console.log(`   Email: ${wbUser.email}`)
    console.log(`   Wealthblock ID: ${wbUser.wealthblockId}`)
    console.log(`   Account Type: ${wbUser.accountType}`)
    console.log(`   Accreditation: ${wbUser.accreditationStatus}`)
    
    // Create user object
    const user = {
      id: userId,
      wealthblockId: wbUser.wealthblockId,
      
      // Personal info
      email: wbUser.email,
      firstName: wbUser.firstName,
      middleName: wbUser.middleName,
      lastName: wbUser.lastName,
      phoneNumber: wbUser.phoneNumber,
      dob: wbUser.dob,
      ssn: wbUser.ssn,
      password: 'Test1234!', // Standard test password
      
      // Address
      address: wbUser.address,
      
      // Identity
      identificationType: wbUser.identificationType,
      identificationDocument: wbUser.identificationDocument,
      nationality: wbUser.nationality,
      
      // Accreditation (new fields)
      accreditationStatus: wbUser.accreditationStatus,
      accreditationVerified: wbUser.accreditationVerified,
      
      // KYC
      kycStatus: wbUser.kycStatus,
      kycApprovedAt: wbUser.kycApprovedAt,
      
      // Account type
      accountType: wbUser.accountType,
      
      // Verification
      verificationCode: '123456',
      isVerified: wbUser.isVerified,
      verifiedAt: wbUser.verifiedAt,
      isAdmin: false,
      
      // Bank accounts
      bankAccounts: wbUser.bankAccounts.map((bank, idx) => ({
        id: `BANK-${userId}-${idx}`,
        ...bank,
        addedAt: wbUser.createdAt
      })),
      
      // Investments (will populate below)
      investments: [],
      
      // Timestamps
      createdAt: wbUser.createdAt,
      updatedAt: wbUser.createdAt,
      
      // Activity log
      activity: [
        {
          id: generateTransactionId('USR', userId, 'account_created'),
          type: 'account_created',
          date: wbUser.createdAt
        }
      ]
    }
    
    // Process investments
    console.log(`\n   💰 Processing ${wbUser.investments.length} investment(s):`)
    
    for (const wbInv of wbUser.investments) {
      const investmentId = generateWealthblockInvestmentId(investmentCounter)
      
      // Calculate lockup end date
      const lockupYears = wbInv.lockupPeriod === '3-year' ? 3 : 1
      const lockupEndDate = new Date(wbInv.confirmedAt)
      lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)
      
      // Calculate bonds (amount / 10)
      const bonds = Math.floor(wbInv.amount / 10)
      
      const investment = {
        id: investmentId,
        amount: wbInv.amount,
        bonds: bonds,
        paymentFrequency: wbInv.paymentFrequency,
        lockupPeriod: wbInv.lockupPeriod,
        interestRate: wbInv.interestRate,
        accountType: wbUser.accountType,
        
        // Wealthblock-specific fields
        offerName: wbInv.offerName,
        paymentMethod: wbInv.paymentMethod,
        paymentStatus: wbInv.paymentStatus,
        eSignStatus: wbInv.eSignStatus,
        eSignCompletedAt: wbInv.eSignCompletedAt,
        
        // Historical flag for auto-approval
        wealthblockHistorical: true, // Auto-approve all distributions
        
        // Status
        status: wbInv.status,
        investmentDate: wbInv.confirmedAt,
        submittedAt: wbInv.submittedAt,
        confirmedAt: wbInv.confirmedAt,
        lockupEndDate: lockupEndDate.toISOString(),
        earningsMethod: wbInv.paymentFrequency === 'monthly' ? 'bank-account' : 'compounding',
        
        // Approvals
        bankApproved: wbInv.bankApproved,
        bankApprovedBy: wbInv.bankApprovedBy,
        bankApprovedAt: wbInv.bankApprovedAt,
        adminApproved: wbInv.adminApproved,
        adminApprovedBy: wbInv.adminApprovedBy,
        adminApprovedAt: wbInv.adminApprovedAt,
        
        // Timestamps
        createdAt: wbInv.submittedAt,
        updatedAt: wbInv.confirmedAt,
        
        // Initialize transactions array with pre-populated distributions
        transactions: []
      }
      
      // Add payout details for monthly accounts
      if (wbInv.paymentFrequency === 'monthly' && wbInv.payoutDetails) {
        investment.payoutDetails = wbInv.payoutDetails
      }
      
      // NOTE: Distributions are generated by the migrate-transactions endpoint
      // The wealthblockHistorical flag ensures they're auto-approved as 'received'
      
      user.investments.push(investment)
      
      // Add investment activities
      user.activity.push({
        id: generateTransactionId('INV', investmentId, 'created'),
        type: 'investment_created',
        investmentId: investmentId,
        date: wbInv.submittedAt
      })
      
      user.activity.push({
        id: generateTransactionId('INV', investmentId, 'approved'),
        type: 'investment_approved',
        investmentId: investmentId,
        date: wbInv.bankApprovedAt
      })
      
      user.activity.push({
        id: generateTransactionId('INV', investmentId, 'confirmed'),
        type: 'investment_confirmed',
        investmentId: investmentId,
        amount: wbInv.amount,
        date: wbInv.confirmedAt
      })
      
      console.log(`      ✅ ${wbInv.offerName}: $${wbInv.amount.toLocaleString()}`)
      console.log(`         Type: ${wbInv.paymentFrequency} | Lockup: ${wbInv.lockupPeriod} | Rate: ${wbInv.interestRate}%`)
      console.log(`         Start: ${new Date(wbInv.startDate).toLocaleDateString()}`)
      
      investmentCounter++
    }
    
    // Add user to collection
    usersData.users.push(user)
    userCounter++
    createdCount++
  }

  // Save users data
  const saved = await saveUsers(usersData)
  
  if (!saved) {
    throw new Error('Failed to save users data')
  }

  console.log(`\n✨ Wealthblock seeding complete!`)
  console.log(`📊 Total Wealthblock accounts created: ${createdCount}`)
  console.log(`💾 Data saved successfully\n`)

  // Print summary
  console.log('📋 Wealthblock Account Summary:')
  console.log('─'.repeat(70))
  WEALTHBLOCK_USERS.forEach(user => {
    const totalInvested = user.investments.reduce((sum, inv) => sum + inv.amount, 0)
    console.log(`   ${user.firstName} ${user.lastName}`)
    console.log(`      Email: ${user.email}`)
    console.log(`      Investments: ${user.investments.length} ($${totalInvested.toLocaleString()} total)`)
  })
  console.log('─'.repeat(70))

  console.log('\n🔑 All Wealthblock test accounts use password: Test1234!')
  console.log('\n💡 To add more users: Edit lib/seedWealthblockAccounts.js and add to WEALTHBLOCK_USERS array')
  console.log('💡 To reset/reseed: Run npm run seed-wealthblock again\n')
}

// ============================================================================
// WEALTHBLOCK-SPECIFIC BEHAVIORS
// ============================================================================
//
// AUTO-APPROVE ALL DISTRIBUTIONS:
// Since Wealthblock users are historical imports, all monthly distributions
// are marked as 'received' (completed/paid) automatically. This is different
// from new users going forward where monthly payouts require admin approval.
//
// The seed function will:
// 1. Create monthly distributions for all months elapsed
// 2. Mark ALL distributions as status: 'received' (completed)
// 3. Set completedAt timestamp for each
// 4. Set wealthblockHistorical: true flag
//
// This ensures historical Wealthblock data matches reality where users
// have already received their monthly payments.
//
// ============================================================================
// PRODUCTION DEPLOYMENT WORKFLOW
// ============================================================================
// 
// DAILY WORKFLOW (LOCAL DEVELOPMENT):
// 1. Keep REAL Wealthblock data in WEALTHBLOCK_USERS array in seedWealthblockAccounts.js
// 2. That file is GITIGNORED - safe to keep real PII there forever
// 3. Add more real users as you capture them from screenshots
// 4. Seed locally: npm run seed-wealthblock OR Time Machine button
// 5. Use Time Machine to advance time and generate months/years of activity
// 6. Build up realistic transaction history with distributions and compounding
// 7. All monthly payouts are AUTO-APPROVED (marked as received/completed)
// 
// PRODUCTION DEPLOYMENT (WHEN READY):
// 1. LOCAL: You have months of activity generated in local database
// 2. LOCAL: Export database to CSV (TODO: build export feature)
//    - Export all users, investments, distributions, compounding
//    - Format matches ImportInvestorsTab expectations
// 3. PRODUCTION: Go to Admin > Operations > Import Investors  
// 4. PRODUCTION: Upload CSV with field mapping
// 5. PRODUCTION: Review all users and transactions
// 6. PRODUCTION: Confirm import
// 7. PRODUCTION: All your local test data is now live!
//
// The Import Investors feature already supports:
// - CSV upload with custom field mapping
// - User data (email, name, address, etc.)
// - Investment data (amount, frequency, lockup)
// - Distributions and contributions
// - Send welcome emails option
//
// TODO: Add admin UI button "Export Database as CSV"
// TODO: Format export to match ImportInvestorsTab field structure
// TODO: Include all activity, distributions, and compounding history

export default seedWealthblockAccounts

