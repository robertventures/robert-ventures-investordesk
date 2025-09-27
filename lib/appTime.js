import { getUsers } from './database'

/**
 * Get the current app time (either real time or time machine time)
 * @returns {Promise<string>} ISO string of current app time
 */
export async function getCurrentAppTime() {
  try {
    const usersData = await getUsers()
    return usersData.appTime || new Date().toISOString()
  } catch (error) {
    console.error('Error getting app time, falling back to real time:', error)
    return new Date().toISOString()
  }
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
 * @returns {Promise<boolean>}
 */
export async function isTimeMachineActive() {
  try {
    const usersData = await getUsers()
    return usersData.appTime !== undefined
  } catch (error) {
    return false
  }
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
