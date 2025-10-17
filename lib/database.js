import fs from 'fs'
import path from 'path'
import { getStore } from '@netlify/blobs'
import { generateUserId, generateTransactionId } from './idGenerator.js'
import { encrypt, decrypt, isEncrypted } from './encryption.js'
import { getCurrentAppTime } from './appTime.js'

const dataDir = path.join(process.cwd(), 'data')
const usersFile = path.join(dataDir, 'users.json')
const isNetlify = process.env.NETLIFY === 'true'
const useBlobs = isNetlify || process.env.NODE_ENV === 'production'

async function initializeLocalDatabase() {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    if (!fs.existsSync(usersFile)) {
      fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2))
      console.log('Database initialized at:', usersFile)
    }
  } catch (error) {
    console.error('Error initializing database:', error)
  }
}

function getBlobStore() {
  // Netlify automatically injects credentials at runtime
  return getStore({ name: 'users' })
}

// Read users with retry logic for eventual consistency
export async function getUsers(retries = 2, delayMs = 300, expectedTimestamp = null) {
  try {
    if (useBlobs) {
      const store = getBlobStore()
      let data = await store.get('users.json', { type: 'json' })
      if (!data && typeof store.getJSON === 'function') {
        try {
          data = await store.getJSON('users.json')
        } catch (e) {
          console.error('getJSON failed, falling back to empty users:', e)
        }
      }
      
      // If no data found and retries remain, retry after delay
      if (!data && retries > 0) {
        console.log(`No data found in Netlify Blobs, retrying in ${delayMs}ms (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return getUsers(retries - 1, delayMs, expectedTimestamp)
      }
      
      // If we're expecting a specific timestamp (after a write) and the data is stale, retry
      if (expectedTimestamp && data?.lastModified && data.lastModified < expectedTimestamp && retries > 0) {
        console.log(`Stale data detected (expected: ${expectedTimestamp}, got: ${data.lastModified}), retrying in ${delayMs}ms (${retries} retries left)`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        return getUsers(retries - 1, delayMs, expectedTimestamp)
      }
      
      return data || { users: [] }
    }
    await initializeLocalDatabase()
    const data = fs.readFileSync(usersFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading users data:', error)
    return { users: [] }
  }
}

// Save users with consistency verification
export async function saveUsers(usersData) {
  try {
    if (useBlobs) {
      // Add timestamp to track data freshness for consistency checks
      const saveTimestamp = Date.now()
      const dataWithTimestamp = {
        ...usersData,
        lastModified: saveTimestamp
      }
      
      const store = getBlobStore()
      if (typeof store.setJSON === 'function') {
        await store.setJSON('users.json', dataWithTimestamp)
      } else {
        await store.set('users.json', JSON.stringify(dataWithTimestamp, null, 2), { contentType: 'application/json' })
      }
      console.log('Users data saved to Netlify Blobs:', {
        userCount: usersData.users?.length || 0,
        lastUserId: usersData.users?.[usersData.users.length - 1]?.id || 'none',
        timestamp: saveTimestamp
      })
      
      // Optimized consistency verification with shorter delays
      // Using 2 retries with 300ms delays for faster performance (max 600ms delay)
      const verification = await getUsers(2, 300, saveTimestamp)
      
      if (!verification || !verification.lastModified) {
        console.warn('⚠️  Consistency verification inconclusive - legacy data or verification failed')
        // Shorter fallback delay for better UX (500ms instead of 2000ms)
        await new Promise(resolve => setTimeout(resolve, 500))
      } else if (verification.lastModified < saveTimestamp) {
        console.warn('⚠️  Consistency verification failed - stale data detected')
        // Shorter fallback delay
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        console.log('✓ Consistency verification passed - data is up to date')
      }
      
      return true
    }
    await initializeLocalDatabase()
    fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2))
    console.log('Users data saved locally')
    return true
  } catch (error) {
    console.error('Error saving users data:', error)
    return false
  }
}

// Add a new user
export async function addUser(userData) {
  const usersData = await getUsers()

  const normalizedEmail = userData.email.toLowerCase().trim()

  const existingUser = usersData.users.find(user => user.email.toLowerCase().trim() === normalizedEmail)
  if (existingUser) {
    console.log('Duplicate user detected at database level:', normalizedEmail)
    return { success: false, error: 'User with this email already exists' }
  }

  // Generate next sequential user ID
  const userId = await generateUserId()
  // Use app time (Time Machine) for timestamps
  const appTime = await getCurrentAppTime()
  const timestamp = appTime || new Date().toISOString()

  // Encrypt SSN if provided and not already encrypted
  let encryptedSSN = userData.ssn || ''
  if (encryptedSSN && !isEncrypted(encryptedSSN)) {
    try {
      encryptedSSN = encrypt(encryptedSSN)
      console.log('SSN encrypted for new user:', normalizedEmail)
    } catch (error) {
      console.error('Failed to encrypt SSN for user:', normalizedEmail, error)
      return { success: false, error: 'Failed to secure sensitive data' }
    }
  }

  const newUser = {
    id: userId,
    email: normalizedEmail,
    firstName: userData.firstName || '',
    lastName: userData.lastName || '',
    phoneNumber: userData.phoneNumber || '',
    dob: userData.dob || '',
    ssn: encryptedSSN,
    password: userData.password || '',
    address: userData.address || null,
    verificationCode: userData.verificationCode || '',
    isVerified: userData.isVerified || false,
    verifiedAt: userData.verifiedAt || null,
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

  usersData.users.push(newUser)

  if (await saveUsers(usersData)) {
    console.log('New user added:', newUser.email)
    return { success: true, user: newUser }
  } else {
    return { success: false, error: 'Failed to save user data' }
  }
}

// Get user by email (case-insensitive)
export async function getUserByEmail(email) {
  const usersData = await getUsers()
  const normalizedEmail = email.toLowerCase().trim()
  return usersData.users.find(user => user.email.toLowerCase().trim() === normalizedEmail)
}

// Update user data
export async function updateUser(userId, updateData) {
  const usersData = await getUsers()
  const userIndex = usersData.users.findIndex(user => user.id === userId)

  if (userIndex === -1) {
    console.log('User not found with ID:', userId)
    return { success: false, error: 'User not found' }
  }

  // Encrypt SSN if it's being updated and not already encrypted
  if (updateData.ssn && !isEncrypted(updateData.ssn)) {
    try {
      updateData.ssn = encrypt(updateData.ssn)
      console.log('SSN encrypted for user update:', userId)
    } catch (error) {
      console.error('Failed to encrypt SSN for user:', userId, error)
      return { success: false, error: 'Failed to secure sensitive data' }
    }
  }

  const updatedUser = {
    ...usersData.users[userIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  }

  usersData.users[userIndex] = updatedUser

  if (await saveUsers(usersData)) {
    console.log('User updated:', updatedUser)
    return { success: true, user: updatedUser }
  } else {
    return { success: false, error: 'Failed to update user data' }
  }
}

// Clean up duplicate users (keep the most recent one)
export async function cleanupDuplicateUsers() {
  const usersData = await getUsers()
  const emailMap = new Map()

  usersData.users.forEach(user => {
    const normalizedEmail = user.email.toLowerCase().trim()
    if (!emailMap.has(normalizedEmail)) {
      emailMap.set(normalizedEmail, [])
    }
    emailMap.get(normalizedEmail).push(user)
  })

  const cleanedUsers = []
  const seenEmails = new Set()

  const sortedUsers = usersData.users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  sortedUsers.forEach(user => {
    const normalizedEmail = user.email.toLowerCase().trim()
    if (!seenEmails.has(normalizedEmail)) {
      cleanedUsers.push(user)
      seenEmails.add(normalizedEmail)
    }
  })

  if (cleanedUsers.length !== usersData.users.length) {
    const removedCount = usersData.users.length - cleanedUsers.length
    console.log(`Cleaned up ${removedCount} duplicate users`)
    usersData.users = cleanedUsers
    await saveUsers(usersData)
    return { success: true, removed: removedCount }
  }

  return { success: true, removed: 0 }
}
