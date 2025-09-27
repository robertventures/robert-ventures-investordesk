'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '../components/AdminHeader'
import styles from './page.module.css'

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard' | 'investments' | 'accounts' | 'deletions'
  const [investmentsSearch, setInvestmentsSearch] = useState('')
  const [accountsSearch, setAccountsSearch] = useState('')
  const [timeMachineData, setTimeMachineData] = useState({ appTime: null, isActive: false })
  const [newAppTime, setNewAppTime] = useState('')
  const [isUpdatingTime, setIsUpdatingTime] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const userId = localStorage.getItem('currentUserId')
        if (!userId) {
          router.push('/')
          return
        }
        // Load current user for gate
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

        // Load all users
        const res = await fetch('/api/users')
        const data = await res.json()
        if (data.success) {
          setUsers(data.users || [])
        }

        // Load time machine data
        const timeRes = await fetch('/api/admin/time-machine')
        const timeData = await timeRes.json()
        if (timeData.success) {
          setTimeMachineData({
            appTime: timeData.appTime,
            isActive: timeData.isTimeMachineActive,
            realTime: timeData.realTime
          })
          // Set input to current app time for easy editing
          setNewAppTime(new Date(timeData.appTime).toISOString().slice(0, 16))
        }

        // Notifications removed
      } catch (e) {
        console.error('Failed to load admin data', e)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [router])

  const refreshUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      if (data.success) setUsers(data.users || [])
    } catch (e) {
      console.error('Failed to refresh users', e)
    }
  }

  // Notifications removed

  const approveInvestment = async (userId, investmentId) => {
    try {
      setSavingId(investmentId)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'updateInvestment',
          investmentId,
          fields: { status: 'confirmed', confirmedAt: new Date().toISOString() }
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

  const updateAppTime = async () => {
    if (!newAppTime) {
      alert('Please enter a valid date and time')
      return
    }
    
    setIsUpdatingTime(true)
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
        // Refresh users to see updated calculations
        await refreshUsers()
      } else {
        alert(data.error || 'Failed to update app time')
      }
    } catch (e) {
      console.error('Failed to update app time', e)
      alert('An error occurred while updating app time')
    } finally {
      setIsUpdatingTime(false)
    }
  }

  const resetAppTime = async () => {
    setIsUpdatingTime(true)
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
        setNewAppTime(new Date(realTime).toISOString().slice(0, 16))
        alert('Time machine reset to real time!')
        // Refresh users to see updated calculations
        await refreshUsers()
      } else {
        alert(data.error || 'Failed to reset app time')
      }
    } catch (e) {
      console.error('Failed to reset app time', e)
      alert('An error occurred while resetting app time')
    } finally {
      setIsUpdatingTime(false)
    }
  }

  const approveDeletion = async (userId) => {
    try {
      setSavingId(userId)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'approveDeletion' })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to approve deletion')
        return
      }
      alert('Account deleted successfully')
      await refreshUsers()
    } catch (e) {
      console.error('Approve deletion failed', e)
      alert('An error occurred. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const rejectDeletion = async (userId) => {
    try {
      setSavingId(userId)
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'rejectDeletion' })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to reject deletion')
        return
      }
      alert('Deletion request rejected')
      await refreshUsers()
    } catch (e) {
      console.error('Reject deletion failed', e)
      alert('An error occurred. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('signupEmail')
    localStorage.removeItem('currentInvestmentId')
    router.push('/')
  }

  if (isLoading) {
    return (
      <div className={styles.main}>
        <AdminHeader onTabChange={setActiveTab} activeTab={activeTab} />
        <div className={styles.container}>
          <div className={styles.content}>Loading admin dashboard...</div>
        </div>
      </div>
    )
  }

  const nonAdminUsers = (users || []).filter(u => !u.isAdmin)
  const activeAccountsCount = nonAdminUsers.length
  const investorsCount = nonAdminUsers.filter(u => (u.investments || []).length > 0).length
  const { pendingTotal, raisedTotal } = nonAdminUsers.reduce((acc, u) => {
    (u.investments || []).forEach(inv => {
      const amount = inv.amount || 0
      if (inv.status === 'approved' || inv.status === 'invested') {
        acc.raisedTotal += amount
      } else {
        acc.pendingTotal += amount
      }
    })
    return acc
  }, { pendingTotal: 0, raisedTotal: 0 })

  // Filter functions for search
  const filterUsersBySearch = (users, searchTerm) => {
    if (!searchTerm.trim()) return users
    const term = searchTerm.toLowerCase()
    return users.filter(user => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase()
      const email = (user.email || '').toLowerCase()
      return fullName.includes(term) || email.includes(term)
    })
  }

  const filteredInvestmentUsers = filterUsersBySearch(nonAdminUsers, investmentsSearch).filter(user => (user.investments || []).length > 0)
  const filteredAccountUsers = filterUsersBySearch(nonAdminUsers, accountsSearch)

  return (
    <div className={styles.main}>
      <AdminHeader onTabChange={setActiveTab} activeTab={activeTab} />
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Admin Dashboard</h1>
              <p className={styles.subtitle}>Manage users and approve investments.</p>
            </div>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>ACTIVE ACCOUNTS</div>
              <div className={styles.metricValue}>{activeAccountsCount}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>NUMBER OF INVESTORS</div>
              <div className={styles.metricValue}>{investorsCount}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL PENDING</div>
              <div className={styles.metricValue}>${pendingTotal.toLocaleString()}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL AMOUNT RAISED</div>
              <div className={styles.metricValue}>${raisedTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* Time Machine Controls */}
          <div className={styles.timeMachineSection}>
            <h3 className={styles.timeMachineTitle}>
              🕐 Time Machine {timeMachineData.isActive && <span className={styles.activeIndicator}>(ACTIVE)</span>}
            </h3>
            <div className={styles.timeMachineControls}>
              <div className={styles.timeDisplay}>
                <div className={styles.timeRow}>
                  <span className={styles.timeLabel}>App Time:</span>
                  <span className={styles.timeValue} style={{ color: timeMachineData.isActive ? '#dc2626' : '#059669' }}>
                    {timeMachineData.appTime ? new Date(timeMachineData.appTime).toLocaleString() : 'Loading...'}
                  </span>
                </div>
                {timeMachineData.isActive && (
                  <div className={styles.timeRow}>
                    <span className={styles.timeLabel}>Real Time:</span>
                    <span className={styles.timeValue}>
                      {timeMachineData.realTime ? new Date(timeMachineData.realTime).toLocaleString() : 'Loading...'}
                    </span>
                  </div>
                )}
              </div>
              <div className={styles.timeControls}>
                <input
                  type="datetime-local"
                  value={newAppTime}
                  onChange={(e) => setNewAppTime(e.target.value)}
                  className={styles.timeInput}
                  disabled={isUpdatingTime}
                />
                <button
                  onClick={updateAppTime}
                  disabled={isUpdatingTime}
                  className={styles.timeMachineButton}
                >
                  {isUpdatingTime ? 'Updating...' : 'Set Time'}
                </button>
                {timeMachineData.isActive && (
                  <button
                    onClick={resetAppTime}
                    disabled={isUpdatingTime}
                    className={styles.resetTimeButton}
                  >
                    Reset to Real Time
                  </button>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'dashboard' && (
            <div className={styles.dashboardContent}>
              <div className={styles.dashboardSection}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                <div className={styles.activitySummary}>
                  <p className={styles.activityItem}>
                    Total registered users: <strong>{nonAdminUsers.length}</strong>
                  </p>
                  <p className={styles.activityItem}>
                    Active investors: <strong>{investorsCount}</strong>
                  </p>
                  <p className={styles.activityItem}>
                    Pending investment approvals: <strong>{nonAdminUsers.reduce((count, u) => count + (u.investments || []).filter(inv => inv.status === 'pending').length, 0)}</strong>
                  </p>
                  <p className={styles.activityItem}>
                    Deletion requests: <strong>{nonAdminUsers.filter(user => user.deletionRequestedAt && user.accountStatus === 'deletion_requested').length}</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'investments' && (
            <div>
              <div className={styles.searchContainer}>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={investmentsSearch}
                  onChange={(e) => setInvestmentsSearch(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Investments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvestmentUsers.map(user => (
                    <tr key={user.id}>
                      <td>{user.firstName || '-'} {user.lastName || ''}</td>
                      <td>{user.email}</td>
                      <td>
                        {(user.investments && user.investments.length > 0) ? (
                          <div className={styles.investments}>
                            {user.investments.map(inv => (
                              <div key={inv.id} className={styles.invRow}>
                                <div className={styles.invCol}><b>ID:</b> {inv.id}</div>
                                <div className={styles.invCol}><b>Amount:</b> ${inv.amount?.toLocaleString() || 0}</div>
                                <div className={styles.invCol}><b>Status:</b> {inv.status}</div>
                                <div className={styles.invCol}><b>Created:</b> {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</div>
                                <div className={styles.invActions}>
                                  <button
                                    className={styles.approveButton}
                                    disabled={savingId === inv.id || inv.status === 'confirmed' || inv.status === 'withdrawn'}
                                    onClick={() => approveInvestment(user.id, inv.id)}
                                  >
                                    {inv.status === 'confirmed' ? 'Confirmed' : 
                                     inv.status === 'withdrawn' ? 'Withdrawn' : 
                                     (savingId === inv.id ? 'Confirming...' : 'Confirm')}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.muted}>No investments</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

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
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Created</th>
                      <th>Verified</th>
                      <th>Investments</th>
                      <th>Invested</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccountUsers.map(user => (
                    <tr key={user.id}>
                      <td>
                        <button 
                          className={styles.linkButton}
                          onClick={() => router.push(`/admin/users/${user.id}`)}
                        >
                          {user.firstName || '-'} {user.lastName || ''}
                        </button>
                      </td>
                      <td>{user.email}</td>
                      <td>{user.phoneNumber || '-'}</td>
                      <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                      <td>{user.isVerified ? 'Yes' : 'No'}</td>
                      <td>{(user.investments || []).length}</td>
                      <td>
                        ${((user.investments || []).filter(inv => inv.status === 'approved' || inv.status === 'invested').reduce((sum, inv) => sum + (inv.amount || 0), 0)).toLocaleString()}
                      </td>
                      <td>
                        <div className={styles.actionGroup}>
                          <button 
                            className={styles.secondaryButton}
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                          >
                            View
                          </button>
                          <button 
                            className={styles.dangerButton}
                            onClick={async () => {
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {activeTab === 'deletions' && (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Requested</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {nonAdminUsers
                    .filter(user => user.deletionRequestedAt && user.accountStatus === 'deletion_requested')
                    .map(user => (
                      <tr key={user.id}>
                        <td>
                          <button
                            className={styles.linkButton}
                            onClick={() => router.push(`/admin/users/${user.id}`)}
                          >
                            {user.firstName || '-'} {user.lastName || ''}
                          </button>
                        </td>
                        <td>{user.email}</td>
                        <td>{user.deletionRequestedAt ? new Date(user.deletionRequestedAt).toLocaleDateString() : '-'}</td>
                        <td>
                          <div className={styles.deletionReason}>
                            {user.deletionReason || 'No reason provided'}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              className={styles.dangerButton}
                              disabled={savingId === user.id}
                              onClick={() => {
                                if (confirm(`Are you sure you want to permanently delete ${user.firstName} ${user.lastName}'s account? This cannot be undone.`)) {
                                  approveDeletion(user.id)
                                }
                              }}
                            >
                              {savingId === user.id ? 'Deleting...' : 'Approve Deletion'}
                            </button>
                            <button
                              className={styles.secondaryButton}
                              disabled={savingId === user.id}
                              onClick={() => {
                                if (confirm(`Are you sure you want to reject ${user.firstName} ${user.lastName}'s deletion request?`)) {
                                  rejectDeletion(user.id)
                                }
                              }}
                            >
                              {savingId === user.id ? 'Rejecting...' : 'Reject Request'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {nonAdminUsers.filter(user => user.deletionRequestedAt && user.accountStatus === 'deletion_requested').length === 0 && (
                    <tr>
                      <td colSpan="5" className={styles.emptyState}>No deletion requests pending review</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Notifications UI removed */}
        </div>
      </div>
    </div>
  )
}


