/**
 * Tax Compliance Audit Trail Module
 * 
 * Purpose: Maintain immutable financial transaction records for tax reporting
 * 
 * This module does NOT calculate taxes or generate 1099 forms.
 * It provides utilities to:
 * 1. Add tax year metadata to all financial transactions
 * 2. Protect transaction data from modification after tax years close
 * 3. Provide a clean audit trail for external tax software/accountants
 * 
 * All transactions (investments, distributions, contributions, withdrawals) are 
 * automatically tagged with:
 * - taxYear: The calendar year for tax reporting
 * - taxableIncome: The amount subject to taxation (if any)
 * - incomeType: Classification for audit purposes
 */

/**
 * Get the tax year for a given date
 */
export function getTaxYear(date) {
  const d = new Date(date)
  return d.getUTCFullYear()
}

/**
 * Check if a tax year is locked (cannot modify transactions)
 * Lock happens after January 31 of the following year (1099 filing deadline)
 * 
 * Example: 2024 tax year locks on Feb 1, 2025
 */
export function isTaxYearLocked(taxYear) {
  const now = new Date()
  const lockDate = new Date(Date.UTC(taxYear + 1, 0, 31, 23, 59, 59)) // Jan 31, 11:59:59 PM UTC
  return now > lockDate
}

/**
 * Initialize basic tax information for a new user
 * This is minimal - just SSN collection for tax reporting
 */
export function initializeTaxInfo(userData) {
  return {
    // SSN for tax reporting
    ssnProvided: !!userData.ssn,
    ssnVerified: false,
    ssnVerifiedDate: null,

    // W-9 form collection
    w9OnFile: false,
    w9ReceivedDate: null,
    w9DocumentId: null
  }
}

/**
 * Validate that a transaction modification doesn't violate tax immutability
 * Prevents editing transactions after the tax year has been filed
 */
export function validateTaxImmutability(transaction, proposedChanges) {
  if (!transaction.taxYear) return { valid: true } // No tax data, allow changes

  const isLocked = isTaxYearLocked(transaction.taxYear)
  if (!isLocked) return { valid: true } // Tax year not locked yet, allow changes

  // Check if any tax-relevant fields are being changed
  const taxRelevantFields = ['amount', 'status', 'date', 'completedAt', 'taxableIncome']
  const changedFields = Object.keys(proposedChanges).filter(field =>
    taxRelevantFields.includes(field) &&
    proposedChanges[field] !== transaction[field]
  )

  if (changedFields.length > 0) {
    return {
      valid: false,
      error: `Cannot modify transaction: Tax year ${transaction.taxYear} is locked (after Jan 31, ${transaction.taxYear + 1}). Changed fields: ${changedFields.join(', ')}`,
      lockedFields: changedFields
    }
  }

  return { valid: true }
}
