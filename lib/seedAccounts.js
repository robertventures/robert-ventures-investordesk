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

// Generate varied timestamps for realistic testing
// Spreads accounts across the last 90 days, with older accounts having earlier timestamps
function getVariedTimestamp(index, totalAccounts) {
  const now = new Date()
  // Spread accounts across last 90 days (3 months)
  // Earlier accounts get older dates, later accounts get newer dates
  const daysAgo = Math.floor((totalAccounts - index) * (90 / totalAccounts))
  const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000))
  // Add some randomness (±6 hours) to make it more realistic
  const randomOffset = (Math.random() - 0.5) * 12 * 60 * 60 * 1000
  return new Date(timestamp.getTime() + randomOffset).toISOString()
}

// Realistic test names pool
const individualNames = [
  { firstName: 'James', lastName: 'Anderson', city: 'San Francisco', state: 'California', zip: '94102' },
  { firstName: 'Emma', lastName: 'Thompson', city: 'Oakland', state: 'California', zip: '94601' },
  { firstName: 'Michael', lastName: 'Rodriguez', city: 'San Jose', state: 'California', zip: '95113' },
  { firstName: 'Sophia', lastName: 'Martinez', city: 'Berkeley', state: 'California', zip: '94704' }
]

const jointNames = [
  {
    firstName: 'David', lastName: 'Chen', city: 'Los Angeles', state: 'California', zip: '90001',
    joint: { firstName: 'Lisa', lastName: 'Chen', email: 'lisa.chen@example.com' }
  },
  {
    firstName: 'Jennifer', lastName: 'Brown', city: 'Pasadena', state: 'California', zip: '91101',
    joint: { firstName: 'Mark', lastName: 'Brown', email: 'mark.brown@example.com' }
  },
  {
    firstName: 'Christopher', lastName: 'Wilson', city: 'Santa Monica', state: 'California', zip: '90401',
    joint: { firstName: 'Amanda', lastName: 'Wilson', email: 'amanda.wilson@example.com' }
  },
  {
    firstName: 'Ashley', lastName: 'Taylor', city: 'Long Beach', state: 'California', zip: '90802',
    joint: { firstName: 'Ryan', lastName: 'Taylor', email: 'ryan.taylor@example.com' }
  }
]

const entityNames = [
  { firstName: 'Robert', lastName: 'Johnson', city: 'San Diego', state: 'California', zip: '92101', entityName: 'Johnson Ventures LLC' },
  { firstName: 'Patricia', lastName: 'Garcia', city: 'Irvine', state: 'California', zip: '92602', entityName: 'Garcia Holdings LLC' },
  { firstName: 'Daniel', lastName: 'Lee', city: 'Carlsbad', state: 'California', zip: '92008', entityName: 'Lee Capital LLC' },
  { firstName: 'Michelle', lastName: 'White', city: 'La Jolla', state: 'California', zip: '92037', entityName: 'White Investments LLC' }
]

const iraNames = [
  { firstName: 'William', lastName: 'Davis', city: 'Sacramento', state: 'California', zip: '95814', custodian: 'Fidelity Investments' },
  { firstName: 'Elizabeth', lastName: 'Moore', city: 'Roseville', state: 'California', zip: '95661', custodian: 'Charles Schwab' }
]

const specialNames = [
  { firstName: 'Alex', lastName: 'Turner', city: 'Fresno', state: 'California', zip: '93650' },
  { firstName: 'Maria', lastName: 'Gonzalez', city: 'Bakersfield', state: 'California', zip: '93301' },
  { firstName: 'Kevin', lastName: 'O\'Brien', city: 'Modesto', state: 'California', zip: '95350' }
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
      phoneNumber: `+1555010${String(individualIndex).padStart(4, '0')}`,
      address: {
        street1: `${100 + individualIndex * 10} ${person.lastName} St`,
        city: person.city,
        state: person.state,
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
      phoneNumber: `+1555020${String(jointIndex).padStart(4, '0')}`,
      address: {
        street1: `${200 + jointIndex * 10} ${couple.lastName} Ave`,
        city: couple.city,
        state: couple.state,
        zip: couple.zip
      },
      jointHolder: {
        firstName: couple.joint.firstName,
        lastName: couple.joint.lastName,
        email: couple.joint.email,
        dob: jointDobFormatted,
        ssn: jointSsnFormatted,
        phoneNumber: `+1555030${String(jointIndex).padStart(4, '0')}`,
        address: {
          street1: `${200 + jointIndex * 10} ${couple.lastName} Ave`,
          city: couple.city,
          state: couple.state,
          zip: couple.zip
        }
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
      phoneNumber: `+1555040${String(entityIndex).padStart(4, '0')}`,
      address: {
        street1: `${300 + entityIndex * 10} ${person.lastName} Blvd`,
        city: person.city,
        state: person.state,
        zip: person.zip
      },
      entity: {
        entityType: 'LLC',
        name: person.entityName,
        registrationDate: dobFormatted, // Using DOB as entity registration date for simplicity
        taxId: taxId,
        address: {
          street1: `${300 + entityIndex * 10} ${person.lastName} Blvd`,
          city: person.city,
          state: person.state,
          zip: person.zip,
          country: 'United States'
        }
      },
      authorizedRepresentative: {
        firstName: person.firstName,
        lastName: person.lastName,
        dob: dobFormatted,
        ssn: ssnFormatted,
        address: {
          street1: `${300 + entityIndex * 10} ${person.lastName} Blvd`,
          city: person.city,
          state: person.state,
          zip: person.zip,
          country: 'United States'
        }
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
      phoneNumber: `+1555050${String(iraIndex).padStart(4, '0')}`,
      address: {
        street1: `${400 + iraIndex * 10} ${person.lastName} Dr`,
        city: person.city,
        state: person.state,
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
    phoneNumber: `+1555090${String(specialIndex).padStart(4, '0')}`,
    address: {
      street1: `${900 + specialIndex * 10} ${person.lastName} Way`,
      city: person.city,
      state: person.state,
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
function createTestUser(userId, accountType, paymentFreq, lockup, index, totalAccounts) {
  const accountData = generateAccountData(accountType, paymentFreq, lockup)
  const email = `${accountType}.${paymentFreq}.${lockup.replace('-year', 'y')}@test.com`
  const amount = getAmountForIndex(index)

  // Create account creation timestamp with temporal variety
  // Earlier accounts get older dates for realistic testing
  const timestamp = getVariedTimestamp(index, totalAccounts)
  const accountCreatedTime = new Date(timestamp)
  const accountCreatedTimestamp = accountCreatedTime.toISOString()

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
    verifiedAt: accountCreatedTimestamp,
    isAdmin: false,
    bankAccounts: [
      {
        id: `BANK-${userId}`,
        accountHolder: `${accountData.firstName} ${accountData.lastName}`,
        routingNumber: '123456789',
        accountNumber: `${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        accountType: 'checking',
        isPrimary: true,
        addedAt: accountCreatedTimestamp
      }
    ],
    investments: [],
    createdAt: accountCreatedTimestamp,
    updatedAt: accountCreatedTimestamp,
    activity: [
      {
        id: generateTransactionId('USR', userId, 'account_created'),
        type: 'account_created',
        date: accountCreatedTimestamp
      }
    ]
  }

  // Add account-type-specific fields
  if (accountType === 'joint') {
    user.jointHolder = accountData.jointHolder
    user.jointHoldingType = accountData.jointHoldingType
  } else if (accountType === 'entity') {
    user.entity = accountData.entity
    user.authorizedRepresentative = accountData.authorizedRepresentative
  } else if (accountType === 'ira') {
    user.ira = accountData.ira
  }

  return user
}

// Create investment for user
function createInvestment(investmentId, userId, accountType, paymentFreq, lockup, amount, accountCreatedTimestamp) {
  // Create investment timestamps with proper offsets from account creation
  const accountCreatedTime = new Date(accountCreatedTimestamp)
  
  // Investment created 5 seconds after account
  const investmentCreatedTime = new Date(accountCreatedTime.getTime() + 5000)
  const investmentCreatedTimestamp = investmentCreatedTime.toISOString()
  
  // Investment approved 7.5 seconds after account (2.5 seconds after created)
  const investmentApprovedTime = new Date(accountCreatedTime.getTime() + 7500)
  const investmentApprovedTimestamp = investmentApprovedTime.toISOString()
  
  // Investment confirmed 10 seconds after account (2.5 seconds after approved)
  const investmentConfirmedTime = new Date(accountCreatedTime.getTime() + 10000)
  const investmentConfirmedTimestamp = investmentConfirmedTime.toISOString()

  // ira accounts cannot have monthly payment frequency
  const actualPaymentFreq = accountType === 'ira' && paymentFreq === 'monthly'
    ? 'compounding'
    : paymentFreq

  // Calculate bonds (amount / 10)
  const bonds = Math.floor(amount / 10)

  // Calculate maturity date (lockupEndDate)
  const lockupYears = lockup === '3-year' ? 3 : 1
  const lockupEndDate = new Date(investmentConfirmedTime)
  lockupEndDate.setFullYear(lockupEndDate.getFullYear() + lockupYears)

  const investment = {
    id: investmentId,
    amount: amount,
    bonds: bonds,
    paymentFrequency: actualPaymentFreq,
    lockupPeriod: lockup,
    accountType: accountType,
    status: 'active', // Auto-approved
    investmentDate: investmentConfirmedTimestamp,
    submittedAt: investmentCreatedTimestamp,
    confirmedAt: investmentConfirmedTimestamp, // Critical: used for interest calculations
    lockupEndDate: lockupEndDate.toISOString(),
    earningsMethod: actualPaymentFreq === 'monthly' ? 'bank-account' : 'compounding',
    // Dual approval fields - auto-approved by system
    bankApproved: true,
    bankApprovedBy: 'system',
    bankApprovedAt: investmentApprovedTimestamp,
    adminApproved: true,
    adminApprovedBy: 'system',
    adminApprovedAt: investmentApprovedTimestamp,
    createdAt: investmentCreatedTimestamp,
    updatedAt: investmentConfirmedTimestamp,
    // Return timestamps for activity events
    _investmentCreatedTimestamp: investmentCreatedTimestamp,
    _investmentApprovedTimestamp: investmentApprovedTimestamp,
    _investmentConfirmedTimestamp: investmentConfirmedTimestamp
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

  // Remove existing test accounts (NEVER removes admin accounts)
  const originalCount = usersData.users.length
  usersData.users = usersData.users.filter(u => {
    // ALWAYS keep admin accounts
    if (u.isAdmin) {
      return true
    }
    // Remove test accounts (@test.com emails)
    return !u.email.includes('@test.com')
  })
  const removed = originalCount - usersData.users.length
  if (removed > 0) {
    console.log(`🗑️  Removed ${removed} existing test accounts\n`)
  }

  let userCounter = usersData.users.length + 1
  let investmentCounter = 0
  let createdCount = 0

  // Calculate total accounts that will be created for temporal distribution
  // 4 account types × 2 payment frequencies × 2 lockup periods = 16 accounts
  // But ira can't use monthly, so: (3 × 2 × 2) + (1 × 1 × 2) = 14 accounts
  // Plus 3 special accounts = 17 total
  const totalAccounts = 17

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
        // Skip monthly ira combinations (not allowed)
        if (accountType === 'ira' && paymentFreq === 'monthly') {
          console.log(`⏭️  Skipping ${accountType} with monthly payment (not allowed)`)
          continue
        }

        const userId = generateUserId(userCounter)
        const investmentId = generateInvestmentId(investmentCounter)
        const amount = getAmountForIndex(createdCount)

        // Create user with temporal variety
        const user = createTestUser(userId, accountType, paymentFreq, lockup, createdCount, totalAccounts)

        // Create investment (pass account created timestamp for proper time offsets)
        const investment = createInvestment(investmentId, userId, accountType, paymentFreq, lockup, amount, user.createdAt)
        
        // Extract timestamps before removing them
        const investmentCreatedTimestamp = investment._investmentCreatedTimestamp
        const investmentApprovedTimestamp = investment._investmentApprovedTimestamp
        const investmentConfirmedTimestamp = investment._investmentConfirmedTimestamp
        delete investment._investmentCreatedTimestamp
        delete investment._investmentApprovedTimestamp
        delete investment._investmentConfirmedTimestamp
        
        user.investments.push(investment)

        // Add investment activities with proper timestamps
        user.activity.push({
          id: generateTransactionId('INV', investmentId, 'created'),
          type: 'investment_created',
          investmentId: investmentId,
          date: investmentCreatedTimestamp
        })
        
        // Add investment approved activity
        user.activity.push({
          id: generateTransactionId('INV', investmentId, 'approved'),
          type: 'investment_approved',
          investmentId: investmentId,
          date: investmentApprovedTimestamp
        })
        
        // Add investment confirmed activity
        user.activity.push({
          id: generateTransactionId('INV', investmentId, 'confirmed'),
          type: 'investment_confirmed',
          investmentId: investmentId,
          amount: amount,
          date: investmentConfirmedTimestamp
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
  const unverifiedTimestamp = getVariedTimestamp(createdCount, totalAccounts)
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
  createdCount++

  // Account with no investments
  const noInvestmentId = generateUserId(userCounter)
  const noInvestmentData = generateSpecialAccountData()
  const noInvestmentTimestamp = getVariedTimestamp(createdCount, totalAccounts)
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
  createdCount++

  // Account with multiple investments
  const multiInvestmentId = generateUserId(userCounter)
  const multiInvestmentData = generateSpecialAccountData()
  const multiInvestmentTimestamp = getVariedTimestamp(createdCount, totalAccounts)
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
    
    // Add additional time offset for multiple investments (30 seconds between each)
    const baseTime = new Date(multiInvestmentTimestamp)
    const investmentBaseTime = new Date(baseTime.getTime() + (i * 30000))
    
    const inv = createInvestment(
      invId,
      multiInvestmentId,
      'individual',
      i % 2 === 0 ? 'compounding' : 'monthly',
      i % 2 === 0 ? '1-year' : '3-year',
      getAmountForIndex(i),
      investmentBaseTime.toISOString()
    )
    
    // Extract timestamps before removing them
    const investmentCreatedTimestamp = inv._investmentCreatedTimestamp
    const investmentApprovedTimestamp = inv._investmentApprovedTimestamp
    const investmentConfirmedTimestamp = inv._investmentConfirmedTimestamp
    delete inv._investmentCreatedTimestamp
    delete inv._investmentApprovedTimestamp
    delete inv._investmentConfirmedTimestamp
    
    multiInvestmentUser.investments.push(inv)
    
    // Add investment activities with proper timestamps
    multiInvestmentUser.activity.push({
      id: generateTransactionId('INV', invId, 'created'),
      type: 'investment_created',
      investmentId: invId,
      date: investmentCreatedTimestamp
    })
    
    multiInvestmentUser.activity.push({
      id: generateTransactionId('INV', invId, 'approved'),
      type: 'investment_approved',
      investmentId: invId,
      date: investmentApprovedTimestamp
    })
    
    multiInvestmentUser.activity.push({
      id: generateTransactionId('INV', invId, 'confirmed'),
      type: 'investment_confirmed',
      investmentId: invId,
      amount: inv.amount,
      date: investmentConfirmedTimestamp
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

