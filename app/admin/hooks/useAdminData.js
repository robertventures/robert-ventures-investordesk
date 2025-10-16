import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Custom hook to manage all admin data fetching and state
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

  const loadUsers = async () => {
    try {
      // First, ensure all transaction events are generated based on current app time
      await fetch('/api/migrate-transactions', { method: 'POST' })
      
      // Then load users with all their activity events
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) {
        setUsers(data.users || [])
      }
    } catch (e) {
      console.error('Failed to load users', e)
    }
  }

  const loadWithdrawals = async () => {
    try {
      setIsLoadingWithdrawals(true)
      const res = await fetch('/api/admin/withdrawals')
      const data = await res.json()
      if (data.success) {
        setWithdrawals(data.withdrawals || [])
      }
    } catch (e) {
      console.error('Failed to load withdrawals', e)
    } finally {
      setIsLoadingWithdrawals(false)
    }
  }

  const loadPendingPayouts = async () => {
    try {
      setIsLoadingPayouts(true)
      const res = await fetch('/api/admin/pending-payouts')
      const data = await res.json()
      if (data.success) {
        setPendingPayouts(data.pendingPayouts || [])
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
    refreshTimeMachine: loadTimeMachine
  }
}

