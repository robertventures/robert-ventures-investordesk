'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '../../../components/AdminHeader'
import styles from './page.module.css'

export default function AdminInvestmentDetailsPage({ params }) {
  const router = useRouter()
  const { id: investmentId } = params
  const [currentUser, setCurrentUser] = useState(null)
  const [investment, setInvestment] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    amount: '',
    status: '',
    paymentFrequency: '',
    lockupPeriod: '',
    accountType: ''
  })

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

        // Load all users to find the investment
        const usersRes = await fetch('/api/users')
        const usersData = await usersRes.json()
        if (!usersData.success) {
          alert('Failed to load investment data')
          return
        }

        // Find the investment and its owner
        let foundInvestment = null
        let foundUser = null
        for (const u of usersData.users) {
          const inv = (u.investments || []).find(i => i.id === investmentId)
          if (inv) {
            foundInvestment = inv
            foundUser = u
            break
          }
        }

        if (!foundInvestment || !foundUser) {
          alert('Investment not found')
          router.push('/admin?tab=transactions')
          return
        }

        setInvestment(foundInvestment)
        setUser(foundUser)
        setForm({
          amount: foundInvestment.amount || '',
          status: foundInvestment.status || '',
          paymentFrequency: foundInvestment.paymentFrequency || '',
          lockupPeriod: foundInvestment.lockupPeriod || '',
          accountType: foundInvestment.accountType || ''
        })
      } catch (e) {
        console.error('Failed to load investment', e)
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [router, investmentId])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!user || !investment) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _action: 'updateInvestment',
          investmentId: investment.id,
          adminUserId: currentUser?.id,
          fields: {
            amount: parseFloat(form.amount),
            status: form.status,
            paymentFrequency: form.paymentFrequency,
            lockupPeriod: form.lockupPeriod,
            accountType: form.accountType
          }
        })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to update investment')
        return
      }
      alert('Investment updated successfully')
      // Reload the investment data
      const updatedInv = (data.user.investments || []).find(i => i.id === investmentId)
      if (updatedInv) {
        setInvestment(updatedInv)
        setUser(data.user)
      }
    } catch (e) {
      console.error('Failed to save', e)
      alert('An error occurred. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className={styles.main}>
        <AdminHeader activeTab="transactions" />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.loadingState}>Loading investment details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!investment || !user) {
    return (
      <div className={styles.main}>
        <AdminHeader activeTab="transactions" />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.errorState}>Investment not found</div>
          </div>
        </div>
      </div>
    )
  }

  const statusColor = {
    active: '#10b981',
    pending: '#f59e0b',
    rejected: '#ef4444',
    withdrawn: '#6b7280'
  }[investment.status] || '#6b7280'

  return (
    <div className={styles.main}>
      <AdminHeader activeTab="transactions" />
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Breadcrumb Navigation */}
          <div className={styles.breadcrumb}>
            <button className={styles.breadcrumbLink} onClick={() => router.push('/admin?tab=transactions')}>
              ← Transactions
            </button>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Investment #{investment.id}</span>
          </div>

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.title}>Investment Details</h1>
              <p className={styles.subtitle}>
                Account: <button 
                  className={styles.accountLink} 
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  {user.firstName} {user.lastName} ({user.email})
                </button>
              </p>
            </div>
            <div className={styles.headerActions}>
              <span className={styles.statusBadge} style={{ 
                backgroundColor: `${statusColor}20`,
                color: statusColor 
              }}>
                {investment.status?.toUpperCase()}
              </span>
              <button className={styles.secondaryButton} onClick={() => router.push(`/admin/users/${user.id}`)}>
                View Account
              </button>
            </div>
          </div>

          {/* Metrics Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Amount</div>
              <div className={styles.metricValue}>${(investment.amount || 0).toLocaleString()}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Created</div>
              <div className={styles.metricValue}>
                {investment.createdAt ? new Date(investment.createdAt).toLocaleDateString() : '-'}
              </div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Submitted</div>
              <div className={styles.metricValue}>
                {investment.submittedAt ? new Date(investment.submittedAt).toLocaleDateString() : '-'}
              </div>
            </div>
            {investment.confirmedAt && (
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>Confirmed</div>
                <div className={styles.metricValue}>
                  {new Date(investment.confirmedAt).toLocaleDateString()}
                </div>
              </div>
            )}
          </div>

          {/* Investment Details Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Investment Details</h2>
            </div>
            <div className={styles.grid}>
              <div>
                <label>Amount ($)</label>
                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  className={styles.input}
                  min="1000"
                  step="10"
                />
              </div>
              <div>
                <label>Status</label>
                <select name="status" value={form.status} onChange={handleChange} className={styles.input}>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawal_notice">Withdrawal Notice</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>
              <div>
                <label>Payment Frequency</label>
                <select name="paymentFrequency" value={form.paymentFrequency} onChange={handleChange} className={styles.input}>
                  <option value="monthly">Monthly</option>
                  <option value="compounding">Compounding</option>
                </select>
              </div>
              <div>
                <label>Lockup Period</label>
                <select name="lockupPeriod" value={form.lockupPeriod} onChange={handleChange} className={styles.input}>
                  <option value="1-year">1 Year</option>
                  <option value="3-year">3 Years</option>
                </select>
              </div>
              <div>
                <label>Account Type</label>
                <select name="accountType" value={form.accountType} onChange={handleChange} className={styles.input}>
                  <option value="individual">Individual</option>
                  <option value="joint">Joint</option>
                  <option value="entity">Entity</option>
                  <option value="ira">IRA</option>
                </select>
              </div>
            </div>

            <div className={styles.sectionActions}>
              <button
                className={styles.saveButton}
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Dates & Timeline Section */}
          {investment.lockupEndDate && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Dates & Timeline</h2>
              </div>
              <div className={styles.grid}>
                <div>
                  <label>Created At</label>
                  <div className={styles.readOnly}>
                    {investment.createdAt ? new Date(investment.createdAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <label>Submitted At</label>
                  <div className={styles.readOnly}>
                    {investment.submittedAt ? new Date(investment.submittedAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <label>Confirmed At</label>
                  <div className={styles.readOnly}>
                    {investment.confirmedAt ? new Date(investment.confirmedAt).toLocaleString() : '-'}
                  </div>
                </div>
                <div>
                  <label>Lockup End Date</label>
                  <div className={styles.readOnly}>
                    {investment.lockupEndDate ? new Date(investment.lockupEndDate).toLocaleDateString() : '-'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Banking Information Section */}
          {investment.banking && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Banking Information</h2>
              </div>
              <div className={styles.grid}>
                <div>
                  <label>Funding Method</label>
                  <div className={styles.readOnly}>{investment.banking.fundingMethod || '-'}</div>
                </div>
                <div>
                  <label>Earnings Method</label>
                  <div className={styles.readOnly}>{investment.banking.earningsMethod || '-'}</div>
                </div>
                {investment.banking.bank && (
                  <>
                    <div>
                      <label>Bank Nickname</label>
                      <div className={styles.readOnly}>{investment.banking.bank.nickname || '-'}</div>
                    </div>
                    <div>
                      <label>Bank Type</label>
                      <div className={styles.readOnly}>{investment.banking.bank.type?.toUpperCase() || '-'}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Personal Information Section */}
          {investment.personalInfo && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Personal Information</h2>
              </div>
              <div className={styles.grid}>
                <div>
                  <label>First Name</label>
                  <div className={styles.readOnly}>{investment.personalInfo.firstName || '-'}</div>
                </div>
                <div>
                  <label>Last Name</label>
                  <div className={styles.readOnly}>{investment.personalInfo.lastName || '-'}</div>
                </div>
                <div>
                  <label>Date of Birth</label>
                  <div className={styles.readOnly}>{investment.personalInfo.dob || '-'}</div>
                </div>
                <div>
                  <label>SSN</label>
                  <div className={styles.readOnly}>{investment.personalInfo.ssn || '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Address Section */}
          {investment.address && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Address</h2>
              </div>
              <div className={styles.grid}>
                <div>
                  <label>Street 1</label>
                  <div className={styles.readOnly}>{investment.address.street1 || '-'}</div>
                </div>
                <div>
                  <label>Street 2</label>
                  <div className={styles.readOnly}>{investment.address.street2 || '-'}</div>
                </div>
                <div>
                  <label>City</label>
                  <div className={styles.readOnly}>{investment.address.city || '-'}</div>
                </div>
                <div>
                  <label>State</label>
                  <div className={styles.readOnly}>{investment.address.state || '-'}</div>
                </div>
                <div>
                  <label>ZIP Code</label>
                  <div className={styles.readOnly}>{investment.address.zip || '-'}</div>
                </div>
                <div>
                  <label>Country</label>
                  <div className={styles.readOnly}>{investment.address.country || '-'}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

