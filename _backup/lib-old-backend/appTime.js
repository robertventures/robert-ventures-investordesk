import { getUsers } from './supabaseDatabase.js'

/**
 * Get the current app time (either real time or time machine time)
 * 
 * Time Machine now works with an offset:
 * - timeOffset: milliseconds to add to real time
 * - timeOffsetSetAt: when the offset was set (real time)
 * 
 * This allows time to continue flowing from the set point.
 * 
 * Throws error if database access fails - callers must handle errors appropriately
 * @returns {Promise<string>} ISO string of current app time
 * @throws {Error} If database access fails
 */
export async function getCurrentAppTime() {
  const usersData = await getUsers()
  
  // If time machine is active (offset exists), calculate current app time
  if (usersData.timeOffset !== undefined && usersData.timeOffset !== null) {
    const now = new Date()
    const appTime = new Date(now.getTime() + usersData.timeOffset)
    return appTime.toISOString()
  }
  
  // No time machine - return real time
  return new Date().toISOString()
}

/**
 * Get the current app time synchronously (for client-side use)
 * This should be used when you already have the app time from an API call
 * @param {string} [cachedAppTime] - Pre-fetched app time from API
 * @returns {string} ISO string of current app time
 */
export function getCurrentAppTimeSync(cachedAppTime = null) {
  return cachedAppTime || new Date().toISOString()
}

/**
 * Check if time machine is active
 * Throws error if database access fails - callers must handle errors appropriately
 * @returns {Promise<boolean>}
 * @throws {Error} If database access fails
 */
export async function isTimeMachineActive() {
  const usersData = await getUsers()
  return usersData.timeOffset !== undefined && usersData.timeOffset !== null
}

/**
 * Get the auto-approve distributions setting
 * Throws error if database access fails - callers must handle errors appropriately
 * @returns {Promise<boolean>}
 * @throws {Error} If database access fails
 */
export async function getAutoApproveDistributions() {
  const usersData = await getUsers()
  return usersData.autoApproveDistributions === true
}

/**
 * Create a Date object using app time
 * @param {string} [cachedAppTime] - Pre-fetched app time from API
 * @returns {Date}
 */
export function getAppDate(cachedAppTime = null) {
  return new Date(getCurrentAppTimeSync(cachedAppTime))
}

/**
 * Format app time for display
 * @param {string} [cachedAppTime] - Pre-fetched app time from API
 * @returns {string}
 */
export function formatAppTime(cachedAppTime = null) {
  const appTime = getCurrentAppTimeSync(cachedAppTime)
  return new Date(appTime).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}
