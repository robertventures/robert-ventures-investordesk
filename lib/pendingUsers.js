/**
 * Supabase-based storage for pending user registrations
 * Stores user data temporarily until they verify their email
 */

import { createServiceClient } from './supabaseClient.js'

// Cleanup expired pending users (older than 1 hour)
const EXPIRY_TIME = 60 * 60 * 1000 // 1 hour in milliseconds

/**
 * Clean up expired pending users from database
 */
async function cleanupExpired() {
  try {
    const supabase = createServiceClient()
    const expiryDate = new Date(Date.now() - EXPIRY_TIME).toISOString()
    
    const { error } = await supabase
      .from('pending_users')
      .delete()
      .lt('created_at', expiryDate)
    
    if (!error) {
      console.log('🗑️ Cleaned up expired pending users')
    }
  } catch (error) {
    console.error('Error cleaning up expired pending users:', error)
  }
}

/**
 * Generate a verification code
 * In test mode (default), returns '000000' for easy testing
 * In production mode with email enabled, would generate a random 6-digit code
 * @returns {string} - Verification code
 */
function generateVerificationCode() {
  // Check if email verification is enabled
  const emailVerificationEnabled = process.env.ENABLE_EMAIL_VERIFICATION === 'true'
  
  if (emailVerificationEnabled) {
    // Generate random 6-digit code for production email verification
    return Math.floor(100000 + Math.random() * 900000).toString()
  } else {
    // Test mode: use hardcoded code for easy testing (works in local dev AND production)
    return '000000'
  }
}

/**
 * Store a pending user registration
 * @param {string} email - User's email
 * @param {string} plainPassword - Plain text password (will be hashed by Supabase Auth on signup)
 * @returns {Promise<object>} - Success status, pending user ID, and verification code
 */
export async function storePendingUser(email, plainPassword) {
  try {
    const supabase = createServiceClient()
    
    // Generate a temporary ID
    const pendingId = `PENDING-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Generate verification code (000000 in test mode, random in production with email)
    const verificationCode = generateVerificationCode()
    
    // Clean up any existing pending registration for this email
    await supabase
      .from('pending_users')
      .delete()
      .eq('email', email)
    
    // Insert new pending user
    // Note: Storing plain password temporarily (1 hour max) - encrypted at rest by Supabase
    const { data, error } = await supabase
      .from('pending_users')
      .insert({
        id: pendingId,
        email,
        hashed_password: plainPassword, // Column name kept for compatibility, but stores plain text now
        verification_code: verificationCode,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error storing pending user:', error)
      return {
        success: false,
        error: 'Failed to store pending registration'
      }
    }
    
    const mode = verificationCode === '000000' ? 'test mode (000000)' : 'email mode (random code)'
    console.log(`✅ Stored pending user: ${email} (${pendingId}) - ${mode}`)
    
    return {
      success: true,
      pendingId,
      email,
      verificationCode // Return code so it can be emailed in production mode
    }
  } catch (error) {
    console.error('Error in storePendingUser:', error)
    return {
      success: false,
      error: 'Failed to store pending registration'
    }
  }
}

/**
 * Get a pending user by email
 * @param {string} email - User's email
 * @returns {Promise<object|null>} - Pending user data or null if not found/expired
 */
export async function getPendingUser(email) {
  try {
    const supabase = createServiceClient()
    
    const { data, error } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', email)
      .maybeSingle()
    
    if (error || !data) {
      return null
    }
    
    // Check if expired
    const createdAt = new Date(data.created_at).getTime()
    if (Date.now() - createdAt > EXPIRY_TIME) {
      // Delete expired entry
      await supabase
        .from('pending_users')
        .delete()
        .eq('email', email)
      
      console.log(`⏰ Pending user expired: ${email}`)
      return null
    }
    
    return {
      pendingId: data.id,
      email: data.email,
      plainPassword: data.hashed_password, // Column name is hashed_password but contains plain text
      verificationCode: data.verification_code,
      createdAt: createdAt
    }
  } catch (error) {
    console.error('Error getting pending user:', error)
    return null
  }
}

/**
 * Verify and remove a pending user
 * @param {string} email - User's email
 * @param {string} verificationCode - Verification code to check
 * @returns {Promise<object>} - Success status and user data if valid
 */
export async function verifyAndRemovePendingUser(email, verificationCode) {
  try {
    const data = await getPendingUser(email)
    
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
    const supabase = createServiceClient()
    await supabase
      .from('pending_users')
      .delete()
      .eq('email', email)
    
    console.log(`✅ Verified and removed pending user: ${email}`)
    
    return {
      success: true,
      email: data.email,
      plainPassword: data.plainPassword // Plain password to pass to Supabase Auth
    }
  } catch (error) {
    console.error('Error in verifyAndRemovePendingUser:', error)
    return {
      success: false,
      error: 'Failed to verify pending registration'
    }
  }
}

/**
 * Remove a pending user (for cleanup or cancellation)
 * @param {string} email - User's email
 */
export async function removePendingUser(email) {
  try {
    const supabase = createServiceClient()
    await supabase
      .from('pending_users')
      .delete()
      .eq('email', email)
    
    console.log(`🗑️ Removed pending user: ${email}`)
  } catch (error) {
    console.error('Error removing pending user:', error)
  }
}

/**
 * Get count of pending users (for monitoring)
 */
export async function getPendingUsersCount() {
  try {
    await cleanupExpired() // Clean up before counting
    
    const supabase = createServiceClient()
    const { count, error } = await supabase
      .from('pending_users')
      .select('*', { count: 'exact', head: true })
    
    if (error) {
      console.error('Error counting pending users:', error)
      return 0
    }
    
    return count || 0
  } catch (error) {
    console.error('Error in getPendingUsersCount:', error)
    return 0
  }
}

