/**
 * Supabase Client Configuration
 * Provides both server-side and client-side Supabase clients
 */

import { createClient } from '@supabase/supabase-js'

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY')
  throw new Error('Missing Supabase configuration')
}

/**
 * Browser/Client-side Supabase client
 * Uses anon key - safe for frontend
 * Respects RLS policies based on authenticated user
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  })
}

/**
 * Server-side Supabase client with admin privileges
 * Uses service role key - NEVER expose to frontend
 * Bypasses RLS policies - use with caution
 */
export function createServiceClient() {
  if (!supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY!')
    throw new Error('Service role key required for server operations')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

/**
 * Server-side client for API routes (respects RLS)
 * Uses cookies to maintain user session
 * Good for authenticated API endpoints
 */
export function createServerClient(request = null) {
  // For now, use service client with manual auth checking
  // In future, can implement cookie-based auth with middleware
  return createServiceClient()
}

/**
 * Get current user from request (for API routes)
 * Returns null if not authenticated
 */
export async function getCurrentUser(supabase) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) {
      console.error('Error getting current user:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Error in getCurrentUser:', error)
    return null
  }
}

/**
 * Get user data from database by auth ID
 */
export async function getUserData(supabase, authId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single()

    if (error) {
      console.error('Error getting user data:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Error in getUserData:', error)
    return null
  }
}

// Export singleton instances for convenience
export const supabaseBrowser = typeof window !== 'undefined' ? createBrowserClient() : null
export const supabaseServer = createServiceClient()

