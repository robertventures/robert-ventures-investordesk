/**
 * Supabase Authentication Helper Functions
 * Replaces JWT-based auth with Supabase Auth
 */

import { createServiceClient, createBrowserClient } from './supabaseClient.js'

/**
 * Sign up a new user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {object} metadata - Additional user data
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
export async function signUp(email, password, metadata = {}) {
  try {
    const supabase = createServiceClient()

    // Prepare user metadata with display name for Supabase Auth UI
    const userMetadata = {
      ...metadata,
      // Add full_name for Supabase Auth UI display
      full_name: metadata.firstName && metadata.lastName 
        ? `${metadata.firstName} ${metadata.lastName}` 
        : metadata.firstName || metadata.lastName || email
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: userMetadata
    })

    if (authError) {
      console.error('Supabase auth signup error:', authError)
      return { success: false, error: authError.message }
    }

    return {
      success: true,
      user: authData.user
    }
  } catch (error) {
    console.error('Error in signUp:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sign in a user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{success: boolean, user?: object, session?: object, error?: string}>}
 */
export async function signIn(email, password) {
  try {
    const supabase = createBrowserClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Supabase auth signin error:', error)
      return { success: false, error: error.message }
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    }
  } catch (error) {
    console.error('Error in signIn:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Sign out current user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function signOut() {
  try {
    const supabase = createBrowserClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Supabase auth signout error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in signOut:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get current session
 * @returns {Promise<{session: object|null, user: object|null}>}
 */
export async function getSession() {
  try {
    const supabase = createBrowserClient()

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      console.error('Error getting session:', error)
      return { session: null, user: null }
    }

    return { session, user: session?.user || null }
  } catch (error) {
    console.error('Error in getSession:', error)
    return { session: null, user: null }
  }
}

/**
 * Get current user
 * @returns {Promise<object|null>}
 */
export async function getCurrentUser() {
  try {
    const supabase = createBrowserClient()

    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('Error getting user:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

/**
 * Verify user is authenticated (middleware)
 * @param {Request} request - Next.js request object
 * @returns {Promise<{authenticated: boolean, user?: object, error?: string}>}
 */
export async function verifyAuthentication(request) {
  try {
    const supabase = createServiceClient()

    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { authenticated: false, error: 'No authorization header' }
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify token
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return { authenticated: false, error: 'Invalid token' }
    }

    return { authenticated: true, user }
  } catch (error) {
    console.error('Error in verifyAuthentication:', error)
    return { authenticated: false, error: error.message }
  }
}

/**
 * Reset password request
 * @param {string} email - User email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function requestPasswordReset(email) {
  try {
    const supabase = createBrowserClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })

    if (error) {
      console.error('Password reset request error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in requestPasswordReset:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update password
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePassword(newPassword) {
  try {
    const supabase = createBrowserClient()

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      console.error('Password update error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error in updatePassword:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if user is admin
 * @param {string} userId - User ID (from users table, not auth)
 * @returns {Promise<boolean>}
 */
export async function isUserAdmin(userId) {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return false
    }

    return data.is_admin === true
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

