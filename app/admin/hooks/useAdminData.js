import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// Cache configuration
const CACHE_DURATION = 30000 // 30 seconds
const CACHE_KEY_USERS = 'admin_users_cache'
const CACHE_KEY_WITHDRAWALS = 'admin_withdrawals_cache'
const CACHE_KEY_PAYOUTS = 'admin_payouts_cache'

/**
 * Custom hook to manage all admin data fetching and state with intelligent caching
 */
export function useAdminData() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [withdrawals, setWithdrawals] = useState([])
  const [isLoadingWithdrawals, setIsLoadingWithdrawals] = useState(false)
  const [pendingPayouts, setPendingPayouts] = useState([])
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(false)
  const [timeMachineData, setTimeMachineData] = useState({ 
    appTime: null, 
    isActive: false,
    autoApproveDistributions: false
  })

  // Helper to get cached data if still valid
  const getCachedData = (key) => {
    try {
      const cached = localStorage.getItem(key)
      if (!cached) return null
      
      const { data, timestamp } = JSON.parse(cached)
      const age = Date.now() - timestamp
      
      if (age < CACHE_DURATION) {
        return data
      }
      
      // Cache expired, remove it
      localStorage.removeItem(key)
      return null
    } catch (e) {
      console.error('Cache read error:', e)
      return null
    }
  }

  // Helper to set cached data
  const setCachedData = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    } catch (e) {
      console.error('Cache write error:', e)
    }
  }

  // Helper to clear specific cache
  const clearCache = (key) => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.error('Cache clear error:', e)
    }
  }

  // Load initial data
  useEffect(() => {
    const init = async () => {
      try {
        const userId = localStorage.getItem('currentUserId')
        if (!userId) {
          router.push('/')
          return
        }

        // Load current user
        const meRes = await fetch(`/api/users/${userId}`)
        const meData = await meRes.json()
        if (!meData.success || !meData.user) {
          router.push('/')
          return
        }
        setCurrentUser(meData.user)
        
        if (!meData.user.isAdmin) {
          router.push('/dashboard')
          return
        }

        // Load all data in parallel
        await Promise.all([
          loadUsers(),
          loadWithdrawals(),
          loadPendingPayouts(),
          loadTimeMachine()
        ])
      } catch (e) {
        console.error('Failed to load admin data', e)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [router])

  const loadUsers = async (forceRefresh = false) => {
    try {
      // Check cache first unless forcing refresh
      if (!forceRefresh) {
        const cached = getCachedData(CACHE_KEY_USERS)
        if (cached) {
          console.log('📦 Using cached user data')
          setUsers(cached)
          return
        }
      }
      
      // Clear cache if forcing refresh (but don't run migration - that's separate)
      if (forceRefresh) {
        clearCache(CACHE_KEY_USERS)
      }
      
      // Load users with all their activity events
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
        setCachedData(CACHE_KEY_USERS, data.users || [])
        console.log('✓ User data loaded and cached')
      }
    } catch (e) {
      console.error('Failed to load users', e)
    }
  }

  const loadWithdrawals = async (forceRefresh = false) => {
    try {
      // Check cache first unless forcing refresh
      if (!forceRefresh) {
        const cached = getCachedData(CACHE_KEY_WITHDRAWALS)
        if (cached) {
          console.log('📦 Using cached withdrawals data')
          setWithdrawals(cached)
          return
        }
      }
      
      if (forceRefresh) {
        clearCache(CACHE_KEY_WITHDRAWALS)
      }
      
      setIsLoadingWithdrawals(true)
      const res = await fetch('/api/admin/withdrawals')
      const data = await res.json()
      if (data.success) {
        setWithdrawals(data.withdrawals || [])
        setCachedData(CACHE_KEY_WITHDRAWALS, data.withdrawals || [])
      }
    } catch (e) {
      console.error('Failed to load withdrawals', e)
    } finally {
      setIsLoadingWithdrawals(false)
    }
  }

  const loadPendingPayouts = async (forceRefresh = false) => {
    try {
      // Check cache first unless forcing refresh
      if (!forceRefresh) {
        const cached = getCachedData(CACHE_KEY_PAYOUTS)
        if (cached) {
          console.log('📦 Using cached payouts data')
          setPendingPayouts(cached)
          return
        }
      }
      
      if (forceRefresh) {
        clearCache(CACHE_KEY_PAYOUTS)
      }
      
      setIsLoadingPayouts(true)
      const res = await fetch('/api/admin/pending-payouts')
      const data = await res.json()
      if (data.success) {
        setPendingPayouts(data.pendingPayouts || [])
        setCachedData(CACHE_KEY_PAYOUTS, data.pendingPayouts || [])
      }
    } catch (e) {
      console.error('Failed to load pending payouts', e)
    } finally {
      setIsLoadingPayouts(false)
    }
  }

  const loadTimeMachine = async () => {
    try {
      const timeRes = await fetch('/api/admin/time-machine')
      const timeData = await timeRes.json()
      if (timeData.success) {
        setTimeMachineData({
          appTime: timeData.appTime,
          isActive: timeData.isTimeMachineActive,
          realTime: timeData.realTime,
          autoApproveDistributions: timeData.autoApproveDistributions || false
        })
      }
    } catch (e) {
      console.error('Failed to load time machine data', e)
    }
  }

  // Manual transaction migration for when needed (Time Machine changes, admin action)
  const migrateTransactions = async () => {
    try {
      const res = await fetch('/api/migrate-transactions', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        // Clear cache and reload users after migration
        clearCache(CACHE_KEY_USERS)
        await loadUsers(false)
      }
      return data
    } catch (e) {
      console.error('Failed to migrate transactions', e)
      return { success: false, error: e.message }
    }
  }

  // Clear all caches
  const clearAllCaches = () => {
    clearCache(CACHE_KEY_USERS)
    clearCache(CACHE_KEY_WITHDRAWALS)
    clearCache(CACHE_KEY_PAYOUTS)
  }

  return {
    currentUser,
    users,
    isLoading,
    withdrawals,
    isLoadingWithdrawals,
    pendingPayouts,
    isLoadingPayouts,
    timeMachineData,
    setTimeMachineData,
    refreshUsers: loadUsers,
    refreshWithdrawals: loadWithdrawals,
    refreshPayouts: loadPendingPayouts,
    refreshTimeMachine: loadTimeMachine,
    migrateTransactions  // Expose for manual triggering
  }
}

