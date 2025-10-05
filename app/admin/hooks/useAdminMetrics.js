import { useMemo } from 'react'

/**
 * Custom hook to calculate dashboard metrics from users data
 */
export function useAdminMetrics(users, withdrawals = [], pendingPayouts = []) {
  const nonAdminUsers = useMemo(() => 
    (users || []).filter(u => !u.isAdmin), 
    [users]
  )

  const metrics = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    
    let totalAUM = 0
    let pendingCapital = 0
    let totalAmountRaised = 0
    let pendingInvestmentsCount = 0
    let activeInvestmentsCount = 0
    let totalInvestmentsCount = 0
    let newAccountsCount = 0
    let unverifiedAccountsCount = 0
    let recentInvestments = []
    let recentSignups = []
    let investmentsByLockup = { '1-year': 0, '3-year': 0 }
    let investmentsByFrequency = { 'quarterly': 0, 'annually': 0, 'at-maturity': 0 }
    let accountsByType = { individual: 0, joint: 0, entity: 0, ira: 0 }
    
    nonAdminUsers.forEach(user => {
      // Account type distribution
      const accType = user.accountType || 'individual'
      if (accountsByType[accType] !== undefined) {
        accountsByType[accType]++
      }
      
      // New accounts (last 30 days)
      if (user.createdAt && new Date(user.createdAt) > thirtyDaysAgo) {
        newAccountsCount++
        recentSignups.push({
          id: user.id,
          name: `${user.firstName || ''} ${user.lastName || ''}`,
          email: user.email,
          createdAt: user.createdAt
        })
      }
      
      // Unverified accounts
      if (!user.isVerified) {
        unverifiedAccountsCount++
      }
      
      // Process investments
      (user.investments || []).forEach(inv => {
        totalInvestmentsCount++
        const amount = Number(inv.amount) || 0
        
        if (['active', 'withdrawal_notice', 'withdrawn'].includes(inv.status)) {
          totalAmountRaised += amount
        }

        if (inv.status === 'active') {
          totalAUM += amount
          activeInvestmentsCount++
        } else if (inv.status === 'pending') {
          pendingCapital += amount
          pendingInvestmentsCount++
        }
        
        // Investment distribution
        if (inv.lockupPeriod && investmentsByLockup[inv.lockupPeriod] !== undefined) {
          investmentsByLockup[inv.lockupPeriod]++
        }
        if (inv.paymentFrequency && investmentsByFrequency[inv.paymentFrequency] !== undefined) {
          investmentsByFrequency[inv.paymentFrequency]++
        }
        
        // Recent investments
        recentInvestments.push({
          id: inv.id,
          userId: user.id,
          userName: `${user.firstName || ''} ${user.lastName || ''}`,
          amount: amount,
          status: inv.status,
          createdAt: inv.createdAt
        })
      })
    })
    
    // Sort and limit recent items
    recentInvestments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    recentInvestments = recentInvestments.slice(0, 10)
    
    recentSignups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    recentSignups = recentSignups.slice(0, 5)
    
    const avgInvestmentSize = activeInvestmentsCount > 0 
      ? totalAUM / activeInvestmentsCount 
      : 0
      
    const pendingWithdrawalAmount = withdrawals.reduce((sum, w) => 
      sum + (Number(w.amount) || 0), 0
    )
    const pendingPayoutAmount = pendingPayouts.reduce((sum, p) => 
      sum + (Number(p.amount) || 0), 0
    )
    const totalAmountOwed = pendingWithdrawalAmount + pendingPayoutAmount
    
    const investorsCount = nonAdminUsers.filter(u => 
      (u.investments || []).some(inv => inv.status === 'active')
    ).length

    return {
      // Primary metrics
      totalAUM,
      totalAmountRaised,
      totalAmountOwed,
      totalAccounts: nonAdminUsers.length,
      investorsCount,
      activeInvestmentsCount,
      
      // Secondary metrics
      pendingCapital,
      pendingInvestmentsCount,
      totalInvestmentsCount,
      newAccountsCount,
      unverifiedAccountsCount,
      avgInvestmentSize,
      
      // Action items
      pendingWithdrawalsCount: withdrawals.filter(w => w.status === 'pending').length,
      pendingPayoutsCount: pendingPayouts.length,
      
      // Recent activity
      recentInvestments,
      recentSignups,
      
      // Distributions
      investmentsByLockup,
      investmentsByFrequency,
      accountsByType
    }
  }, [nonAdminUsers, withdrawals, pendingPayouts])

  return metrics
}

