'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminHeader from '../../../components/AdminHeader'
import styles from './page.module.css'

export default function AdminUserDetailsPage({ params }) {
  const router = useRouter()
  const { id } = params
  const [currentUser, setCurrentUser] = useState(null)
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const MIN_DOB = '1900-01-01'

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
  const [expandedInvestments, setExpandedInvestments] = useState({})
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
      alert('User updated successfully')
    } catch (e) {
      console.error('Failed to save user', e)
      alert('An error occurred while saving')
    } finally {
      setIsSaving(false)
    }
  }

  const investedTotal = (user.investments || []).filter(inv => inv.status === 'active').reduce((sum, inv) => sum + (inv.amount || 0), 0)
  const pendingTotal = (user.investments || []).filter(inv => inv.status === 'pending' || inv.status === 'draft').reduce((sum, inv) => sum + (inv.amount || 0), 0)

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

          {/* Metrics Cards */}
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Total Investments</div>
              <div className={styles.metricValue}>{(user.investments || []).length}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Pending Amount</div>
              <div className={styles.metricValue}>${pendingTotal.toLocaleString()}</div>
            </div>
            <div className={styles.metricCard}>
              <div className={styles.metricLabel}>Approved Amount</div>
              <div className={styles.metricValue}>${investedTotal.toLocaleString()}</div>
            </div>
          </div>

          {/* Account Profile Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Account Profile</h2>
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
                <input name="email" value={form.email} onChange={handleChange} />
                {errors.email && <div className={styles.muted}>{errors.email}</div>}
              </div>
              {form.accountType !== 'entity' && (
                <>
                  <div>
                    <label><b>First Name</b></label>
                    <input name="firstName" value={form.firstName} onChange={handleChange} />
                    {errors.firstName && <div className={styles.muted}>{errors.firstName}</div>}
                  </div>
                  <div>
                    <label><b>Last Name</b></label>
                    <input name="lastName" value={form.lastName} onChange={handleChange} />
                    {errors.lastName && <div className={styles.muted}>{errors.lastName}</div>}
                  </div>
                </>
              )}
              <div>
                <label><b>Phone</b></label>
                <input name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 555-5555" />
                {errors.phone && <div className={styles.muted}>{errors.phone}</div>}
              </div>
              {form.accountType !== 'entity' && (
                <>
                  <div>
                    <label><b>Date of Birth</b></label>
                    <input type="date" name="dob" value={form.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} />
                    {errors.dob && <div className={styles.muted}>{errors.dob}</div>}
                  </div>
                  <div>
                    <label><b>SSN</b></label>
                    <input name="ssn" value={form.ssn} onChange={handleChange} placeholder="123-45-6789" />
                    {errors.ssn && <div className={styles.muted}>{errors.ssn}</div>}
                  </div>
                </>
              )}
              <div>
                <label><b>Street Address</b></label>
                <input name="street1" value={form.street1} onChange={handleChange} />
                {errors.street1 && <div className={styles.muted}>{errors.street1}</div>}
              </div>
              <div>
                <label><b>Apt or Unit</b></label>
                <input name="street2" value={form.street2} onChange={handleChange} />
              </div>
              <div>
                <label><b>City</b></label>
                <input name="city" value={form.city} onChange={handleChange} />
                {errors.city && <div className={styles.muted}>{errors.city}</div>}
              </div>
              <div>
                <label><b>Zip</b></label>
                <input name="zip" value={form.zip} onChange={handleChange} />
                {errors.zip && <div className={styles.muted}>{errors.zip}</div>}
              </div>
              <div>
                <label><b>State</b></label>
                <select name="state" value={form.state} onChange={handleChange}>
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
            <div className={styles.sectionActions}>
              <button className={styles.saveButton} onClick={() => handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
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
                  <select name="jointHoldingType" value={form.jointHoldingType} onChange={handleChange}>
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
                  <input name="jointHolder.firstName" value={form.jointHolder.firstName} onChange={handleChange} />
                  {errors['jointHolder.firstName'] && <div className={styles.muted}>{errors['jointHolder.firstName']}</div>}
                </div>
                <div>
                  <label><b>Last Name</b></label>
                  <input name="jointHolder.lastName" value={form.jointHolder.lastName} onChange={handleChange} />
                  {errors['jointHolder.lastName'] && <div className={styles.muted}>{errors['jointHolder.lastName']}</div>}
                </div>
                <div>
                  <label><b>Email</b></label>
                  <input name="jointHolder.email" value={form.jointHolder.email} onChange={handleChange} />
                  {errors['jointHolder.email'] && <div className={styles.muted}>{errors['jointHolder.email']}</div>}
                </div>
                <div>
                  <label><b>Phone</b></label>
                  <input name="jointHolder.phone" value={form.jointHolder.phone} onChange={handleChange} placeholder="(555) 555-5555" />
                  {errors['jointHolder.phone'] && <div className={styles.muted}>{errors['jointHolder.phone']}</div>}
                </div>
                <div>
                  <label><b>Date of Birth</b></label>
                  <input type="date" name="jointHolder.dob" value={form.jointHolder.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} />
                  {errors['jointHolder.dob'] && <div className={styles.muted}>{errors['jointHolder.dob']}</div>}
                </div>
                <div>
                  <label><b>SSN</b></label>
                  <input name="jointHolder.ssn" value={form.jointHolder.ssn} onChange={handleChange} placeholder="123-45-6789" />
                  {errors['jointHolder.ssn'] && <div className={styles.muted}>{errors['jointHolder.ssn']}</div>}
                </div>
                <div>
                  <label><b>Street Address</b></label>
                  <input name="jointHolder.street1" value={form.jointHolder.street1} onChange={handleChange} />
                  {errors['jointHolder.street1'] && <div className={styles.muted}>{errors['jointHolder.street1']}</div>}
                </div>
                <div>
                  <label><b>Apt or Unit</b></label>
                  <input name="jointHolder.street2" value={form.jointHolder.street2} onChange={handleChange} />
                </div>
                <div>
                  <label><b>City</b></label>
                  <input name="jointHolder.city" value={form.jointHolder.city} onChange={handleChange} />
                  {errors['jointHolder.city'] && <div className={styles.muted}>{errors['jointHolder.city']}</div>}
                </div>
                <div>
                  <label><b>Zip</b></label>
                  <input name="jointHolder.zip" value={form.jointHolder.zip} onChange={handleChange} />
                  {errors['jointHolder.zip'] && <div className={styles.muted}>{errors['jointHolder.zip']}</div>}
                </div>
                <div>
                  <label><b>State</b></label>
                  <select name="jointHolder.state" value={form.jointHolder.state} onChange={handleChange}>
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
              <div className={styles.sectionActions}>
                <button className={styles.saveButton} onClick={() => handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* Investments Section */}
          <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Investments</h2>
            </div>
            {(user.investments && user.investments.length > 0) ? (
              <div className={styles.list}>
                {user.investments.map(inv => {
                  const isExpanded = expandedInvestments[inv.id]
                  return (
                    <div key={inv.id} className={styles.invCard}>
                      <div 
                        className={styles.invHeader} 
                        onClick={() => setExpandedInvestments(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className={styles.invHeaderContent}>
                          <div><b>ID:</b> {inv.id}</div>
                          <div><b>Amount:</b> ${inv.amount?.toLocaleString() || 0}</div>
                          <div><b>Status:</b> {inv.status}</div>
                          <div><b>Created:</b> {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-'}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <button 
                            className={styles.secondaryButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/admin/investments/${inv.id}`);
                            }}
                            style={{ fontSize: '13px', padding: '6px 10px' }}
                            title="View full investment details"
                          >
                            View Details
                          </button>
                          <div className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className={styles.invDetails}>
                          <div className={styles.detailsGrid}>
                            <div><b>Account Type:</b> {inv.accountType || '-'}</div>
                            <div><b>Lockup Period:</b> {inv.lockupPeriod || '-'}</div>
                            <div><b>Payment Frequency:</b> {inv.paymentFrequency || '-'}</div>
                            <div><b>Bonds:</b> {inv.bonds?.toLocaleString() || '-'}</div>
                            <div><b>Updated:</b> {inv.updatedAt ? new Date(inv.updatedAt).toLocaleDateString() : '-'}</div>
                            <div><b>Confirmed At:</b> {inv.confirmedAt ? new Date(inv.confirmedAt).toLocaleDateString() : '-'}</div>
                            {inv.lockupEndDate && <div><b>Lockup Ends:</b> {new Date(inv.lockupEndDate).toLocaleDateString()}</div>}
                            {inv.compliance && (
                              <>
                                <div><b>Accredited:</b> {inv.compliance.accredited || '-'}</div>
                                {inv.compliance.accreditedType && <div><b>Accredited Type:</b> {inv.compliance.accreditedType}</div>}
                                {inv.compliance.tenPercentLimitConfirmed && <div><b>10% Limit:</b> Confirmed</div>}
                              </>
                            )}
                            {inv.banking && (
                              <>
                                {inv.banking.fundingMethod && <div><b>Funding Method:</b> {inv.banking.fundingMethod}</div>}
                                {inv.banking.payoutMethod && <div><b>Payout Method:</b> {inv.banking.payoutMethod}</div>}
                              </>
                            )}
                            {inv.entity && (
                              <>
                                <div><b>Entity Name:</b> {inv.entity.name || '-'}</div>
                                <div><b>Entity TIN:</b> {inv.entity.taxId || '-'}</div>
                              </>
                            )}
                            {inv.jointHoldingType && (
                              <div><b>Joint Holding Type:</b> {inv.jointHoldingType}</div>
                            )}
                          </div>
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                            <button 
                              className={styles.secondaryButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/investments/${inv.id}`);
                              }}
                              style={{ width: '100%' }}
                            >
                              View Full Investment Details →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.muted}>No investments</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


