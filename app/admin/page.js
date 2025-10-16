'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminHeader from '../components/AdminHeader'
import { useAdminData } from './hooks/useAdminData'
import { useAdminMetrics } from './hooks/useAdminMetrics'
import DashboardTab from './components/DashboardTab'
import OperationsTab from './components/OperationsTab'
import ActivityTab from './components/ActivityTab'
import DistributionsTab from './components/DistributionsTab'
import { calculateInvestmentValue } from '../../lib/investmentCalculations'
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
    const allowed = ['dashboard', 'accounts', 'distributions', 'activity', 'operations']
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
  const metrics = useAdminMetrics(users, withdrawals, pendingPayouts, timeMachineData?.appTime)

  // State for specific tab operations
  const [savingId, setSavingId] = useState(null)
  const [accountsSearch, setAccountsSearch] = useState('')
  const [isDeletingAccounts, setIsDeletingAccounts] = useState(false)
  const [isSeedingAccounts, setIsSeedingAccounts] = useState(false)
  
  // State for account filters
  const [showFilters, setShowFilters] = useState(false)
  const [accountFilters, setAccountFilters] = useState({
    hasInvestments: 'all', // 'all', 'with', 'without'
    investmentAmountMin: '',
    investmentAmountMax: '',
    investmentValueMin: '',
    investmentValueMax: '',
    createdDateStart: '',
    createdDateEnd: '',
    numInvestmentsMin: '',
    numInvestmentsMax: ''
  })

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
              phoneNumber: user.phoneNumber,
              dob: user.dob,
              ssn: user.ssn,
              address: user.address,
              bankAccounts: user.bankAccounts,
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

  // Get pending investments for dashboard
  const pendingInvestments = useMemo(() => {
    return allInvestments.filter(inv => inv.status === 'pending')
  }, [allInvestments])

  const sortedAccountUsers = useMemo(() => {
    return [...nonAdminUsers].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
  }, [nonAdminUsers])

  const filteredAccountUsers = useMemo(() => {
    let filtered = sortedAccountUsers
    
    // Apply search filter
    if (accountsSearch.trim()) {
      const term = accountsSearch.toLowerCase()
      filtered = filtered.filter(user => {
        const accountId = (user.id || '').toString().toLowerCase()
        const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
        const email = (user.email || '').toLowerCase()
        const jointEmail = (user.jointHolder?.email || '').toLowerCase()
        const jointName = `${user.jointHolder?.firstName || ''} ${user.jointHolder?.lastName || ''}`.toLowerCase()
        return accountId.includes(term) || fullName.includes(term) || 
               email.includes(term) || jointEmail.includes(term) || 
               jointName.includes(term)
      })
    }
    
    // Apply account filters
    filtered = filtered.filter(user => {
      const activeInvestments = (user.investments || []).filter(inv => 
        inv.status === 'active' || inv.status === 'withdrawal_notice'
      )
      const numInvestments = activeInvestments.length
      const investedAmount = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
      const accountValue = activeInvestments.reduce((sum, inv) => {
        const calculation = calculateInvestmentValue(inv, timeMachineData.appTime)
        return sum + calculation.currentValue
      }, 0)
      
      // Filter by has investments
      if (accountFilters.hasInvestments === 'with' && numInvestments === 0) return false
      if (accountFilters.hasInvestments === 'without' && numInvestments > 0) return false
      
      // Filter by investment amount (original principal)
      if (accountFilters.investmentAmountMin && investedAmount < Number(accountFilters.investmentAmountMin)) return false
      if (accountFilters.investmentAmountMax && investedAmount > Number(accountFilters.investmentAmountMax)) return false
      
      // Filter by account value (current value with compound interest)
      if (accountFilters.investmentValueMin && accountValue < Number(accountFilters.investmentValueMin)) return false
      if (accountFilters.investmentValueMax && accountValue > Number(accountFilters.investmentValueMax)) return false
      
      // Filter by number of investments
      if (accountFilters.numInvestmentsMin && numInvestments < Number(accountFilters.numInvestmentsMin)) return false
      if (accountFilters.numInvestmentsMax && numInvestments > Number(accountFilters.numInvestmentsMax)) return false
      
      // Filter by created date
      if (accountFilters.createdDateStart && user.createdAt) {
        const userDate = new Date(user.createdAt).setHours(0,0,0,0)
        const filterDate = new Date(accountFilters.createdDateStart).setHours(0,0,0,0)
        if (userDate < filterDate) return false
      }
      if (accountFilters.createdDateEnd && user.createdAt) {
        const userDate = new Date(user.createdAt).setHours(0,0,0,0)
        const filterDate = new Date(accountFilters.createdDateEnd).setHours(0,0,0,0)
        if (userDate > filterDate) return false
      }
      
      return true
    })
    
    return filtered
  }, [sortedAccountUsers, accountsSearch, accountFilters, timeMachineData.appTime])

  // Helper function to check if user profile is complete for investment approval
  const isProfileComplete = (user) => {
    if (!user) return false
    
    // Check personal details
    const hasPersonalDetails = user.firstName && 
                               user.lastName && 
                               (user.phone || user.phoneNumber) &&
                               user.dob &&
                               user.ssn
    
    // Check address
    const hasAddress = user.address && 
                      user.address.street1 && 
                      user.address.city && 
                      user.address.state && 
                      user.address.zip
    
    // Check bank connection
    const hasBankConnection = user.bankAccounts && 
                             user.bankAccounts.length > 0
    
    return hasPersonalDetails && hasAddress && hasBankConnection
  }

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
    if (!currentUser || !currentUser.id) {
      alert('Current user not loaded. Please refresh the page.')
      return
    }
    
    try {
      const res = await fetch('/api/admin/time-machine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appTime: new Date(newAppTime).toISOString(),
          adminUserId: currentUser.id
        })
      })
      
      if (!res.ok) {
        console.error('Response not OK:', res.status, res.statusText)
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
      const data = await res.json()
      
      if (data.success) {
        setTimeMachineData({
          appTime: data.appTime,
          isActive: true,
          realTime: new Date().toISOString()
        })
        
        // Manually trigger transaction sync
        try {
          await fetch('/api/migrate-transactions', { method: 'POST' })
        } catch (syncErr) {
          console.error('Failed to sync transactions:', syncErr)
        }
        
        alert('Time machine updated successfully!')
        await refreshUsers()
      } else {
        alert(data.error || 'Failed to update app time')
      }
    } catch (e) {
      console.error('Failed to update app time', e)
      alert('An error occurred while updating app time: ' + e.message)
    }
  }

  const resetAppTime = async () => {
    try {
      const res = await fetch(`/api/admin/time-machine?adminUserId=${currentUser.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      
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

  const deleteAllAccounts = async () => {
    if (!confirm('Delete ALL accounts? This will remove every non-admin user.')) return
    setIsDeletingAccounts(true)
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentUser.id })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to delete accounts')
        return
      }
      alert('All non-admin accounts deleted. Reloading users...')
      await refreshUsers()
    } catch (error) {
      console.error('Failed to delete accounts', error)
      alert('An error occurred while deleting accounts')
    } finally {
      setIsDeletingAccounts(false)
    }
  }

  const seedTestAccounts = async () => {
    if (!confirm('Seed test accounts? This will create the full local dataset.')) return
    setIsSeedingAccounts(true)
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminUserId: currentUser.id })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to seed accounts')
        return
      }
      alert('Test accounts seeded successfully! Reloading users...')
      await refreshUsers()
    } catch (error) {
      console.error('Failed to seed accounts', error)
      alert('An error occurred while seeding accounts')
    } finally {
      setIsSeedingAccounts(false)
    }
  }


  const handleImportComplete = async (result) => {
    console.log('Import completed:', result)
    // Refresh users data to show newly imported investors
    await refreshUsers()
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
              <h1 className={styles.title}>
                {activeTab === 'dashboard' && 'Admin Dashboard'}
                {activeTab === 'accounts' && 'Accounts'}
                {activeTab === 'activity' && 'Activity'}
                {activeTab === 'distributions' && 'Transactions'}
                {activeTab === 'operations' && 'Operations'}
              </h1>
              <p className={styles.subtitle}>
                {activeTab === 'dashboard' && 'Overview of platform metrics and recent activity'}
                {activeTab === 'accounts' && 'View and manage user accounts'}
                {activeTab === 'activity' && 'View all activity events across the platform'}
                {activeTab === 'distributions' && 'Track all transactions including investments, monthly payments and compounding interest calculations'}
                {activeTab === 'operations' && 'Manage withdrawals, tax reporting, and system operations'}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <DashboardTab 
              metrics={metrics} 
              pendingInvestments={pendingInvestments}
              pendingPayouts={pendingPayouts}
              isLoadingPayouts={isLoadingPayouts}
              onApprove={approveInvestment}
              onReject={rejectInvestment}
              savingId={savingId}
              onPayoutAction={handlePayoutAction}
              onRefreshPayouts={refreshPayouts}
            />
          )}

          {activeTab === 'operations' && (
            <OperationsTab
              withdrawals={withdrawals}
              isLoadingWithdrawals={isLoadingWithdrawals}
              timeMachineData={timeMachineData}
              currentUser={currentUser}
              onWithdrawalAction={actOnWithdrawal}
              onTimeMachineUpdate={updateAppTime}
              onTimeMachineReset={resetAppTime}
              onDeleteAccounts={deleteAllAccounts}
              onSeedTestAccounts={seedTestAccounts}
              isDeletingAccounts={isDeletingAccounts}
              isSeedingAccounts={isSeedingAccounts}
              onRefreshWithdrawals={refreshWithdrawals}
              onImportComplete={handleImportComplete}
            />
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <ActivityTab users={users || []} />
          )}

          {/* Transactions Tab */}
          {activeTab === 'distributions' && (
            <DistributionsTab users={users || []} timeMachineData={timeMachineData} />
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
                <div style={{ position: 'relative', display: 'inline-block', marginLeft: '12px' }}>
                  <button
                    className={styles.filterButton}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    🔍 Filters
                    {(accountFilters.hasInvestments !== 'all' || 
                      accountFilters.investmentAmountMin || 
                      accountFilters.investmentAmountMax || 
                      accountFilters.investmentValueMin || 
                      accountFilters.investmentValueMax || 
                      accountFilters.createdDateStart || 
                      accountFilters.createdDateEnd || 
                      accountFilters.numInvestmentsMin || 
                      accountFilters.numInvestmentsMax) && 
                      <span className={styles.activeFilterBadge}>●</span>
                    }
                  </button>
                  
                  {showFilters && (
                    <>
                      <div 
                        className={styles.filterOverlay}
                        onClick={() => setShowFilters(false)}
                      />
                      <div className={styles.filterDropdown}>
                        <div className={styles.filterHeader}>
                          <h3>Filter Accounts</h3>
                          <button
                            className={styles.clearFiltersButton}
                            onClick={() => {
                              setAccountFilters({
                                hasInvestments: 'all',
                                investmentAmountMin: '',
                                investmentAmountMax: '',
                                investmentValueMin: '',
                                investmentValueMax: '',
                                createdDateStart: '',
                                createdDateEnd: '',
                                numInvestmentsMin: '',
                                numInvestmentsMax: ''
                              })
                            }}
                          >
                            Clear All
                          </button>
                        </div>
                        
                        <div className={styles.filterSection}>
                          <label className={styles.filterLabel}>Has Investments</label>
                          <select
                            className={styles.filterSelect}
                            value={accountFilters.hasInvestments}
                            onChange={(e) => setAccountFilters({...accountFilters, hasInvestments: e.target.value})}
                          >
                            <option value="all">All Accounts</option>
                            <option value="with">With Investments</option>
                            <option value="without">Without Investments</option>
                          </select>
                        </div>
                        
                        <div className={styles.filterSection}>
                          <label className={styles.filterLabel}>Investment Amount (Principal)</label>
                          <div className={styles.filterRange}>
                            <input
                              type="number"
                              placeholder="Min"
                              className={styles.filterInput}
                              value={accountFilters.investmentAmountMin}
                              onChange={(e) => setAccountFilters({...accountFilters, investmentAmountMin: e.target.value})}
                            />
                            <span>to</span>
                            <input
                              type="number"
                              placeholder="Max"
                              className={styles.filterInput}
                              value={accountFilters.investmentAmountMax}
                              onChange={(e) => setAccountFilters({...accountFilters, investmentAmountMax: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div className={styles.filterSection}>
                          <label className={styles.filterLabel}>Account Value (with Interest)</label>
                          <div className={styles.filterRange}>
                            <input
                              type="number"
                              placeholder="Min"
                              className={styles.filterInput}
                              value={accountFilters.investmentValueMin}
                              onChange={(e) => setAccountFilters({...accountFilters, investmentValueMin: e.target.value})}
                            />
                            <span>to</span>
                            <input
                              type="number"
                              placeholder="Max"
                              className={styles.filterInput}
                              value={accountFilters.investmentValueMax}
                              onChange={(e) => setAccountFilters({...accountFilters, investmentValueMax: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div className={styles.filterSection}>
                          <label className={styles.filterLabel}>Number of Investments</label>
                          <div className={styles.filterRange}>
                            <input
                              type="number"
                              placeholder="Min"
                              className={styles.filterInput}
                              value={accountFilters.numInvestmentsMin}
                              onChange={(e) => setAccountFilters({...accountFilters, numInvestmentsMin: e.target.value})}
                            />
                            <span>to</span>
                            <input
                              type="number"
                              placeholder="Max"
                              className={styles.filterInput}
                              value={accountFilters.numInvestmentsMax}
                              onChange={(e) => setAccountFilters({...accountFilters, numInvestmentsMax: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div className={styles.filterSection}>
                          <label className={styles.filterLabel}>Created Date Range</label>
                          <div className={styles.filterRange}>
                            <input
                              type="date"
                              className={styles.filterInput}
                              value={accountFilters.createdDateStart}
                              onChange={(e) => setAccountFilters({...accountFilters, createdDateStart: e.target.value})}
                            />
                            <span>to</span>
                            <input
                              type="date"
                              className={styles.filterInput}
                              value={accountFilters.createdDateEnd}
                              onChange={(e) => setAccountFilters({...accountFilters, createdDateEnd: e.target.value})}
                            />
                          </div>
                        </div>
                        
                        <div className={styles.filterFooter}>
                          <button
                            className={styles.applyFiltersButton}
                            onClick={() => setShowFilters(false)}
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className={styles.accountsGrid}>
                {filteredAccountUsers.map(user => {
                  const activeInvestments = (user.investments || [])
                    .filter(inv => inv.status === 'active' || inv.status === 'withdrawal_notice')
                  
                  const investedAmount = activeInvestments
                    .reduce((sum, inv) => sum + (inv.amount || 0), 0)
                  
                  // Calculate total account value (including compounding interest)
                  // Use app time from time machine if available
                  const accountValue = activeInvestments
                    .reduce((sum, inv) => {
                      const calculation = calculateInvestmentValue(inv, timeMachineData.appTime)
                      return sum + calculation.currentValue
                    }, 0)
                  
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
                          {!isProfileComplete(user) && (
                            <span className={styles.warningBadge} title="Profile incomplete: Personal details and bank connection required">
                              ⚠ Profile Incomplete
                            </span>
                          )}
                          {user.accountType === 'joint' && <span className={styles.jointBadge}>Joint</span>}
                          {user.accountType === 'individual' && <span className={styles.individualBadge}>Individual</span>}
                          {user.accountType === 'entity' && <span className={styles.entityBadge}>Entity</span>}
                          {user.accountType === 'ira' && <span className={styles.iraBadge}>IRA</span>}
                        </div>
                      </div>
                      <div className={styles.accountCardBody}>
                        <div className={styles.accountEmail}>{user.email || '-'}</div>
                        <div className={styles.accountName}>{user.firstName || '-'} {user.lastName || ''}</div>
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
                          <div className={styles.statLabel}>Account Value</div>
                          <div className={styles.statValue}>${accountValue.toLocaleString()}</div>
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

