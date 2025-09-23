'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import styles from './page.module.css'

export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [activeTab, setActiveTab] = useState('investments') // 'investments' | 'accounts'

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
          fields: { status: 'approved', approvedAt: new Date().toISOString() }
        })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to approve investment')
        return
      }
      await refreshUsers()
    } catch (e) {
      console.error('Approve failed', e)
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
      <main className={styles.main}>
        <Header />
        <div className={styles.container}>
          <div className={styles.card}>Loading admin dashboard...</div>
        </div>
      </main>
    )
  }

  const nonAdminUsers = (users || []).filter(u => !u.isAdmin)
  const investorsCount = nonAdminUsers.filter(u => (u.investments || []).length > 0).length
  const { pendingTotal, approvedTotal } = nonAdminUsers.reduce((acc, u) => {
    (u.investments || []).forEach(inv => {
      const amount = inv.amount || 0
      if (inv.status === 'approved' || inv.status === 'invested') {
        acc.approvedTotal += amount
      } else {
        acc.pendingTotal += amount
      }
    })
    return acc
  }, { pendingTotal: 0, approvedTotal: 0 })

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div>
              <h1 className={styles.title}>Admin Dashboard</h1>
              <p className={styles.subtitle}>Manage users and approve investments.</p>
            </div>
            <button className={styles.secondaryButton} onClick={handleLogout}>Sign Out</button>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>ACTIVE ACCOUNTS</div>
              <div className={styles.metricValue}>{investorsCount}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL PENDING</div>
              <div className={styles.metricValue}>${pendingTotal.toLocaleString()}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL APPROVED</div>
              <div className={styles.metricValue}>${approvedTotal.toLocaleString()}</div>
            </div>
          </div>

          <div className={styles.tabs}>
            <button className={`${styles.tab} ${activeTab === 'investments' ? styles.active : ''}`} onClick={() => setActiveTab('investments')}>Investments</button>
            <button className={`${styles.tab} ${activeTab === 'accounts' ? styles.active : ''}`} onClick={() => setActiveTab('accounts')}>Accounts</button>
            {/* Notifications tab removed */}
          </div>

          {activeTab === 'investments' && (
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
                  {nonAdminUsers.map(user => (
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
                                    disabled={savingId === inv.id || inv.status === 'approved' || inv.status === 'invested'}
                                    onClick={() => approveInvestment(user.id, inv.id)}
                                  >
                                    {inv.status === 'approved' || inv.status === 'invested' ? 'Approved' : (savingId === inv.id ? 'Approving...' : 'Approve')}
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
          )}

          {activeTab === 'accounts' && (
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
                  {nonAdminUsers.map(user => (
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
          )}

          {/* Notifications UI removed */}
        </div>
      </div>
    </main>
  )
}


