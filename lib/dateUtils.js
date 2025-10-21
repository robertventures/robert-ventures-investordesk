/**
 * Date utility functions for handling dates WITHOUT timezone conversion
 * Use these functions when you want to preserve the exact date entered by the user
 */

/**
 * Convert a date-only string (YYYY-MM-DD) to ISO string without timezone shift
 * This ensures that "2024-11-20" stays as "2024-11-20" regardless of timezone
 * 
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} - ISO string representing midnight UTC on that date
 */
export function dateOnlyToISO(dateString) {
  if (!dateString) return null
  
  // If it's already a full ISO string, extract just the date part
  if (dateString.includes('T')) {
    dateString = dateString.split('T')[0]
  }
  
  // Parse the date components
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Create a UTC date at midnight (no timezone conversion)
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  
  return date.toISOString()
}

/**
 * Convert an ISO string back to a date-only string (YYYY-MM-DD)
 * 
 * @param {string} isoString - ISO string
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export function isoToDateOnly(isoString) {
  if (!isoString) return null
  return isoString.split('T')[0]
}

/**
 * Add days to a date without timezone conversion
 * 
 * @param {string} dateString - Date string in YYYY-MM-DD or ISO format
 * @param {number} days - Number of days to add
 * @returns {string} - ISO string
 */
export function addDays(dateString, days) {
  const iso = dateOnlyToISO(dateString)
  const date = new Date(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

/**
 * Add years to a date without timezone conversion
 * 
 * @param {string} dateString - Date string in YYYY-MM-DD or ISO format  
 * @param {number} years - Number of years to add
 * @returns {string} - ISO string
 */
export function addYears(dateString, years) {
  const iso = dateOnlyToISO(dateString)
  const date = new Date(iso)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString()
}

/**
 * Get today's date as YYYY-MM-DD in UTC
 * 
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export function getTodayDateOnly() {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

