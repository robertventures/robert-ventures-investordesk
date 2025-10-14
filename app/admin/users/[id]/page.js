'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '../../../components/AdminHeader'
import { calculateInvestmentValue } from '../../../../lib/investmentCalculations'
import styles from './page.module.css'

export default function AdminUserDetailsPage({ params }) {
  const router = useRouter()
  const { id } = params
  const [currentUser, setCurrentUser] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [appTime, setAppTime] = useState(null)
  const [activityPage, setActivityPage] = useState(1)

  const MIN_DOB = '1900-01-01'
  const ACTIVITY_ITEMS_PER_PAGE = 20

  const formatZip = (value = '') => value.replace(/\D/g, '').slice(0, 5)
  const formatPhone = (value = '') => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  const isCompletePhone = (value = '') => value.replace(/\D/g, '').length === 10
  const formatSsn = (value = '') => {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    if (digits.length <= 3) return digits
    if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
  }
  const isCompleteSsn = (value = '') => value.replace(/\D/g, '').length === 9

  const US_STATES = useMemo(() => [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
  ], [])

  const [form, setForm] = useState({
    accountType: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    dob: '',
    ssn: '',
    entityName: '',
    entityTaxId: '',
    entityRegistrationDate: '',
    jointHoldingType: '',
    jointHolder: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dob: '',
      ssn: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States'
    },
    authorizedRep: {
      firstName: '',
      lastName: '',
      dob: '',
      ssn: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States'
    }
  })
  const [errors, setErrors] = useState({})
  // Precompute date boundaries without hooks to avoid hook order issues
  const maxAdultDob = (() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
    return cutoff.toISOString().split('T')[0]
  })()
  const maxToday = (() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  })()

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
        if (data.success) {
          setUser(data.user)
          // Store app time if available
          if (data.appTime) {
            setAppTime(data.appTime)
          }
          const u = data.user
          setForm({
            accountType: u.accountType || 'individual',
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email || '',
            phone: u.phone || u.phoneNumber || '',
            street1: u.address?.street1 || '',
            street2: u.address?.street2 || '',
            city: u.address?.city || '',
            state: u.address?.state || '',
            zip: u.address?.zip || '',
            country: u.address?.country || 'United States',
            dob: u.dob || '',
            ssn: u.ssn || '',
            entityName: u.entity?.name || u.entityName || '',
            entityTaxId: u.entity?.taxId || '',
            entityRegistrationDate: u.entity?.registrationDate || '',
            jointHoldingType: u.jointHoldingType || '',
            jointHolder: {
              firstName: u.jointHolder?.firstName || '',
              lastName: u.jointHolder?.lastName || '',
              email: u.jointHolder?.email || '',
              phone: u.jointHolder?.phone || '',
              dob: u.jointHolder?.dob || '',
              ssn: u.jointHolder?.ssn || '',
              street1: u.jointHolder?.address?.street1 || '',
              street2: u.jointHolder?.address?.street2 || '',
              city: u.jointHolder?.address?.city || '',
              state: u.jointHolder?.address?.state || '',
              zip: u.jointHolder?.address?.zip || '',
              country: u.jointHolder?.address?.country || 'United States'
            },
            authorizedRep: {
              firstName: u.authorizedRepresentative?.firstName || '',
              lastName: u.authorizedRepresentative?.lastName || '',
              dob: u.authorizedRepresentative?.dob || '',
              ssn: u.authorizedRepresentative?.ssn || '',
              street1: u.authorizedRepresentative?.address?.street1 || '',
              street2: u.authorizedRepresentative?.address?.street2 || '',
              city: u.authorizedRepresentative?.address?.city || '',
              state: u.authorizedRepresentative?.address?.state || '',
              zip: u.authorizedRepresentative?.address?.zip || '',
              country: u.authorizedRepresentative?.address?.country || 'United States'
            }
          })
        }
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
      <div className={styles.main}>
        <AdminHeader activeTab="accounts" />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.loadingState}>Loading user details...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.main}>
        <AdminHeader activeTab="accounts" />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.errorState}>User not found.</div>
          </div>
        </div>
      </div>
    )
  }

  

  const setField = (name, value) => {
    if (name.startsWith('jointHolder.')) {
      const field = name.replace('jointHolder.', '')
      setForm(prev => ({ ...prev, jointHolder: { ...prev.jointHolder, [field]: value } }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
      return
    }
    if (name.startsWith('authorizedRep.')) {
      const field = name.replace('authorizedRep.', '')
      setForm(prev => ({ ...prev, authorizedRep: { ...prev.authorizedRep, [field]: value } }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
      return
    }
    setForm(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'zip' || name === 'jointHolder.zip' || name === 'authorizedRep.zip') {
      setField(name, formatZip(value))
      return
    }
    if (name === 'phone' || name === 'jointHolder.phone') {
      setField(name, formatPhone(value))
      return
    }
    if (name === 'ssn' || name === 'jointHolder.ssn' || name === 'authorizedRep.ssn') {
      setField(name, formatSsn(value))
      return
    }
    setField(name, value)
  }

  const validate = () => {
    const v = {}
    if (!form.email.trim()) v.email = 'Required'
    if (!form.firstName.trim() && form.accountType !== 'entity') v.firstName = 'Required'
    if (!form.lastName.trim() && form.accountType !== 'entity') v.lastName = 'Required'
    if (!form.phone.trim() || !isCompletePhone(form.phone)) v.phone = 'Enter full 10-digit phone'
    if (!form.street1.trim()) v.street1 = 'Required'
    if (!form.city.trim()) v.city = 'Required'
    if (!form.state.trim()) v.state = 'Required'
    if (!form.zip.trim() || form.zip.length !== 5) v.zip = 'Enter 5 digits'
    if (!form.dob && form.accountType !== 'entity') v.dob = 'Required'
    if (form.accountType !== 'entity' && (!form.ssn.trim() || !isCompleteSsn(form.ssn))) v.ssn = 'Enter full SSN'

    if (form.accountType === 'entity') {
      if (!form.entityName.trim()) v.entityName = 'Required'
      if (!form.entityRegistrationDate) v.entityRegistrationDate = 'Required'
      if (!form.entityTaxId.trim()) v.entityTaxId = 'Required'
      if (!form.authorizedRep.firstName.trim()) v['authorizedRep.firstName'] = 'Required'
      if (!form.authorizedRep.lastName.trim()) v['authorizedRep.lastName'] = 'Required'
      if (!form.authorizedRep.street1.trim()) v['authorizedRep.street1'] = 'Required'
      if (!form.authorizedRep.city.trim()) v['authorizedRep.city'] = 'Required'
      if (!form.authorizedRep.state.trim()) v['authorizedRep.state'] = 'Required'
      if (!form.authorizedRep.zip.trim() || form.authorizedRep.zip.length !== 5) v['authorizedRep.zip'] = 'Enter 5 digits'
      if (!form.authorizedRep.dob) v['authorizedRep.dob'] = 'Required'
      if (!form.authorizedRep.ssn.trim() || !isCompleteSsn(form.authorizedRep.ssn)) v['authorizedRep.ssn'] = 'Enter full SSN'
    }

    if (form.accountType === 'joint') {
      if (!form.jointHoldingType.trim()) v.jointHoldingType = 'Required'
      if (!form.jointHolder.firstName.trim()) v['jointHolder.firstName'] = 'Required'
      if (!form.jointHolder.lastName.trim()) v['jointHolder.lastName'] = 'Required'
      if (!form.jointHolder.email.trim()) v['jointHolder.email'] = 'Required'
      if (!form.jointHolder.phone.trim() || !isCompletePhone(form.jointHolder.phone)) v['jointHolder.phone'] = 'Enter full 10-digit phone'
      if (!form.jointHolder.street1.trim()) v['jointHolder.street1'] = 'Required'
      if (!form.jointHolder.city.trim()) v['jointHolder.city'] = 'Required'
      if (!form.jointHolder.state.trim()) v['jointHolder.state'] = 'Required'
      if (!form.jointHolder.zip.trim() || form.jointHolder.zip.length !== 5) v['jointHolder.zip'] = 'Enter 5 digits'
      if (!form.jointHolder.dob) v['jointHolder.dob'] = 'Required'
      if (!form.jointHolder.ssn.trim() || !isCompleteSsn(form.jointHolder.ssn)) v['jointHolder.ssn'] = 'Enter full SSN'
    }

    setErrors(v)
    return Object.keys(v).length === 0
  }

  const handleVerifyAccount = async () => {
    if (!confirm('Manually verify this account? The user will be able to access their dashboard and make investments.')) {
      return
    }
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isVerified: true,
          verifiedAt: new Date().toISOString()
        })
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        alert('Account verified successfully!')
      } else {
        alert(data.error || 'Failed to verify account')
      }
    } catch (e) {
      console.error('Failed to verify account', e)
      alert('An error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    // Reset form to original user data
    const u = user
    setForm({
      accountType: u.accountType || 'individual',
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      phone: u.phone || u.phoneNumber || '',
      street1: u.address?.street1 || '',
      street2: u.address?.street2 || '',
      city: u.address?.city || '',
      state: u.address?.state || '',
      zip: u.address?.zip || '',
      country: u.address?.country || 'United States',
      dob: u.dob || '',
      ssn: u.ssn || '',
      entityName: u.entity?.name || u.entityName || '',
      entityTaxId: u.entity?.taxId || '',
      entityRegistrationDate: u.entity?.registrationDate || '',
      jointHoldingType: u.jointHoldingType || '',
      jointHolder: {
        firstName: u.jointHolder?.firstName || '',
        lastName: u.jointHolder?.lastName || '',
        email: u.jointHolder?.email || '',
        phone: u.jointHolder?.phone || '',
        dob: u.jointHolder?.dob || '',
        ssn: u.jointHolder?.ssn || '',
        street1: u.jointHolder?.address?.street1 || '',
        street2: u.jointHolder?.address?.street2 || '',
        city: u.jointHolder?.address?.city || '',
        state: u.jointHolder?.address?.state || '',
        zip: u.jointHolder?.address?.zip || '',
        country: u.jointHolder?.address?.country || 'United States'
      },
      authorizedRep: {
        firstName: u.authorizedRepresentative?.firstName || '',
        lastName: u.authorizedRepresentative?.lastName || '',
        dob: u.authorizedRepresentative?.dob || '',
        ssn: u.authorizedRepresentative?.ssn || '',
        street1: u.authorizedRepresentative?.address?.street1 || '',
        street2: u.authorizedRepresentative?.address?.street2 || '',
        city: u.authorizedRepresentative?.address?.city || '',
        state: u.authorizedRepresentative?.address?.state || '',
        zip: u.authorizedRepresentative?.address?.zip || '',
        country: u.authorizedRepresentative?.address?.country || 'United States'
      }
    })
    setErrors({})
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    try {
      const payload = {
        email: form.email.trim(),
        ...(form.accountType !== 'entity' ? { firstName: form.firstName.trim(), lastName: form.lastName.trim() } : {}),
        phone: form.phone.trim(),
        ...(form.accountType !== 'entity' ? {
          dob: form.dob,
          ssn: form.ssn,
        } : {}),
        address: {
          street1: form.street1,
          street2: form.street2,
          city: form.city,
          state: form.state,
          zip: form.zip,
          country: form.country
        },
        ...(form.accountType === 'entity' ? { entity: {
          name: form.entityName,
          registrationDate: form.entityRegistrationDate,
          taxId: form.entityTaxId,
          address: {
            street1: form.street1,
            street2: form.street2,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country
          }
        } } : {}),
        ...(form.accountType === 'entity' ? { authorizedRepresentative: {
          firstName: form.authorizedRep.firstName.trim(),
          lastName: form.authorizedRep.lastName.trim(),
          dob: form.authorizedRep.dob,
          ssn: form.authorizedRep.ssn,
          address: {
            street1: form.authorizedRep.street1,
            street2: form.authorizedRep.street2,
            city: form.authorizedRep.city,
            state: form.authorizedRep.state,
            zip: form.authorizedRep.zip,
            country: form.authorizedRep.country
          }
        } } : {}),
        ...(form.accountType === 'joint' ? { jointHoldingType: form.jointHoldingType } : {}),
        ...(form.accountType === 'joint' ? { jointHolder: {
          firstName: form.jointHolder.firstName.trim(),
          lastName: form.jointHolder.lastName.trim(),
          email: form.jointHolder.email.trim(),
          phone: form.jointHolder.phone.trim(),
          dob: form.jointHolder.dob,
          ssn: form.jointHolder.ssn,
          address: {
            street1: form.jointHolder.street1,
            street2: form.jointHolder.street2,
            city: form.jointHolder.city,
            state: form.jointHolder.state,
            zip: form.jointHolder.zip,
            country: form.jointHolder.country
          }
        } } : {})
      }

      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to save user changes')
        return
      }
      setUser(data.user)
      setIsEditing(false)
      alert('User updated successfully')
    } catch (e) {
      console.error('Failed to save user', e)
      alert('An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  // Calculate investment metrics using app time if available
  const activeInvestments = (user.investments || []).filter(inv => inv.status === 'active' || inv.status === 'withdrawal_notice')
  const pendingTotal = (user.investments || []).filter(inv => inv.status === 'pending' || inv.status === 'draft').reduce((sum, inv) => sum + (inv.amount || 0), 0)
  
  // Calculate pending payouts (monthly distributions awaiting admin approval)
  const pendingPayouts = (user.investments || [])
    .flatMap(inv => Array.isArray(inv.transactions) ? inv.transactions : [])
    .filter(tx => tx.type === 'distribution' && tx.status === 'pending')
    .reduce((sum, tx) => sum + (tx.amount || 0), 0)
  
  // Calculate original investment value (sum of all active investment principals)
  const originalInvestmentValue = activeInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
  
  // Calculate current account value (sum of all active investments with compounding)
  // Use app time from Time Machine if available
  const currentAccountValue = activeInvestments.reduce((sum, inv) => {
    const calculation = calculateInvestmentValue(inv, appTime)
    return sum + calculation.currentValue
  }, 0)
  
  const totalEarnings = currentAccountValue - originalInvestmentValue

  return (
    <div className={styles.main}>
      <AdminHeader activeTab="accounts" />
      <div className={styles.container}>
        <div className={styles.content}>
          {/* Breadcrumb Navigation */}
          <div className={styles.breadcrumb}>
            <button className={styles.breadcrumbLink} onClick={() => router.push('/admin?tab=accounts')}>
              ← Accounts
            </button>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Account #{user.id}</span>
          </div>

          {/* Page Header */}
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.title}>Account Details</h1>
              <p className={styles.subtitle}>
                {user.firstName} {user.lastName} • {user.email}
              </p>
            </div>
          </div>

          {/* Primary Value Metrics - Featured at Top */}
          <div className={styles.primaryMetricsGrid}>
            <div className={styles.primaryMetricCard}>
              <div className={styles.primaryMetricLabel}>Original Investment Value</div>
              <div className={styles.primaryMetricValue}>${originalInvestmentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={styles.primaryMetricSubtext}>Total principal invested</div>
            </div>
            <div className={styles.primaryMetricCard}>
              <div className={styles.primaryMetricLabel}>Current Account Value</div>
              <div className={styles.primaryMetricValue}>${currentAccountValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className={styles.primaryMetricSubtext}>
                {totalEarnings >= 0 ? '+' : ''} ${totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total earnings
              </div>
            </div>
          </div>

          {/* Secondary Metrics Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Investments</div>
              <div className={styles.metricValue}>{(user.investments || []).length}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Active Investments</div>
              <div className={styles.metricValue}>{activeInvestments.length}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Pending Investments</div>
              <div className={styles.metricValue}>${pendingTotal.toLocaleString()}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Pending Payouts</div>
              <div className={styles.metricValue}>${pendingPayouts.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          {/* Investments Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Investments</h2>
            </div>
            {(user.investments && user.investments.length > 0) ? (
              <div className={styles.list}>
                {user.investments.map(inv => (
                  <div key={inv.id} style={{
                    padding: '16px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    background: 'white'
                  }}>
                    {/* Investment Header - Compact */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827'
                        }}>
                          Investment #{inv.id}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em',
                          background: inv.status === 'active' ? '#dcfce7' :
                                    inv.status === 'pending' ? '#fef3c7' :
                                    inv.status === 'withdrawal_notice' ? '#e0f2fe' :
                                    inv.status === 'withdrawn' ? '#f1f5f9' :
                                    '#fee2e2',
                          color: inv.status === 'active' ? '#166534' :
                                inv.status === 'pending' ? '#92400e' :
                                inv.status === 'withdrawal_notice' ? '#2563eb' :
                                inv.status === 'withdrawn' ? '#1f2937' :
                                '#991b1b'
                        }}>
                          {inv.status}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                          ${inv.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </div>
                      </div>
                    </div>

                    {/* Compact Details Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '12px',
                      marginBottom: '12px'
                    }}>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Type:</span>
                        <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                          {inv.accountType || '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Lockup:</span>
                        <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                          {inv.lockupPeriod || '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Frequency:</span>
                        <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                          {inv.paymentFrequency || '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Bonds:</span>
                        <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                          {inv.bonds?.toLocaleString() || '-'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px' }}>
                        <span style={{ color: '#6b7280', fontWeight: '500' }}>Created:</span>
                        <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString('en-US', {
                            timeZone: 'America/New_York',
                            month: 'short',
                            day: 'numeric'
                          }) : '-'}
                        </span>
                      </div>
                      {inv.confirmedAt && (
                        <div style={{ fontSize: '13px' }}>
                          <span style={{ color: '#6b7280', fontWeight: '500' }}>Confirmed:</span>
                          <span style={{ color: '#111827', marginLeft: '4px', fontWeight: '500' }}>
                            {new Date(inv.confirmedAt).toLocaleDateString('en-US', {
                              timeZone: 'America/New_York',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Specialized Info - Inline */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      marginBottom: '12px'
                    }}>
                      {inv.compliance && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: '#f0f9ff',
                          border: '1px solid #e0f2fe',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#0369a1',
                          fontWeight: '500'
                        }}>
                          ✓ {inv.compliance.accredited || 'Accredited'}
                        </span>
                      )}

                      {inv.banking && inv.banking.fundingMethod && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: '#f0fdf4',
                          border: '1px solid #dcfce7',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#166534',
                          fontWeight: '500'
                        }}>
                          🏦 {inv.banking.fundingMethod}
                        </span>
                      )}

                      {inv.entity && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: '#fefce8',
                          border: '1px solid #fef3c7',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#92400e',
                          fontWeight: '500'
                        }}>
                          🏢 {inv.entity.name || 'Entity'}
                        </span>
                      )}

                      {inv.jointHoldingType && (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 6px',
                          background: '#fdf4ff',
                          border: '1px solid #f3e8ff',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#6b21a8',
                          fontWeight: '500'
                        }}>
                          👥 {inv.jointHoldingType}
                        </span>
                      )}
                    </div>

                    {/* Actions - Compact */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      paddingTop: '12px',
                      borderTop: '1px solid #f3f4f6'
                    }}>
                      <button
                        className={styles.secondaryButton}
                        onClick={() => router.push(`/admin/investments/${inv.id}`)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}
                      >
                        Details →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.muted}>No investments</div>
            )}
          </div>

          {/* Activity Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Activity</h2>
              {(() => {
                const totalActivity = user?.activity?.length || 0
                const totalTransactions = user?.investments?.reduce((sum, inv) => sum + (inv.transactions?.filter(tx => tx.type !== 'investment')?.length || 0), 0) || 0
                const total = totalActivity + totalTransactions
                const totalPages = Math.ceil(total / ACTIVITY_ITEMS_PER_PAGE)
                return totalPages > 1 ? (
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Page {activityPage} of {totalPages}
                  </div>
                ) : null
              })()}
            </div>
            {(() => {
              // Collect all activity events
              const allActivity = []
              
              // Add user activity events (account creation, withdrawals, investment status changes, etc.)
              if (user.activity && Array.isArray(user.activity)) {
                user.activity.forEach(event => {
                  allActivity.push({
                    ...event,
                    category: 'account'
                  })
                })
              }
              
              // Add investment transaction events (distributions, contributions)
              // NOTE: We filter out 'investment' type - that's just the initial principal ledger entry, not an activity event
              if (user.investments && user.investments.length > 0) {
                user.investments.forEach(inv => {
                  if (inv.transactions && Array.isArray(inv.transactions)) {
                    inv.transactions.forEach(tx => {
                      // Skip 'investment' type transactions (initial principal ledger entries)
                      // Activity panel should show: distributions, contributions, redemptions
                      // The investment creation/confirmation is tracked in user.activity
                      if (tx.type === 'investment') return
                      
                      allActivity.push({
                        ...tx,
                        investmentId: inv.id,
                        lockupPeriod: inv.lockupPeriod,
                        paymentFrequency: inv.paymentFrequency,
                        category: 'transaction'
                      })
                    })
                  }
                })
              }

              // Sort by date (newest first), then by type for same dates
              allActivity.sort((a, b) => {
                const dateA = a.date ? new Date(a.date).getTime() : 0
                const dateB = b.date ? new Date(b.date).getTime() : 0
                
                // First sort by date (newest first)
                if (dateA !== dateB) {
                  return dateB - dateA
                }
                
                // If dates are the same, ensure distribution comes before contribution
                // This handles compounding investments where both transactions have the same date
                if (a.type === 'distribution' && b.type === 'contribution') {
                  return -1 // a (distribution) comes first
                }
                if (a.type === 'contribution' && b.type === 'distribution') {
                  return 1 // b (distribution) comes first
                }
                
                return 0 // Same type, maintain order
              })

              // Helper function to get event metadata (icon, title, color)
              const getEventMeta = (eventType) => {
                switch (eventType) {
                  case 'account_created':
                    return { icon: '👤', title: 'Account Created', color: '#0369a1', showAmount: false }
                  case 'investment_created':
                    return { icon: '🧾', title: 'Investment Created', color: '#0369a1', showAmount: false }
                  case 'investment_approved':
                    return { icon: '✓', title: 'Investment Approved', color: '#0891b2', showAmount: false }
                  case 'investment_confirmed':
                    return { icon: '✅', title: 'Investment Confirmed', color: '#065f46', showAmount: true }
                  case 'investment_rejected':
                    return { icon: '❌', title: 'Investment Rejected', color: '#991b1b', showAmount: false }
                  case 'investment':
                    return { icon: '🧾', title: 'Investment', color: '#0369a1', showAmount: true }
                  case 'distribution':
                    return { icon: '💸', title: 'Distribution', color: '#7c3aed', showAmount: true }
                  case 'monthly_distribution':
                    return { icon: '💸', title: 'Monthly Payout', color: '#7c3aed', showAmount: true }
                  case 'contribution':
                    return { icon: '📈', title: 'Contribution', color: '#0369a1', showAmount: true }
                  case 'monthly_compounded':
                    return { icon: '📈', title: 'Monthly Compounded', color: '#0369a1', showAmount: true }
                  case 'withdrawal_requested':
                    return { icon: '🏦', title: 'Withdrawal Requested', color: '#ca8a04', showAmount: true }
                  case 'withdrawal_notice_started':
                    return { icon: '⏳', title: 'Withdrawal Notice Started', color: '#ca8a04', showAmount: false }
                  case 'withdrawal_approved':
                    return { icon: '✅', title: 'Withdrawal Processed', color: '#065f46', showAmount: true }
                  case 'withdrawal_rejected':
                    return { icon: '❌', title: 'Withdrawal Rejected', color: '#991b1b', showAmount: false }
                  case 'redemption':
                    return { icon: '🏦', title: 'Redemption', color: '#ca8a04', showAmount: true }
                  default:
                    return { icon: '•', title: eventType || 'Unknown Event', color: '#6b7280', showAmount: true }
                }
              }

              // Calculate summary stats
              const distributions = allActivity.filter(e => e.type === 'distribution' || e.type === 'monthly_distribution')
              const contributions = allActivity.filter(e => e.type === 'contribution' || e.type === 'monthly_compounded')
              const accountEvents = allActivity.filter(e => e.category === 'account')
              const totalDistributionAmount = distributions.reduce((sum, e) => sum + (e.amount || 0), 0)
              const totalContributionAmount = contributions.reduce((sum, e) => sum + (e.amount || 0), 0)
              const pendingCount = allActivity.filter(e => e.status === 'pending').length

              // Pagination
              const totalActivityPages = Math.ceil(allActivity.length / ACTIVITY_ITEMS_PER_PAGE)
              const startIndex = (activityPage - 1) * ACTIVITY_ITEMS_PER_PAGE
              const endIndex = startIndex + ACTIVITY_ITEMS_PER_PAGE
              const paginatedActivity = allActivity.slice(startIndex, endIndex)

              return allActivity.length > 0 ? (
                <>
                  {/* Activity Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>Total Activity</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1f2937' }}>
                        {allActivity.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{accountEvents.length} account events</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>💸 Distributions</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7c3aed' }}>
                        ${totalDistributionAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{distributions.length} distributions</div>
                    </div>
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>📈 Contributions</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0369a1' }}>
                        ${totalContributionAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{contributions.length} contributions</div>
                    </div>
                    {pendingCount > 0 && (
                      <div style={{ padding: '16px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
                        <div style={{ fontSize: '14px', color: '#92400e', marginBottom: '4px' }}>⏳ Pending Approval</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#92400e' }}>{pendingCount}</div>
                        <div style={{ fontSize: '12px', color: '#92400e' }}>events</div>
                      </div>
                    )}
                  </div>

                  {/* Activity List */}
                  <div className={styles.list}>
                    {paginatedActivity.map(event => {
                      const meta = getEventMeta(event.type)
                      return (
                        <div key={event.id} style={{
                          padding: '16px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          background: 'white'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontSize: '18px',
                                color: meta.color
                              }}>
                                {meta.icon}
                              </span>
                              <span style={{ fontWeight: 'bold' }}>
                                {meta.title}
                              </span>
                              {event.status && (
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  background: event.status === 'completed' ? '#dcfce7' :
                                            event.status === 'pending' ? '#fef3c7' :
                                            event.status === 'active' ? '#dbeafe' :
                                            '#fee2e2',
                                  color: event.status === 'completed' ? '#166534' :
                                        event.status === 'pending' ? '#92400e' :
                                        event.status === 'active' ? '#1e40af' :
                                        '#991b1b'
                                }}>
                                  {event.status}
                                </span>
                              )}
                            </div>
                            {meta.showAmount && event.amount != null && (
                              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937' }}>
                                ${(event.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            )}
                          </div>

                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px',
                            fontSize: '14px',
                            color: '#64748b'
                          }}>
                            {event.investmentId && (
                              <div><b>Investment ID:</b> {event.investmentId}</div>
                            )}
                            <div><b>Date:</b> {event.date ? new Date(event.date).toLocaleDateString('en-US', {
                              timeZone: 'America/New_York',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            }) : '-'}</div>
                            {event.monthIndex != null && (
                              <div><b>Month Index:</b> Month {event.monthIndex}</div>
                            )}
                            {event.lockupPeriod && (
                              <div><b>Lockup Period:</b> {event.lockupPeriod}</div>
                            )}
                            {event.paymentFrequency && (
                              <div><b>Payment Frequency:</b> {event.paymentFrequency}</div>
                            )}
                            <div>
                              <b>Event ID:</b>{' '}
                              {(event.type === 'investment' || event.type === 'distribution' || event.type === 'contribution') && event.id ? (
                                <button
                                  onClick={() => router.push(`/admin/transactions/${event.id}`)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#0369a1',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    padding: 0,
                                    font: 'inherit'
                                  }}
                                  title="View transaction details"
                                >
                                  {event.id}
                                </button>
                              ) : (
                                <span>{event.id}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {totalActivityPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '16px',
                      padding: '24px 16px',
                      marginTop: '20px',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px'
                    }}>
                      <button
                        onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                        disabled={activityPage === 1}
                        style={{
                          padding: '8px 16px',
                          background: activityPage === 1 ? '#f3f4f6' : '#0369a1',
                          color: activityPage === 1 ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: activityPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          minWidth: '100px',
                          opacity: activityPage === 1 ? 0.5 : 1
                        }}
                      >
                        ← Previous
                      </button>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827',
                        minWidth: '150px',
                        textAlign: 'center'
                      }}>
                        Page {activityPage} of {totalActivityPages}
                        <span style={{
                          fontSize: '12px',
                          color: '#6b7280',
                          fontWeight: 400
                        }}>
                          (Showing {startIndex + 1}-{Math.min(endIndex, allActivity.length)} of {allActivity.length})
                        </span>
                      </div>
                      <button
                        onClick={() => setActivityPage(prev => Math.min(totalActivityPages, prev + 1))}
                        disabled={activityPage === totalActivityPages}
                        style={{
                          padding: '8px 16px',
                          background: activityPage === totalActivityPages ? '#f3f4f6' : '#0369a1',
                          color: activityPage === totalActivityPages ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '14px',
                          fontWeight: 500,
                          cursor: activityPage === totalActivityPages ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          minWidth: '100px',
                          opacity: activityPage === totalActivityPages ? 0.5 : 1
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.muted}>No activity yet</div>
              )
            })()}
          </div>

          {/* Account Profile Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className={styles.sectionTitle}>Account Profile</h2>
                {!isEditing && (
                  <button className={styles.editButton} onClick={handleEdit}>
                    Edit Profile
                  </button>
                )}
              </div>
            </div>
            <div className={styles.grid}>
              <div><b>Account Type:</b> {form.accountType || '-'}</div>
              <div>
                <b>Verified:</b> {user.isVerified ? 'Yes' : 'No'}
                {!user.isVerified && (
                  <button 
                    onClick={handleVerifyAccount} 
                    disabled={isVerifying}
                    className={styles.verifyButton}
                    style={{ marginLeft: '12px' }}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Account'}
                  </button>
                )}
              </div>
              <div>
                <label><b>Email</b></label>
                <input name="email" value={form.email} onChange={handleChange} disabled={!isEditing} />
                {errors.email && <div className={styles.muted}>{errors.email}</div>}
              </div>
              {form.accountType !== 'entity' && (
                <>
                  <div>
                    <label><b>First Name</b></label>
                    <input name="firstName" value={form.firstName} onChange={handleChange} disabled={!isEditing} />
                    {errors.firstName && <div className={styles.muted}>{errors.firstName}</div>}
                  </div>
                  <div>
                    <label><b>Last Name</b></label>
                    <input name="lastName" value={form.lastName} onChange={handleChange} disabled={!isEditing} />
                    {errors.lastName && <div className={styles.muted}>{errors.lastName}</div>}
                  </div>
                </>
              )}
              <div>
                <label><b>Phone</b></label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 555-5555" disabled={!isEditing} />
                {errors.phone && <div className={styles.muted}>{errors.phone}</div>}
              </div>
              {form.accountType !== 'entity' && (
                <>
                  <div>
                    <label><b>Date of Birth</b></label>
                    <input type="date" name="dob" value={form.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} disabled={!isEditing} />
                    {errors.dob && <div className={styles.muted}>{errors.dob}</div>}
                  </div>
                  <div>
                    <label><b>SSN</b></label>
                    <input name="ssn" value={form.ssn} onChange={handleChange} placeholder="123-45-6789" disabled={!isEditing} />
                    {errors.ssn && <div className={styles.muted}>{errors.ssn}</div>}
                  </div>
                </>
              )}
              <div>
                <label><b>Street Address</b></label>
                <input name="street1" value={form.street1} onChange={handleChange} disabled={!isEditing} />
                {errors.street1 && <div className={styles.muted}>{errors.street1}</div>}
              </div>
              <div>
                <label><b>Apt or Unit</b></label>
                <input name="street2" value={form.street2} onChange={handleChange} disabled={!isEditing} />
              </div>
              <div>
                <label><b>City</b></label>
                <input name="city" value={form.city} onChange={handleChange} disabled={!isEditing} />
                {errors.city && <div className={styles.muted}>{errors.city}</div>}
              </div>
              <div>
                <label><b>Zip</b></label>
                <input name="zip" value={form.zip} onChange={handleChange} disabled={!isEditing} />
                {errors.zip && <div className={styles.muted}>{errors.zip}</div>}
              </div>
              <div>
                <label><b>State</b></label>
                <select name="state" value={form.state} onChange={handleChange} disabled={!isEditing}>
                  <option value="">Select state</option>
                  {US_STATES.map(s => (<option key={s} value={s}>{s}</option>))}
                </select>
                {errors.state && <div className={styles.muted}>{errors.state}</div>}
              </div>
              <div>
                <label><b>Country</b></label>
                <input name="country" value={form.country} readOnly disabled />
              </div>
            </div>

            {/* Entity Information Subsection */}
            {form.accountType === 'entity' && (
              <>
                <div className={styles.sectionHeader} style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                  <h3 className={styles.sectionTitle} style={{ fontSize: '18px', color: '#6b7280' }}>Entity Information</h3>
                </div>
                <div className={styles.grid}>
                <div>
                  <label><b>Entity Name</b></label>
                  <input name="entityName" value={form.entityName} onChange={handleChange} disabled={!isEditing} />
                  {errors.entityName && <div className={styles.muted}>{errors.entityName}</div>}
                </div>
                <div>
                  <label><b>Entity Tax ID (EIN)</b></label>
                  <input name="entityTaxId" value={form.entityTaxId} onChange={handleChange} placeholder="12-3456789" disabled={!isEditing} />
                  {errors.entityTaxId && <div className={styles.muted}>{errors.entityTaxId}</div>}
                </div>
                <div>
                  <label><b>Entity Registration Date</b></label>
                  <input type="date" name="entityRegistrationDate" value={form.entityRegistrationDate} onChange={handleChange} min={MIN_DOB} max={maxToday} disabled={!isEditing} />
                  {errors.entityRegistrationDate && <div className={styles.muted}>{errors.entityRegistrationDate}</div>}
                </div>
              </div>

              {/* Authorized Representative Subsection */}
              <div className={styles.sectionHeader} style={{ marginTop: '32px', borderTop: '1px solid #e5e7eb', paddingTop: '24px' }}>
                <h3 className={styles.sectionTitle} style={{ fontSize: '18px', color: '#6b7280' }}>Authorized Representative</h3>
              </div>
              <div className={styles.grid}>
                <div>
                  <label><b>First Name</b></label>
                  <input name="authorizedRep.firstName" value={form.authorizedRep.firstName} onChange={handleChange} disabled={!isEditing} />
                  {errors['authorizedRep.firstName'] && <div className={styles.muted}>{errors['authorizedRep.firstName']}</div>}
                </div>
                <div>
                  <label><b>Last Name</b></label>
                  <input name="authorizedRep.lastName" value={form.authorizedRep.lastName} onChange={handleChange} disabled={!isEditing} />
                  {errors['authorizedRep.lastName'] && <div className={styles.muted}>{errors['authorizedRep.lastName']}</div>}
                </div>
                <div>
                  <label><b>Date of Birth</b></label>
                  <input type="date" name="authorizedRep.dob" value={form.authorizedRep.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} disabled={!isEditing} />
                  {errors['authorizedRep.dob'] && <div className={styles.muted}>{errors['authorizedRep.dob']}</div>}
                </div>
                <div>
                  <label><b>SSN</b></label>
                  <input name="authorizedRep.ssn" value={form.authorizedRep.ssn} onChange={handleChange} placeholder="123-45-6789" disabled={!isEditing} />
                  {errors['authorizedRep.ssn'] && <div className={styles.muted}>{errors['authorizedRep.ssn']}</div>}
                </div>
                <div>
                  <label><b>Street Address</b></label>
                  <input name="authorizedRep.street1" value={form.authorizedRep.street1} onChange={handleChange} disabled={!isEditing} />
                  {errors['authorizedRep.street1'] && <div className={styles.muted}>{errors['authorizedRep.street1']}</div>}
                </div>
                <div>
                  <label><b>Apt or Unit</b></label>
                  <input name="authorizedRep.street2" value={form.authorizedRep.street2} onChange={handleChange} disabled={!isEditing} />
                </div>
                <div>
                  <label><b>City</b></label>
                  <input name="authorizedRep.city" value={form.authorizedRep.city} onChange={handleChange} disabled={!isEditing} />
                  {errors['authorizedRep.city'] && <div className={styles.muted}>{errors['authorizedRep.city']}</div>}
                </div>
                <div>
                  <label><b>Zip</b></label>
                  <input name="authorizedRep.zip" value={form.authorizedRep.zip} onChange={handleChange} disabled={!isEditing} />
                  {errors['authorizedRep.zip'] && <div className={styles.muted}>{errors['authorizedRep.zip']}</div>}
                </div>
                <div>
                  <label><b>State</b></label>
                  <select name="authorizedRep.state" value={form.authorizedRep.state} onChange={handleChange} disabled={!isEditing}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => (<option key={s} value={s}>{s}</option>))}
                  </select>
                  {errors['authorizedRep.state'] && <div className={styles.muted}>{errors['authorizedRep.state']}</div>}
                </div>
                <div>
                  <label><b>Country</b></label>
                  <input name="authorizedRep.country" value={form.authorizedRep.country} readOnly disabled />
                </div>
              </div>
              </>
            )}

            {/* Save/Cancel buttons for Account Profile */}
            {isEditing && (
              <div className={styles.sectionActions}>
                <button className={styles.saveButton} onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
                <button className={styles.cancelButton} onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Joint Holder Section */}
          {form.accountType === 'joint' && (
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Joint Holder Information</h2>
              </div>
              <div className={styles.grid}>
                <div>
                  <label><b>Joint Holding Type</b></label>
                  <select name="jointHoldingType" value={form.jointHoldingType} onChange={handleChange} disabled={!isEditing}>
                    <option value="">Select joint holding type</option>
                    <option value="spouse">Spouse</option>
                    <option value="sibling">Sibling</option>
                    <option value="domestic_partner">Domestic Partner</option>
                    <option value="business_partner">Business Partner</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.jointHoldingType && <div className={styles.muted}>{errors.jointHoldingType}</div>}
                </div>
                <div />
                <div>
                  <label><b>First Name</b></label>
                  <input name="jointHolder.firstName" value={form.jointHolder.firstName} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.firstName'] && <div className={styles.muted}>{errors['jointHolder.firstName']}</div>}
                </div>
                <div>
                  <label><b>Last Name</b></label>
                  <input name="jointHolder.lastName" value={form.jointHolder.lastName} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.lastName'] && <div className={styles.muted}>{errors['jointHolder.lastName']}</div>}
                </div>
                <div>
                  <label><b>Email</b></label>
                  <input name="jointHolder.email" value={form.jointHolder.email} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.email'] && <div className={styles.muted}>{errors['jointHolder.email']}</div>}
                </div>
                <div>
                  <label><b>Phone</b></label>
                  <input name="jointHolder.phone" value={form.jointHolder.phone} onChange={handleChange} placeholder="(555) 555-5555" disabled={!isEditing} />
                  {errors['jointHolder.phone'] && <div className={styles.muted}>{errors['jointHolder.phone']}</div>}
                </div>
                <div>
                  <label><b>Date of Birth</b></label>
                  <input type="date" name="jointHolder.dob" value={form.jointHolder.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} disabled={!isEditing} />
                  {errors['jointHolder.dob'] && <div className={styles.muted}>{errors['jointHolder.dob']}</div>}
                </div>
                <div>
                  <label><b>SSN</b></label>
                  <input name="jointHolder.ssn" value={form.jointHolder.ssn} onChange={handleChange} placeholder="123-45-6789" disabled={!isEditing} />
                  {errors['jointHolder.ssn'] && <div className={styles.muted}>{errors['jointHolder.ssn']}</div>}
                </div>
                <div>
                  <label><b>Street Address</b></label>
                  <input name="jointHolder.street1" value={form.jointHolder.street1} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.street1'] && <div className={styles.muted}>{errors['jointHolder.street1']}</div>}
                </div>
                <div>
                  <label><b>Apt or Unit</b></label>
                  <input name="jointHolder.street2" value={form.jointHolder.street2} onChange={handleChange} disabled={!isEditing} />
                </div>
                <div>
                  <label><b>City</b></label>
                  <input name="jointHolder.city" value={form.jointHolder.city} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.city'] && <div className={styles.muted}>{errors['jointHolder.city']}</div>}
                </div>
                <div>
                  <label><b>Zip</b></label>
                  <input name="jointHolder.zip" value={form.jointHolder.zip} onChange={handleChange} disabled={!isEditing} />
                  {errors['jointHolder.zip'] && <div className={styles.muted}>{errors['jointHolder.zip']}</div>}
                </div>
                <div>
                  <label><b>State</b></label>
                  <select name="jointHolder.state" value={form.jointHolder.state} onChange={handleChange} disabled={!isEditing}>
                    <option value="">Select state</option>
                    {US_STATES.map(s => (<option key={s} value={s}>{s}</option>))}
                  </select>
                  {errors['jointHolder.state'] && <div className={styles.muted}>{errors['jointHolder.state']}</div>}
                </div>
                <div>
                  <label><b>Country</b></label>
                  <input name="jointHolder.country" value={form.jointHolder.country} readOnly disabled />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

