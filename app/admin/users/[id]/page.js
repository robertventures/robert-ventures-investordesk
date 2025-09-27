'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../../../components/Header'
import styles from './page.module.css'

export default function AdminUserDetailsPage({ params }) {
  const router = useRouter()
  const { id } = params
  const [currentUser, setCurrentUser] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const meId = localStorage.getItem('currentUserId')
        if (!meId) {
          router.push('/')
          return
        }
        const meRes = await fetch(`/api/users/${meId}`)
        const meData = await meRes.json()
        if (!meData.success || !meData.user || !meData.user.isAdmin) {
          router.push('/dashboard')
          return
        }
        setCurrentUser(meData.user)

        const res = await fetch(`/api/users/${id}`)
        const data = await res.json()
        if (data.success) setUser(data.user)
      } catch (e) {
        console.error('Failed to load user', e)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [id, router])

  if (isLoading) {
    return (
      <main className={styles.main}>
        <Header />
        <div className={styles.container}><div className={styles.card}>Loading user...</div></div>
      </main>
    )
  }

  if (!user) {
    return (
      <main className={styles.main}>
        <Header />
        <div className={styles.container}><div className={styles.card}>User not found.</div></div>
      </main>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('signupEmail')
    localStorage.removeItem('currentInvestmentId')
    router.push('/')
  }

  const investedTotal = (user.investments || []).filter(inv => inv.status === 'confirmed').reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const pendingTotal = (user.investments || []).filter(inv => inv.status === 'pending' || inv.status === 'draft').reduce((sum, inv) => sum + (inv.amount || 0), 0)

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.headerRow}>
            <div>
              <button className={styles.backButton} onClick={() => router.push('/admin')}>← Back</button>
              <h1 className={styles.title}>User Account</h1>
              <p className={styles.subtitle}>{user.firstName} {user.lastName} — {user.email}</p>
            </div>
            <button className={styles.secondaryButton} onClick={handleLogout}>Sign Out</button>
          </div>

          <div className={styles.metrics}>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>INVESTMENTS</div>
              <div className={styles.metricValue}>{(user.investments || []).length}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL PENDING</div>
              <div className={styles.metricValue}>${pendingTotal.toLocaleString()}</div>
            </div>
            <div className={styles.metric}>
              <div className={styles.metricLabel}>TOTAL APPROVED</div>
              <div className={styles.metricValue}>${investedTotal.toLocaleString()}</div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Profile</h2>
            <div className={styles.grid}>
              <div><b>Name:</b> {user.firstName} {user.lastName}</div>
              <div><b>Email:</b> {user.email}</div>
              <div><b>Phone:</b> {user.phoneNumber || '-'}</div>
              <div><b>Verified:</b> {user.isVerified ? 'Yes' : 'No'}</div>
              <div><b>Created:</b> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</div>
              <div><b>Address:</b> {user.address ? `${user.address.street1 || ''} ${user.address.city || ''} ${user.address.state || ''} ${user.address.zip || ''}` : '-'}</div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Investments</h2>
            {(user.investments && user.investments.length > 0) ? (
              <div className={styles.list}>
                {user.investments.map(inv => (
                  <div key={inv.id} className={styles.invRow}>
                    <div><b>ID:</b> {inv.id}</div>
                    <div><b>Amount:</b> ${inv.amount?.toLocaleString() || 0}</div>
                    <div><b>Status:</b> {inv.status}</div>
                    <div><b>Created:</b> {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</div>
                    <div><b>Type:</b> {inv.accountType || '-'}</div>
                    <div><b>Lockup:</b> {inv.lockupPeriod || '-'}</div>
                    <div><b>Frequency:</b> {inv.paymentFrequency || '-'}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>No investments</div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}


