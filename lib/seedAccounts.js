/**
 * Seed Accounts Logic - Shared between CLI script and API routes
 *
 * ⚠️  WARNING: This creates test accounts for development/testing
 * 
 * Creates comprehensive test accounts for all account type combinations:
 * - 4 Account Types: individual, joint, entity, ira
 * - 2 Payment Frequencies: monthly, compounding
 * - 2 Lockup Periods: 1-year, 3-year
 *
 * Total: 16+ accounts with realistic test data
 */

import { generateTransactionId } from './idGenerator.js'
import { getUsers, saveUsers } from './database.js'

// Test account configurations
const accountTypes = ['individual', 'joint', 'entity', 'ira']
const paymentFrequencies = ['monthly', 'compounding']
const lockupPeriods = ['1-year', '3-year']

// Generate user ID (format: USR-1001, USR-1002, etc.)
function generateUserId(counter) {
  return `USR-${1000 + counter}`
}

// Generate investment ID (format: INV-10000, INV-10001, etc.)
function generateInvestmentId(counter) {
  return `INV-${10000 + counter}`
}

// Get current timestamp
function getTimestamp() {
  return new Date().toISOString()
}

// Realistic test names pool
const individualNames = [
  { firstName: 'James', lastName: 'Anderson', city: 'San Francisco', zip: '94102' },
  { firstName: 'Emma', lastName: 'Thompson', city: 'Oakland', zip: '94601' },
  { firstName: 'Michael', lastName: 'Rodriguez', city: 'San Jose', zip: '95113' },
  { firstName: 'Sophia', lastName: 'Martinez', city: 'Berkeley', zip: '94704' }
]

const jointNames = [
  {
    firstName: 'David', lastName: 'Chen', city: 'Los Angeles', zip: '90001',
    joint: { firstName: 'Lisa', lastName: 'Chen', email: 'lisa.chen@example.com' }
  },
  {
    firstName: 'Jennifer', lastName: 'Brown', city: 'Pasadena', zip: '91101',
    joint: { firstName: 'Mark', lastName: 'Brown', email: 'mark.brown@example.com' }
  },
  {
    firstName: 'Christopher', lastName: 'Wilson', city: 'Santa Monica', zip: '90401',
    joint: { firstName: 'Amanda', lastName: 'Wilson', email: 'amanda.wilson@example.com' }
  },
  {
    firstName: 'Ashley', lastName: 'Taylor', city: 'Long Beach', zip: '90802',
    joint: { firstName: 'Ryan', lastName: 'Taylor', email: 'ryan.taylor@example.com' }
  }
]

const entityNames = [
  { firstName: 'Robert', lastName: 'Johnson', city: 'San Diego', zip: '92101', entityName: 'Johnson Ventures LLC' },
  { firstName: 'Patricia', lastName: 'Garcia', city: 'Irvine', zip: '92602', entityName: 'Garcia Holdings LLC' },
  { firstName: 'Daniel', lastName: 'Lee', city: 'Carlsbad', zip: '92008', entityName: 'Lee Capital LLC' },
  { firstName: 'Michelle', lastName: 'White', city: 'La Jolla', zip: '92037', entityName: 'White Investments LLC' }
]

const iraNames = [
  { firstName: 'William', lastName: 'Davis', city: 'Sacramento', zip: '95814', custodian: 'Fidelity Investments' },
  { firstName: 'Elizabeth', lastName: 'Moore', city: 'Roseville', zip: '95661', custodian: 'Charles Schwab' }
]

const specialNames = [
  { firstName: 'Alex', lastName: 'Turner', city: 'Fresno', zip: '93650' },
  { firstName: 'Maria', lastName: 'Gonzalez', city: 'Bakersfield', zip: '93301' },
  { firstName: 'Kevin', lastName: 'O\'Brien', city: 'Modesto', zip: '95350' }
]

let individualIndex = 0
let jointIndex = 0
let entityIndex = 0
let iraIndex = 0
let specialIndex = 0

// Generate test data for each account type
function generateAccountData(accountType, paymentFreq, lockup) {
  const baseSSN = Math.floor(Math.random() * 900000000) + 100000000
  const ssnFormatted = `${String(baseSSN).slice(0, 3)}-${String(baseSSN).slice(3, 5)}-${String(baseSSN).slice(5)}`
  const baseDOB = new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28))
  const dobFormatted = baseDOB.toISOString().split('T')[0]

  if (accountType === 'individual') {
    const person = individualNames[individualIndex % individualNames.length]
    individualIndex++
    return {
      firstName: person.firstName,
      lastName: person.lastName,
      dob: dobFormatted,
      ssn: ssnFormatted,
      phoneNumber: `555-01${String(individualIndex).padStart(2, '0')}`,
      address: {
        street1: `${100 + individualIndex * 10} ${person.lastName} St`,
        city: person.city,
        state: 'CA',
        zip: person.zip
      }
    }
  }

  if (accountType === 'joint') {
    const couple = jointNames[jointIndex % jointNames.length]
    jointIndex++
    const jointSSN = Math.floor(Math.random() * 900000000) + 100000000
    const jointSsnFormatted = `${String(jointSSN).slice(0, 3)}-${String(jointSSN).slice(3, 5)}-${String(jointSSN).slice(5)}`
    const jointDOB = new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28))
    const jointDobFormatted = jointDOB.toISOString().split('T')[0]

    return {
      firstName: couple.firstName,
      lastName: couple.lastName,
      dob: dobFormatted,
      ssn: ssnFormatted,
      phoneNumber: `555-02${String(jointIndex).padStart(2, '0')}`,
      address: {
        street1: `${200 + jointIndex * 10} ${couple.lastName} Ave`,
        city: couple.city,
        state: 'CA',
        zip: couple.zip
      },
      jointHolder: {
        firstName: couple.joint.firstName,
        lastName: couple.joint.lastName,
        email: couple.joint.email,
        dob: jointDobFormatted,
        ssn: jointSsnFormatted,
        phoneNumber: `555-03${String(jointIndex).padStart(2, '0')}`
      },
      jointHoldingType: 'joint-tenants'
    }
  }

  if (accountType === 'entity') {
    const person = entityNames[entityIndex % entityNames.length]
    entityIndex++
    const taxId = `${10 + entityIndex}-${3456780 + entityIndex}`

    return {
      firstName: person.firstName,
      lastName: person.lastName,
      dob: dobFormatted,
      ssn: ssnFormatted,
      phoneNumber: `555-04${String(entityIndex).padStart(2, '0')}`,
      address: {
        street1: `${300 + entityIndex * 10} ${person.lastName} Blvd`,
        city: person.city,
        state: 'CA',
        zip: person.zip
      },
      entity: {
        entityType: 'LLC',
        entityName: person.entityName,
        entityFormation: 'Delaware',
        taxId: taxId
      }
    }
  }

  if (accountType === 'ira') {
    const person = iraNames[iraIndex % iraNames.length]
    iraIndex++

    return {
      firstName: person.firstName,
      lastName: person.lastName,
      dob: dobFormatted,
      ssn: ssnFormatted,
      phoneNumber: `555-05${String(iraIndex).padStart(2, '0')}`,
      address: {
        street1: `${400 + iraIndex * 10} ${person.lastName} Dr`,
        city: person.city,
        state: 'CA',
        zip: person.zip
      },
      ira: {
        accountType: lockup === '3-year' ? 'roth' : 'traditional',
        custodian: person.custodian,
        accountNumber: `IRA-${100000000 + iraIndex}`
      }
    }
  }
}

// Generate special account data (for unverified, no-investment, multi-investment)
function generateSpecialAccountData() {
  const person = specialNames[specialIndex % specialNames.length]
  specialIndex++
  const baseSSN = Math.floor(Math.random() * 900000000) + 100000000
  const ssnFormatted = `${String(baseSSN).slice(0, 3)}-${String(baseSSN).slice(3, 5)}-${String(baseSSN).slice(5)}`
  const baseDOB = new Date(1970 + Math.floor(Math.random() * 35), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28))
  const dobFormatted = baseDOB.toISOString().split('T')[0]

  return {
    firstName: person.firstName,
    lastName: person.lastName,
    dob: dobFormatted,
    ssn: ssnFormatted,
    phoneNumber: `555-09${String(specialIndex).padStart(2, '0')}`,
    address: {
      street1: `${900 + specialIndex * 10} ${person.lastName} Way`,
      city: person.city,
      state: 'CA',
      zip: person.zip
    }
  }
}

// Generate investment amounts (varied for realism, max $200K)
const amounts = [1000, 5000, 10000, 25000, 50000, 75000, 100000, 150000, 200000]

function getAmountForIndex(index) {
  return amounts[index % amounts.length]
}

// Create test user
function createTestUser(userId, accountType, paymentFreq, lockup, index) {
  const timestamp = getTimestamp()
  const accountData = generateAccountData(accountType, paymentFreq, lockup)
  const email = `${accountType}.${paymentFreq}.${lockup.replace('-year', 'y')}@test.com`
  const amount = getAmountForIndex(index)

  const user = {
    id: userId,
    email: email,
    firstName: accountData.firstName,
    lastName: accountData.lastName,
    phoneNumber: accountData.phoneNumber,
    dob: accountData.dob,
    ssn: accountData.ssn,
    password: 'Test1234!',
    address: accountData.address,
    accountType: accountType,
    verificationCode: '123456',
    isVerified: true,
    verifiedAt: timestamp,
    isAdmin: false,
    bankAccounts: [
      {
        id: `BANK-${userId}`,
        accountHolder: `${accountData.firstName} ${accountData.lastName}`,
        routingNumber: '123456789',
        accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        accountType: 'checking',
        isPrimary: true,
        addedAt: timestamp
      }
    ],
    investments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    activity: [
      {
        id: generateTransactionId('USR', userId, 'account_created'),
        type: 'account_created',
        date: timestamp
      }
    ]
  }

  // Add account-type-specific fields
  if (accountType === 'joint') {
    user.jointHolder = accountData.jointHolder
    user.jointHoldingType = accountData.jointHoldingType
  } else if (accountType === 'entity') {
    user.entity = accountData.entity
  } else if (accountType === 'ira') {
    user.ira = accountData.ira
  }

  return user
}

// Create investment for user
function createInvestment(investmentId, userId, accountType, paymentFreq, lockup, amount) {
  const timestamp = getTimestamp()

  // IRA accounts cannot have monthly payment frequency
  const actualPaymentFreq = accountType === 'ira' && paymentFreq === 'monthly'
    ? 'compounding'
    : paymentFreq

  // Calculate bonds (amount / 10)
  const bonds = Math.floor(amount / 10)

  // Calculate maturity date (lockupEndDate)
  const timestampDate = new Date(timestamp)
  const lockupYears = lockup === '3-year' ? 3 : 1
  const lockupEndDate = new Date(timestampDate)
  lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)

  const investment = {
    id: investmentId,
    amount: amount,
    bonds: bonds,
    paymentFrequency: actualPaymentFreq,
    lockupPeriod: lockup,
    accountType: accountType,
    status: 'active', // Auto-approved
    investmentDate: timestamp,
    submittedAt: timestamp,
    confirmedAt: timestamp, // Critical: used for interest calculations
    lockupEndDate: lockupEndDate.toISOString(),
    earningsMethod: actualPaymentFreq === 'monthly' ? 'bank-account' : 'compounding',
    // Dual approval fields - auto-approved by system
    bankApproved: true,
    bankApprovedBy: 'system',
    bankApprovedAt: timestamp,
    adminApproved: true,
    adminApprovedBy: 'system',
    adminApprovedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  // Add payout details for monthly accounts
  if (actualPaymentFreq === 'monthly') {
    investment.payoutDetails = {
      accountHolder: 'Test Account',
      routingNumber: '123456789',
      accountNumber: '9876543210',
      accountType: 'checking'
    }
  }

  return investment
}

// Main seed function
export async function seedTestAccounts() {
  console.log('🌱 Starting test account seeding...')
  console.log('📁 Target: Netlify Blobs or local data/users.json\n')

  // Read existing users
  let usersData = await getUsers()
  if (!usersData || !usersData.users) {
    usersData = { users: [] }
  }

  // Remove existing test accounts
  const originalCount = usersData.users.length
  usersData.users = usersData.users.filter(u => !u.email.includes('@test.com'))
  const removed = originalCount - usersData.users.length
  if (removed > 0) {
    console.log(`🗑️  Removed ${removed} existing test accounts\n`)
  }

  let userCounter = usersData.users.length + 1
  let investmentCounter = 0
  let createdCount = 0

  // Temporary arrays to hold accounts by type
  const individualAccounts = []
  const jointAccounts = []
  const entityAccounts = []
  const iraAccounts = []
  const specialAccounts = []

  // Generate accounts for all combinations
  for (const accountType of accountTypes) {
    for (const paymentFreq of paymentFrequencies) {
      for (const lockup of lockupPeriods) {
        // Skip monthly IRA combinations (not allowed)
        if (accountType === 'ira' && paymentFreq === 'monthly') {
          console.log(`⏭️  Skipping ${accountType} with monthly payment (not allowed)`)
          continue
        }

        const userId = generateUserId(userCounter)
        const investmentId = generateInvestmentId(investmentCounter)
        const amount = getAmountForIndex(createdCount)

        // Create user
        const user = createTestUser(userId, accountType, paymentFreq, lockup, createdCount)

        // Create investment
        const investment = createInvestment(investmentId, userId, accountType, paymentFreq, lockup, amount)
        user.investments.push(investment)

        // Add investment activities
        user.activity.push({
          id: generateTransactionId('INV', investmentId, 'created'),
          type: 'investment_created',
          investmentId: investmentId,
          amount: amount,
          date: investment.createdAt
        })
        
        // Add investment confirmed activity (auto-approved)
        user.activity.push({
          id: generateTransactionId('INV', investmentId, 'confirmed'),
          type: 'investment_confirmed',
          investmentId: investmentId,
          amount: amount,
          date: investment.confirmedAt
        })

        // Add to appropriate array
        if (accountType === 'individual') {
          individualAccounts.push(user)
        } else if (accountType === 'joint') {
          jointAccounts.push(user)
        } else if (accountType === 'entity') {
          entityAccounts.push(user)
        } else if (accountType === 'ira') {
          iraAccounts.push(user)
        }

        console.log(`✅ Created: ${user.email}`)
        console.log(`   Name: ${user.firstName} ${user.lastName} | Account: ${accountType.padEnd(10)} | Payment: ${paymentFreq.padEnd(12)} | Lockup: ${lockup.padEnd(7)} | Amount: $${amount.toLocaleString()}`)

        userCounter++
        investmentCounter++
        createdCount++
      }
    }
    console.log('')
  }

  // Add a few special case accounts
  console.log('Adding special case accounts...\n')

  // Unverified account
  const unverifiedId = generateUserId(userCounter)
  const unverifiedData = generateSpecialAccountData()
  const unverifiedTimestamp = getTimestamp()
  const unverifiedUser = {
    id: unverifiedId,
    email: 'unverified@test.com',
    firstName: unverifiedData.firstName,
    lastName: unverifiedData.lastName,
    phoneNumber: unverifiedData.phoneNumber,
    dob: unverifiedData.dob,
    ssn: unverifiedData.ssn,
    password: 'Test1234!',
    address: unverifiedData.address,
    accountType: 'individual',
    verificationCode: '123456',
    isVerified: false,
    verifiedAt: null,
    isAdmin: false,
    bankAccounts: [],
    investments: [],
    createdAt: unverifiedTimestamp,
    updatedAt: unverifiedTimestamp,
    activity: [
      {
        id: generateTransactionId('USR', unverifiedId, 'account_created'),
        type: 'account_created',
        date: unverifiedTimestamp
      }
    ]
  }
  specialAccounts.push(unverifiedUser)
  console.log(`✅ Created: ${unverifiedUser.email} (${unverifiedData.firstName} ${unverifiedData.lastName} - unverified)`)
  userCounter++

  // Account with no investments
  const noInvestmentId = generateUserId(userCounter)
  const noInvestmentData = generateSpecialAccountData()
  const noInvestmentTimestamp = getTimestamp()
  const noInvestmentUser = {
    id: noInvestmentId,
    email: 'no-investment@test.com',
    firstName: noInvestmentData.firstName,
    lastName: noInvestmentData.lastName,
    phoneNumber: noInvestmentData.phoneNumber,
    dob: noInvestmentData.dob,
    ssn: noInvestmentData.ssn,
    password: 'Test1234!',
    address: noInvestmentData.address,
    accountType: 'individual',
    verificationCode: '123456',
    isVerified: true,
    verifiedAt: noInvestmentTimestamp,
    isAdmin: false,
    bankAccounts: [
      {
        id: `BANK-${noInvestmentId}`,
        accountHolder: `${noInvestmentData.firstName} ${noInvestmentData.lastName}`,
        routingNumber: '123456789',
        accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        accountType: 'checking',
        isPrimary: true,
        addedAt: noInvestmentTimestamp
      }
    ],
    investments: [],
    createdAt: noInvestmentTimestamp,
    updatedAt: noInvestmentTimestamp,
    activity: [
      {
        id: generateTransactionId('USR', noInvestmentId, 'account_created'),
        type: 'account_created',
        date: noInvestmentTimestamp
      }
    ]
  }
  specialAccounts.push(noInvestmentUser)
  console.log(`✅ Created: ${noInvestmentUser.email} (${noInvestmentData.firstName} ${noInvestmentData.lastName} - no investments)`)
  userCounter++

  // Account with multiple investments
  const multiInvestmentId = generateUserId(userCounter)
  const multiInvestmentData = generateSpecialAccountData()
  const multiInvestmentTimestamp = getTimestamp()
  const multiInvestmentUser = {
    id: multiInvestmentId,
    email: 'multi-investment@test.com',
    firstName: multiInvestmentData.firstName,
    lastName: multiInvestmentData.lastName,
    phoneNumber: multiInvestmentData.phoneNumber,
    dob: multiInvestmentData.dob,
    ssn: multiInvestmentData.ssn,
    password: 'Test1234!',
    address: multiInvestmentData.address,
    accountType: 'individual',
    verificationCode: '123456',
    isVerified: true,
    verifiedAt: multiInvestmentTimestamp,
    isAdmin: false,
    bankAccounts: [
      {
        id: `BANK-${multiInvestmentId}`,
        accountHolder: `${multiInvestmentData.firstName} ${multiInvestmentData.lastName}`,
        routingNumber: '123456789',
        accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        accountType: 'checking',
        isPrimary: true,
        addedAt: multiInvestmentTimestamp
      }
    ],
    investments: [],
    createdAt: multiInvestmentTimestamp,
    updatedAt: multiInvestmentTimestamp,
    activity: [
      {
        id: generateTransactionId('USR', multiInvestmentId, 'account_created'),
        type: 'account_created',
        date: multiInvestmentTimestamp
      }
    ]
  }

  for (let i = 0; i < 3; i++) {
    const invId = generateInvestmentId(investmentCounter)
    const inv = createInvestment(
      invId,
      multiInvestmentId,
      'individual',
      i % 2 === 0 ? 'compounding' : 'monthly',
      i % 2 === 0 ? '1-year' : '3-year',
      getAmountForIndex(i)
    )
    multiInvestmentUser.investments.push(inv)
    
    // Add investment activities
    multiInvestmentUser.activity.push({
      id: generateTransactionId('INV', invId, 'created'),
      type: 'investment_created',
      investmentId: invId,
      amount: inv.amount,
      date: inv.createdAt
    })
    
    multiInvestmentUser.activity.push({
      id: generateTransactionId('INV', invId, 'confirmed'),
      type: 'investment_confirmed',
      investmentId: invId,
      amount: inv.amount,
      date: inv.confirmedAt
    })
    
    investmentCounter++
  }
  specialAccounts.push(multiInvestmentUser)
  console.log(`✅ Created: ${multiInvestmentUser.email} (${multiInvestmentData.firstName} ${multiInvestmentData.lastName} - 3 investments)`)
  userCounter++

  // Add all accounts in the correct order: individual (including special) → joint → entity → ira
  console.log('\n📝 Organizing accounts in order...\n')
  const orderedAccounts = [
    ...individualAccounts,
    ...specialAccounts,
    ...jointAccounts,
    ...entityAccounts,
    ...iraAccounts
  ]

  // Reassign sequential IDs to maintain proper order
  const baseCounter = usersData.users.length + 1
  orderedAccounts.forEach((account, index) => {
    const oldId = account.id
    const newId = generateUserId(baseCounter + index)

    // Update user ID
    account.id = newId

    // Update activity transaction IDs that reference the user ID
    account.activity.forEach(activity => {
      if (activity.id.includes(oldId.replace('USR-', ''))) {
        activity.id = activity.id.replace(oldId.replace('USR-', ''), newId.replace('USR-', ''))
      }
    })
  })

  usersData.users.push(...orderedAccounts)

  // Save users data
  const saved = await saveUsers(usersData)
  
  if (!saved) {
    throw new Error('Failed to save users data')
  }

  console.log(`\n✨ Seeding complete!`)
  console.log(`📊 Total accounts created: ${usersData.users.length}`)
  console.log(`💾 Data saved successfully\n`)

  // Print summary
  console.log('📋 Account Summary:')
  console.log('─'.repeat(60))
  accountTypes.forEach(type => {
    const count = usersData.users.filter(u => u.accountType === type).length
    console.log(`   ${type.padEnd(12)}: ${count} accounts`)
  })
  console.log('─'.repeat(60))

  console.log('\n🔑 All test accounts use password: Test1234!')
  console.log('\n💡 To reset/reseed, simply run this script again\n')
}

export default seedTestAccounts

