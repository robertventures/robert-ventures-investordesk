'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminHeader from '../components/AdminHeader'
import { useAdminData } from './hooks/useAdminData'
import { useAdminMetrics } from './hooks/useAdminMetrics'
import DashboardTab from './tabs/DashboardTab'
import OperationsTab from './tabs/OperationsTab'
import styles from './page.module.css'

/**
 * Main Admin Dashboard - Refactored for better organization
 */
export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Tab management
  const initialTab = useMemo(() => {
    const t = searchParams?.get('tab') || 'dashboard'
    const allowed = ['dashboard', 'transactions', 'accounts', 'operations']
    return allowed.includes(t) ? t : 'dashboard'
  }, [searchParams])
  const [activeTab, setActiveTab] = useState(initialTab)

  // Data management with custom hook
  const {
    currentUser,
    users,
    isLoading,
    withdrawals,
    isLoadingWithdrawals,
    pendingPayouts,
    isLoadingPayouts,
    timeMachineData,
    setTimeMachineData,
    refreshUsers,
    refreshWithdrawals,
    refreshPayouts
  } = useAdminData()

  // Metrics calculation with custom hook
  const metrics = useAdminMetrics(users, withdrawals, pendingPayouts)

  // State for specific tab operations
  const [savingId, setSavingId] = useState(null)
  const [investmentsSearch, setInvestmentsSearch] = useState('')
  const [accountsSearch, setAccountsSearch] = useState('')

  // Keep tab in sync with URL
  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  // Filter functions
  const nonAdminUsers = useMemo(() => 
    (users || []).filter(u => !u.isAdmin), 
    [users]
  )

  // Get all investments with user info
  const allInvestments = useMemo(() => {
    const investments = []
    nonAdminUsers.forEach(user => {
      if (user.investments && user.investments.length > 0) {
        user.investments.forEach(inv => {
          investments.push({
            ...inv,
            user: {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || user.phoneNumber,
              accountType: user.accountType,
              isVerified: user.isVerified,
              jointHolder: user.jointHolder
            }
          })
        })
      }
    })
    investments.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
    return investments
  }, [nonAdminUsers])

  const filteredInvestments = useMemo(() => {
    if (!investmentsSearch.trim()) return allInvestments
    const term = investmentsSearch.toLowerCase()
    return allInvestments.filter(inv => {
      const fullName = `${inv.user.firstName || ''} ${inv.user.lastName || ''}`.toLowerCase()
      const email = (inv.user.email || '').toLowerCase()
      const investmentId = (inv.id || '').toString().toLowerCase()
      const accountId = (inv.user.id || '').toString().toLowerCase()
      const status = (inv.status || '').toLowerCase()
      return fullName.includes(term) || email.includes(term) || 
             investmentId.includes(term) || accountId.includes(term) || 
             status.includes(term)
    })
  }, [allInvestments, investmentsSearch])

  const sortedAccountUsers = useMemo(() => {
    return [...nonAdminUsers].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
  }, [nonAdminUsers])

  const filteredAccountUsers = useMemo(() => {
    if (!accountsSearch.trim()) return sortedAccountUsers
    const term = accountsSearch.toLowerCase()
    return sortedAccountUsers.filter(user => {
      const accountId = (user.id || '').toString().toLowerCase()
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
      const email = (user.email || '').toLowerCase()
      const jointEmail = (user.jointHolder?.email || '').toLowerCase()
      const jointName = `${user.jointHolder?.firstName || ''} ${user.jointHolder?.lastName || ''}`.toLowerCase()
      return accountId.includes(term) || fullName.includes(term) || 
             email.includes(term) || jointEmail.includes(term) || 
             jointName.includes(term)
    })
  }, [sortedAccountUsers, accountsSearch])

  // Investment operations
  const approveInvestment = async (userId, investmentId) => {
    try {
      setSavingId(investmentId)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'updateInvestment',
          investmentId,
          adminUserId: currentUser?.id,
          fields: { status: 'active' }
        })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to confirm investment')
        return
      }
      await refreshUsers()
    } catch (e) {
      console.error('Confirm failed', e)
      alert('An error occurred. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const rejectInvestment = async (userId, investmentId) => {
    try {
      setSavingId(investmentId)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'updateInvestment',
          investmentId,
          adminUserId: currentUser?.id,
          fields: { status: 'rejected' }
        })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to reject investment')
        return
      }
      await refreshUsers()
    } catch (e) {
      console.error('Reject failed', e)
      alert('An error occurred. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  // Withdrawal operations
  const actOnWithdrawal = async (action, userId, withdrawalId) => {
    try {
      const res = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, withdrawalId })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to update withdrawal')
        return
      }
      await refreshWithdrawals()
      await refreshUsers()
      alert('Withdrawal updated successfully')
    } catch (e) {
      console.error('Failed to update withdrawal', e)
      alert('An error occurred')
    }
  }

  // Payout operations
  const handlePayoutAction = async (action, userId, transactionId, failureReason = null) => {
    try {
      const res = await fetch('/api/admin/pending-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, transactionId, failureReason })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to process payout action')
        return
      }
      alert(data.message || 'Payout updated successfully')
      await refreshPayouts()
      await refreshUsers()
    } catch (e) {
      console.error('Failed to process payout action', e)
      alert('An error occurred')
    }
  }

  // Time machine operations
  const updateAppTime = async (newAppTime) => {
    try {
      const res = await fetch('/api/admin/time-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appTime: new Date(newAppTime).toISOString(),
          adminUserId: currentUser.id
        })
      })
      
      const data = await res.json()
      if (data.success) {
        setTimeMachineData({
          appTime: data.appTime,
          isActive: true,
          realTime: new Date().toISOString()
        })
        alert('Time machine updated successfully!')
        await refreshUsers()
      } else {
        alert(data.error || 'Failed to update app time')
      }
    } catch (e) {
      console.error('Failed to update app time', e)
      alert('An error occurred while updating app time')
    }
  }

  const resetAppTime = async () => {
    try {
      const res = await fetch(`/api/admin/time-machine?adminUserId=${currentUser.id}`, {
        method: 'DELETE'
      })
      
      const data = await res.json()
      if (data.success) {
        const realTime = new Date().toISOString()
        setTimeMachineData({
          appTime: realTime,
          isActive: false,
          realTime
        })
        alert('Time machine reset to real time!')
        await refreshUsers()
        return { appTime: realTime }
      } else {
        alert(data.error || 'Failed to reset app time')
      }
    } catch (e) {
      console.error('Failed to reset app time', e)
      alert('An error occurred while resetting app time')
    }
    return null
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.main}>
        <AdminHeader onTabChange={setActiveTab} activeTab={activeTab} />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.loadingState}>Loading admin dashboard...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.main}>
      <AdminHeader onTabChange={setActiveTab} activeTab={activeTab} />
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Admin Dashboard</h1>
              <p className={styles.subtitle}>
                {activeTab === 'dashboard' && 'Overview of platform metrics and recent activity'}
                {activeTab === 'transactions' && 'Manage and approve investment transactions'}
                {activeTab === 'accounts' && 'View and manage user accounts'}
                {activeTab === 'operations' && 'Manage withdrawals, payouts, and system operations'}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && <DashboardTab metrics={metrics} />}

          {activeTab === 'operations' && (
            <OperationsTab
              withdrawals={withdrawals}
              isLoadingWithdrawals={isLoadingWithdrawals}
              pendingPayouts={pendingPayouts}
              isLoadingPayouts={isLoadingPayouts}
              timeMachineData={timeMachineData}
              currentUser={currentUser}
              onWithdrawalAction={actOnWithdrawal}
              onPayoutAction={handlePayoutAction}
              onTimeMachineUpdate={updateAppTime}
              onTimeMachineReset={resetAppTime}
              onRefreshWithdrawals={refreshWithdrawals}
              onRefreshPayouts={refreshPayouts}
            />
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div>
              <div className={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search by investment ID, account ID, name, email, or status..."
                  value={investmentsSearch}
                  onChange={(e) => setInvestmentsSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.accountsGrid}>
                {filteredInvestments.map(inv => (
                  <div
                    key={`${inv.user.id}-${inv.id}`}
                    className={styles.accountCard}
                    onClick={() => router.push(`/admin/investments/${inv.id}`)}
                  >
                    <div className={styles.accountCardHeader}>
                      <div>
                        <div className={styles.investmentId}>Investment #{inv.id}</div>
                        <div className={styles.accountId} style={{ fontSize: '12px', marginTop: '4px' }}>
                          Account #{inv.user.id}
                        </div>
                      </div>
                      <div className={styles.accountBadges}>
                        <div className={styles.investmentStatus} data-status={inv.status}>
                          {inv.status}
                        </div>
                        {inv.user.accountType === 'joint' && <span className={styles.jointBadge}>Joint</span>}
                      </div>
                    </div>

                    <div className={styles.accountCardBody}>
                      <div className={styles.accountName}>
                        {inv.user.firstName || '-'} {inv.user.lastName || ''}
                      </div>
                      <div className={styles.accountEmail}>{inv.user.email || '-'}</div>
                      {inv.user.accountType === 'joint' && inv.user.jointHolder?.email && (
                        <div className={styles.accountJointEmail}>Joint: {inv.user.jointHolder.email}</div>
                      )}
                      <div className={styles.accountPhone}>{inv.user.phone || '-'}</div>
                    </div>

                    <div className={styles.accountCardFooter}>
                      <div className={styles.accountStat}>
                        <div className={styles.statLabel}>Amount</div>
                        <div className={styles.statValue}>${(inv.amount || 0).toLocaleString()}</div>
                      </div>
                      <div className={styles.accountStat}>
                        <div className={styles.statLabel}>Lockup</div>
                        <div className={styles.statValue}>{inv.lockupPeriod || '-'}</div>
                      </div>
                      <div className={styles.accountStat}>
                        <div className={styles.statLabel}>Frequency</div>
                        <div className={styles.statValue}>{inv.paymentFrequency || '-'}</div>
                      </div>
                      <div className={styles.accountStat}>
                        <div className={styles.statLabel}>Created</div>
                        <div className={styles.statValue}>
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}
                        </div>
                      </div>
                    </div>

                    <div className={styles.accountCardActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.approveButton}
                        disabled={savingId === inv.id || inv.status === 'active' || inv.status === 'withdrawn' || inv.status === 'rejected'}
                        onClick={(e) => { e.stopPropagation(); approveInvestment(inv.user.id, inv.id); }}
                      >
                        {inv.status === 'active' ? 'Active' :
                          inv.status === 'withdrawn' ? 'Withdrawn' :
                          inv.status === 'rejected' ? 'Rejected' :
                          (savingId === inv.id ? 'Approving...' : 'Approve')}
                      </button>
                      {inv.status !== 'active' && inv.status !== 'withdrawn' && (
                        <button
                          className={styles.dangerButton}
                          disabled={savingId === inv.id || inv.status === 'rejected'}
                          onClick={(e) => { e.stopPropagation(); rejectInvestment(inv.user.id, inv.id); }}
                        >
                          {inv.status === 'rejected' ? 'Rejected' : (savingId === inv.id ? 'Rejecting...' : 'Reject')}
                        </button>
                      )}
                      <button
                        className={styles.secondaryButton}
                        onClick={(e) => { e.stopPropagation(); router.push(`/admin/users/${inv.user.id}`); }}
                      >
                        View Account
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <div>
              <div className={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={accountsSearch}
                  onChange={(e) => setAccountsSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.accountsGrid}>
                {filteredAccountUsers.map(user => {
                  const investedAmount = (user.investments || [])
                    .filter(inv => inv.status === 'active' || inv.status === 'approved' || inv.status === 'invested')
                    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
                  return (
                    <div
                      key={user.id}
                      className={styles.accountCard}
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <div className={styles.accountCardHeader}>
                        <div className={styles.accountId}>Account #{user.id}</div>
                        <div className={styles.accountBadges}>
                          {user.isVerified && <span className={styles.verifiedBadge}>✓ Verified</span>}
                          {user.accountType === 'joint' && <span className={styles.jointBadge}>Joint</span>}
                        </div>
                      </div>
                      <div className={styles.accountCardBody}>
                        <div className={styles.accountName}>{user.firstName || '-'} {user.lastName || ''}</div>
                        <div className={styles.accountEmail}>{user.email || '-'}</div>
                        {user.accountType === 'joint' && user.jointHolder?.email && (
                          <div className={styles.accountJointEmail}>Joint: {user.jointHolder.email}</div>
                        )}
                        <div className={styles.accountPhone}>{user.phone || user.phoneNumber || '-'}</div>
                      </div>
                      <div className={styles.accountCardFooter}>
                        <div className={styles.accountStat}>
                          <div className={styles.statLabel}>Investments</div>
                          <div className={styles.statValue}>{(user.investments || []).length}</div>
                        </div>
                        <div className={styles.accountStat}>
                          <div className={styles.statLabel}>Invested</div>
                          <div className={styles.statValue}>${investedAmount.toLocaleString()}</div>
                        </div>
                        <div className={styles.accountStat}>
                          <div className={styles.statLabel}>Created</div>
                          <div className={styles.statValue}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</div>
                        </div>
                      </div>
                      <div className={styles.accountCardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={styles.dangerButton}
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm('Are you sure you want to delete this account? This cannot be undone.')) return
                            try {
                              const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
                              const data = await res.json()
                              if (!data.success) {
                                alert(data.error || 'Failed to delete user')
                                return
                              }
                              await refreshUsers()
                            } catch (e) {
                              console.error('Delete failed', e)
                              alert('An error occurred. Please try again.')
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

