/**
 * Temporary storage for pending user registrations
 * In production, this should be replaced with Netlify Blobs or a database table
 * 
 * Stores user data temporarily until they verify their email
 */

// In-memory storage (will be lost on server restart, which is acceptable for pending registrations)
const pendingUsers = new Map()

// Cleanup expired pending users (older than 1 hour)
const EXPIRY_TIME = 60 * 60 * 1000 // 1 hour in milliseconds

function cleanupExpired() {
  const now = Date.now()
  for (const [email, data] of pendingUsers.entries()) {
    if (now - data.createdAt > EXPIRY_TIME) {
      pendingUsers.delete(email)
      console.log(`🗑️ Cleaned up expired pending user: ${email}`)
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupExpired, 10 * 60 * 1000)

/**
 * Store a pending user registration
 * @param {string} email - User's email
 * @param {string} hashedPassword - Already hashed password
 * @returns {object} - Success status and pending user ID
 */
export function storePendingUser(email, hashedPassword) {
  // Generate a temporary ID
  const pendingId = `PENDING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  pendingUsers.set(email, {
    pendingId,
    email,
    hashedPassword,
    createdAt: Date.now(),
    // In production, this would also store a verification code
    verificationCode: '000000' // Hardcoded for testing
  })
  
  console.log(`✅ Stored pending user: ${email} (${pendingId})`)
  
  return {
    success: true,
    pendingId,
    email
  }
}

/**
 * Get a pending user by email
 * @param {string} email - User's email
 * @returns {object|null} - Pending user data or null if not found/expired
 */
export function getPendingUser(email) {
  const data = pendingUsers.get(email)
  
  if (!data) {
    return null
  }
  
  // Check if expired
  if (Date.now() - data.createdAt > EXPIRY_TIME) {
    pendingUsers.delete(email)
    console.log(`⏰ Pending user expired: ${email}`)
    return null
  }
  
  return data
}

/**
 * Verify and remove a pending user
 * @param {string} email - User's email
 * @param {string} verificationCode - Verification code to check
 * @returns {object} - Success status and user data if valid
 */
export function verifyAndRemovePendingUser(email, verificationCode) {
  const data = getPendingUser(email)
  
  if (!data) {
    return {
      success: false,
      error: 'Pending registration not found or expired. Please sign up again.'
    }
  }
  
  // Verify the code
  if (data.verificationCode !== verificationCode) {
    return {
      success: false,
      error: 'Invalid verification code'
    }
  }
  
  // Remove from pending storage
  pendingUsers.delete(email)
  console.log(`✅ Verified and removed pending user: ${email}`)
  
  return {
    success: true,
    email: data.email,
    hashedPassword: data.hashedPassword
  }
}

/**
 * Remove a pending user (for cleanup or cancellation)
 * @param {string} email - User's email
 */
export function removePendingUser(email) {
  pendingUsers.delete(email)
  console.log(`🗑️ Removed pending user: ${email}`)
}

/**
 * Get count of pending users (for monitoring)
 */
export function getPendingUsersCount() {
  cleanupExpired() // Clean up before counting
  return pendingUsers.size
}

