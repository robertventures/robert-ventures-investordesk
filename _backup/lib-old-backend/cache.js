/**
 * Simple in-memory cache for serverless environments
 * 
 * Note: In serverless environments (like Netlify), this cache is per-instance
 * and will be reset on cold starts. This is acceptable as it's primarily
 * for reducing repeated reads within the same request cycle or warm instance.
 */

class ServerCache {
  constructor() {
    this.cache = new Map()
    this.timers = new Map()
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key)
    if (!item) return null

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key)
      return null
    }

    console.log(`🎯 Cache HIT: ${key}`)
    return item.value
  }

  /**
   * Set a value in cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlMs - Time to live in milliseconds (default: 30 seconds)
   */
  set(key, value, ttlMs = 30000) {
    const expiresAt = Date.now() + ttlMs
    this.cache.set(key, { value, expiresAt })

    // Clear any existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
    }

    // Set timer to auto-cleanup
    const timer = setTimeout(() => {
      this.delete(key)
    }, ttlMs)

    this.timers.set(key, timer)
    console.log(`💾 Cache SET: ${key} (TTL: ${ttlMs}ms)`)
  }

  /**
   * Delete a value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key)
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }
    
    console.log(`🗑️  Cache DELETE: ${key}`)
  }

  /**
   * Invalidate all cache entries matching a pattern
   * @param {RegExp|string} pattern - Pattern to match keys against
   */
  invalidatePattern(pattern) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    const keysToDelete = []

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach(key => this.delete(key))
    console.log(`🔄 Cache INVALIDATE: ${pattern} (${keysToDelete.length} keys)`)
  }

  /**
   * Clear all cache entries
   */
  clear() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    
    this.cache.clear()
    this.timers.clear()
    console.log('🧹 Cache CLEARED')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Create singleton instance
const cache = new ServerCache()

// Cache key generators
export const CACHE_KEYS = {
  ALL_USERS: 'users:all',
  USER_BY_ID: (id) => `user:${id}`,
  USER_BY_EMAIL: (email) => `user:email:${email.toLowerCase()}`,
  WITHDRAWALS: 'withdrawals:all',
  PENDING_PAYOUTS: 'payouts:pending',
  TIME_MACHINE: 'time_machine:state'
}

// Cache TTL configurations (in milliseconds)
export const CACHE_TTL = {
  USERS: 30000,       // 30 seconds - frequent updates from admin
  USER: 60000,        // 60 seconds - individual user data
  WITHDRAWALS: 30000, // 30 seconds
  PAYOUTS: 30000,     // 30 seconds
  TIME_MACHINE: 60000 // 60 seconds - rarely changes
}

export default cache

