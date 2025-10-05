/**
 * ID Generation Architecture
 * 
 * This module provides centralized ID generation for all entities in the system.
 * IDs are sequential and human-readable for better tracking and debugging.
 */

import { getUsers } from './database'

/**
 * ID Format Standards:
 * - User IDs: USR-{sequential} starting from USR-1000
 * - Investment IDs: INV-{sequential} starting from INV-10000
 * - Withdrawal IDs: WDL-{sequential} starting from WDL-10000
 * - Bank Account IDs: BANK-{userId}-{sequential} starting from BANK-USR-1000-1
 * - Transaction IDs: TX-{entityType}-{numericId}-{TYPE} (all uppercase)
 *   Examples:
 *     - TX-USR-1000-ACCOUNT-CREATED
 *     - TX-INV-10000-CREATED
 *     - TX-INV-10000-MD-2025-11 (monthly distribution)
 *     - TX-WDL-10000-APPROVED
 */

const ID_PREFIXES = {
  USER: 'USR',
  INVESTMENT: 'INV',
  WITHDRAWAL: 'WDL',
  BANK: 'BANK',
  TRANSACTION: 'TX'
}

const STARTING_IDS = {
  USER: 1000,
  INVESTMENT: 10000,
  WITHDRAWAL: 10000,
  BANK: 1
}

/**
 * Extract numeric ID from a formatted ID string
 * @param {string} id - Formatted ID (e.g., "USR-1000", "INV-10000")
 * @returns {number} - Numeric portion
 */
function extractNumericId(id) {
  if (!id) return 0
  const match = id.match(/-(\d+)(?:-|$)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Get the next available user ID
 * @returns {Promise<string>} - Next user ID (e.g., "USR-1001")
 */
export async function generateUserId() {
  try {
    const data = await getUsers()
    const users = data.users || []
    
    if (users.length === 0) {
      return `${ID_PREFIXES.USER}-${STARTING_IDS.USER}`
    }
    
    // Find the highest numeric ID
    const maxId = users.reduce((max, user) => {
      const numericId = extractNumericId(user.id)
      return Math.max(max, numericId)
    }, STARTING_IDS.USER - 1)
    
    const nextId = maxId + 1
    return `${ID_PREFIXES.USER}-${nextId}`
  } catch (error) {
    console.error('Error generating user ID:', error)
    // Fallback to starting ID if there's an error
    return `${ID_PREFIXES.USER}-${STARTING_IDS.USER}`
  }
}

/**
 * Get the next available investment ID for a user
 * @param {Object} user - User object containing investments array
 * @returns {string} - Next investment ID (e.g., "INV-10001")
 */
export function generateInvestmentId(user) {
  const investments = user.investments || []
  
  if (investments.length === 0) {
    return `${ID_PREFIXES.INVESTMENT}-${STARTING_IDS.INVESTMENT}`
  }
  
  // Find the highest numeric ID across all investments
  const maxId = investments.reduce((max, inv) => {
    const numericId = extractNumericId(inv.id)
    return Math.max(max, numericId)
  }, STARTING_IDS.INVESTMENT - 1)
  
  const nextId = maxId + 1
  return `${ID_PREFIXES.INVESTMENT}-${nextId}`
}

/**
 * Get the next available investment ID globally (across all users)
 * @param {Array} allUsers - Array of all user objects
 * @returns {string} - Next investment ID (e.g., "INV-10001")
 */
export function generateGlobalInvestmentId(allUsers) {
  let maxId = STARTING_IDS.INVESTMENT - 1
  
  for (const user of allUsers) {
    const investments = user.investments || []
    for (const inv of investments) {
      const numericId = extractNumericId(inv.id)
      maxId = Math.max(maxId, numericId)
    }
  }
  
  const nextId = maxId + 1
  return `${ID_PREFIXES.INVESTMENT}-${nextId}`
}

/**
 * Get the next available withdrawal ID
 * @param {Array} allUsers - Array of all user objects
 * @returns {string} - Next withdrawal ID (e.g., "WDL-10001")
 */
export function generateWithdrawalId(allUsers) {
  let maxId = STARTING_IDS.WITHDRAWAL - 1
  
  for (const user of allUsers) {
    const withdrawals = user.withdrawals || []
    for (const wdl of withdrawals) {
      const numericId = extractNumericId(wdl.id)
      maxId = Math.max(maxId, numericId)
    }
  }
  
  const nextId = maxId + 1
  return `${ID_PREFIXES.WITHDRAWAL}-${nextId}`
}

/**
 * Get the next available bank account ID for a user
 * @param {string} userId - User ID (e.g., "USR-1000")
 * @param {Array} bankAccounts - User's existing bank accounts
 * @returns {string} - Next bank account ID (e.g., "BANK-USR-1000-2")
 */
export function generateBankAccountId(userId, bankAccounts = []) {
  const userBankAccounts = bankAccounts.filter(bank => 
    bank.id && bank.id.startsWith(`${ID_PREFIXES.BANK}-${userId}`)
  )
  
  if (userBankAccounts.length === 0) {
    return `${ID_PREFIXES.BANK}-${userId}-${STARTING_IDS.BANK}`
  }
  
  // Find the highest sequence number for this user's bank accounts
  const maxSequence = userBankAccounts.reduce((max, bank) => {
    const parts = bank.id.split('-')
    const sequence = parts[parts.length - 1]
    return Math.max(max, parseInt(sequence, 10) || 0)
  }, 0)
  
  const nextSequence = maxSequence + 1
  return `${ID_PREFIXES.BANK}-${userId}-${nextSequence}`
}

/**
 * Generate transaction ID based on type
 * @param {string} entityType - Type of entity (USER, INVESTMENT, WITHDRAWAL)
 * @param {string} entityId - Entity ID (can be full ID like "USR-1001" or just "1001")
 * @param {string} transactionType - Type of transaction
 * @param {Object} options - Additional options (e.g., date for monthly transactions)
 * @returns {string} - Transaction ID
 */
export function generateTransactionId(entityType, entityId, transactionType, options = {}) {
  // Strip the entity type prefix from entityId if it's already present to avoid duplication
  // e.g., "USR-1001" becomes "1001", "INV-10000" becomes "10000"
  let cleanEntityId = entityId
  if (typeof entityId === 'string' && entityId.includes('-')) {
    const parts = entityId.split('-')
    // If the first part matches the entityType, use everything after it
    if (parts[0] === entityType) {
      cleanEntityId = parts.slice(1).join('-')
    }
  }
  
  const prefix = `${ID_PREFIXES.TRANSACTION}-${entityType}-${cleanEntityId}`
  
  switch (transactionType) {
    case 'account_created':
      return `${prefix}-ACCOUNT-CREATED`
    
    case 'investment_created':
      return `${prefix}-CREATED`
    
    case 'investment_confirmed':
      return `${prefix}-CONFIRMED`
    
    case 'monthly_distribution':
      if (options.date) {
        const date = new Date(options.date)
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        return `${prefix}-MD-${year}-${month}`
      }
      return `${prefix}-MD-${Date.now()}`
    
    case 'monthly_compounded':
      if (options.date) {
        const date = new Date(options.date)
        const year = date.getUTCFullYear()
        const month = String(date.getUTCMonth() + 1).padStart(2, '0')
        return `${prefix}-MC-${year}-${month}`
      }
      return `${prefix}-MC-${Date.now()}`
    
    case 'withdrawal_notice_started':
      return `${prefix}-NOTICE`
    
    case 'withdrawal_approved':
      return `${prefix}-APPROVED`
    
    case 'withdrawal_rejected':
      return `${prefix}-REJECTED`
    
    default:
      return `${prefix}-${transactionType.toUpperCase()}`
  }
}

/**
 * Validate ID format
 * @param {string} id - ID to validate
 * @param {string} expectedPrefix - Expected prefix (USER, INVESTMENT, etc.)
 * @returns {boolean} - Whether ID is valid
 */
export function validateIdFormat(id, expectedPrefix) {
  if (!id || typeof id !== 'string') return false
  
  const prefix = ID_PREFIXES[expectedPrefix]
  if (!prefix) return false
  
  return id.startsWith(`${prefix}-`)
}

/**
 * Check if an ID is the admin user
 * @param {string} id - User ID to check
 * @returns {boolean} - Whether this is the admin user
 */
export function isAdminUserId(id) {
  return id === `${ID_PREFIXES.USER}-${STARTING_IDS.USER}`
}

export default {
  generateUserId,
  generateInvestmentId,
  generateGlobalInvestmentId,
  generateWithdrawalId,
  generateBankAccountId,
  generateTransactionId,
  validateIdFormat,
  isAdminUserId,
  ID_PREFIXES,
  STARTING_IDS
}

