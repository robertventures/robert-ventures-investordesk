/**
 * Transaction Synchronization Utility
 *
 * Shared logic for generating and persisting transaction events.
 * This utility can be called directly from any API route without making HTTP calls.
 *
 * Replaces the need for fetch() calls to /api/migrate-transactions
 */

import { getUsers, saveUsers } from './supabaseDatabase.js'
import { getCurrentAppTime } from './appTime.js'
import { generateTransactionId } from './idGenerator.js'

// Helper functions for date calculations
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toUtcStartOfDay = (value) => {
  const date = new Date(value)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

const addDaysUtc = (date, days) => {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

// Import the full transaction sync logic from the API route
// This avoids code duplication by reusing the existing implementation
async function syncTransactionsInternal() {
  // Import dynamically to avoid circular dependencies
  const { POST } = await import('../app/api/migrate-transactions/route.js')

  // Call the POST handler directly (no HTTP needed)
  const response = await POST()
  const data = await response.json()

  return data
}

/**
 * Synchronize transactions for all users
 *
 * This function generates and persists transaction events including:
 * - Investment created/confirmed events
 * - Monthly distributions
 * - Monthly compounding contributions
 * - Withdrawal redemptions
 *
 * Can be called directly from any API route without making HTTP calls.
 *
 * @returns {Promise<{success: boolean, usersUpdated?: number, eventsCreated?: number, error?: string}>}
 */
export async function syncTransactions() {
  try {
    console.log('🔄 Starting transaction sync (direct call)...')
    const result = await syncTransactionsInternal()

    if (result.success) {
      console.log(`✅ Transaction sync complete: ${result.usersUpdated} users updated, ${result.eventsCreated} events created`)
    } else {
      console.error('❌ Transaction sync failed:', result.error)
    }

    return result
  } catch (error) {
    console.error('❌ Transaction sync error:', error)
    return {
      success: false,
      error: error.message || 'Transaction sync failed'
    }
  }
}

/**
 * Synchronize transactions with error handling and logging
 *
 * This is a non-blocking version that logs errors but doesn't throw.
 * Use this when transaction sync failure shouldn't block the main operation.
 *
 * @returns {Promise<void>}
 */
export async function syncTransactionsNonBlocking() {
  try {
    await syncTransactions()
  } catch (error) {
    console.error('Transaction sync failed (non-blocking):', error)
    // Don't throw - just log the error
  }
}

export default syncTransactions
