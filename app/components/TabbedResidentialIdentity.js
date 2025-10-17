'use client'
import { useEffect, useMemo, useState } from 'react'
import styles from './TabbedResidentialIdentity.module.css'

const MIN_DOB = '1900-01-01'

const formatZip = (value = '') => value.replace(/\D/g, '').slice(0, 5)

const formatPhone = (value = '') => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

const isCompletePhone = (value = '') => value.replace(/\D/g, '').length === 10

// Normalize phone number to E.164 format for database storage (+1XXXXXXXXXX)
const normalizePhoneForDB = (value = '') => {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }
  return value // Return original if format is unexpected
}

// Convert E.164 phone number back to display format
const formatPhoneFromDB = (value = '') => {
  if (!value) return ''
  if (value.startsWith('+1')) {
    const digits = value.slice(2) // Remove +1
    if (digits.length === 10) {
      return formatPhone(digits)
    }
  }
  return value // Return original if format is unexpected
}

const formatSsn = (value = '') => {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 3) return digits
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
}

const isCompleteSsn = (value = '') => value.replace(/\D/g, '').length === 9

// Names: Allow only letters, spaces, hyphens, apostrophes, and periods
const formatName = (value = '') => value.replace(/[^a-zA-Z\s'\-\.]/g, '')

// City names: Allow only letters, spaces, hyphens, apostrophes, and periods
const formatCity = (value = '') => value.replace(/[^a-zA-Z\s'\-\.]/g, '')

// Street addresses: Allow letters, numbers, spaces, hyphens, periods, commas, and hash symbols
const formatStreet = (value = '') => value.replace(/[^a-zA-Z0-9\s'\-\.,#]/g, '')

const parseDateString = (value = '') => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

const isAdultDob = (value = '') => {
  const date = parseDateString(value)
  if (!date) return false
  const minimum = parseDateString(MIN_DOB)
  if (!minimum || date < minimum) return false
  const today = new Date()
  const adultCutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return date <= adultCutoff
}

export default function TabbedResidentialIdentity({ onCompleted, onReviewSummary, accountType: accountTypeProp }) {
  const US_STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
  ]
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    entityName: '',
    phone: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    dob: '',
    ssn: '',
    jointHoldingType: '',
    jointHolder: {
      firstName: '',
      lastName: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States',
      dob: '',
      ssn: '',
      email: '',
      phone: ''
    },
    authorizedRep: {
      firstName: '',
      lastName: '',
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: '',
      country: 'United States',
      dob: '',
      ssn: ''
    }
  })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [accountType, setAccountType] = useState(accountTypeProp || 'individual')
  const [jointUsePrimaryAddress, setJointUsePrimaryAddress] = useState(true)
  const [showSsnHelp, setShowSsnHelp] = useState(false)
  const [showAuthorizedRepSsnHelp, setShowAuthorizedRepSsnHelp] = useState(false)
  const [showJointSsnHelp, setShowJointSsnHelp] = useState(false)
  const [hasActiveInvestments, setHasActiveInvestments] = useState(false)
  const idLabel = accountType === 'entity' ? 'EIN or TIN' : 'SSN'
  const dateLabel = accountType === 'entity' ? 'Registration Date' : 'Date of Birth'

  const maxAdultDob = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
    return cutoff.toISOString().split('T')[0]
  }, [])
  const maxToday = useMemo(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }, [])

  useEffect(() => {
    if (accountTypeProp) setAccountType(accountTypeProp)
  }, [accountTypeProp])

  useEffect(() => {
    const bootstrap = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return
      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          const u = data.user
          // Determine current investment accountType if available
          const investments = Array.isArray(u.investments) ? u.investments : []
          const currentInv = investments.find(inv => inv.id === localStorage.getItem('currentInvestmentId'))
          if (!accountTypeProp && currentInv?.accountType) setAccountType(currentInv.accountType)
          
          // Check if user has any pending or active investments
          // This will lock identity fields (name, DOB, SSN) but allow updating contact info (phone, address)
          const hasPendingOrActive = investments.some(inv => inv.status === 'pending' || inv.status === 'active')
          setHasActiveInvestments(hasPendingOrActive)

          // SSN/TIN: If already encrypted (saved), show masked value so validation passes
          // Show as "•••-••-••••" to indicate it's on file
          const savedSsn = u.ssn || u.taxId || ''
          const isEncryptedSsn = savedSsn.includes(':') || savedSsn.length > 20
          
          const savedJointSsn = u.jointHolder?.ssn || ''
          const isEncryptedJointSsn = savedJointSsn.includes(':') || savedJointSsn.length > 20
          
          const savedAuthRepSsn = u.authorizedRepresentative?.ssn || ''
          const isEncryptedAuthRepSsn = savedAuthRepSsn.includes(':') || savedAuthRepSsn.length > 20

          setForm(prev => ({
            ...prev,
            entityName: u.entityName || '',
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            phone: formatPhoneFromDB(u.phoneNumber || ''),
            street1: u.address?.street1 || '',
            street2: u.address?.street2 || '',
            city: u.address?.city || '',
            state: u.address?.state || '',
            zip: u.address?.zip || '',
            country: u.address?.country || 'United States',
            dob: u.dob || '',
            ssn: isEncryptedSsn ? '•••-••-••••' : savedSsn,
            jointHoldingType: u.jointHoldingType || '',
            jointHolder: {
              firstName: u.jointHolder?.firstName || '',
              lastName: u.jointHolder?.lastName || '',
              street1: u.jointHolder?.address?.street1 || '',
              street2: u.jointHolder?.address?.street2 || '',
              city: u.jointHolder?.address?.city || '',
              state: u.jointHolder?.address?.state || '',
              zip: u.jointHolder?.address?.zip || '',
              country: u.jointHolder?.address?.country || 'United States',
              dob: u.jointHolder?.dob || '',
              ssn: isEncryptedJointSsn ? '•••-••-••••' : savedJointSsn,
              email: u.jointHolder?.email || '',
              phone: formatPhoneFromDB(u.jointHolder?.phone || '')
            },
            authorizedRep: {
              firstName: u.authorizedRepresentative?.firstName || '',
              lastName: u.authorizedRepresentative?.lastName || '',
              street1: u.authorizedRepresentative?.address?.street1 || '',
              street2: u.authorizedRepresentative?.address?.street2 || '',
              city: u.authorizedRepresentative?.address?.city || '',
              state: u.authorizedRepresentative?.address?.state || '',
              zip: u.authorizedRepresentative?.address?.zip || '',
              country: u.authorizedRepresentative?.address?.country || 'United States',
              dob: u.authorizedRepresentative?.dob || '',
              ssn: isEncryptedAuthRepSsn ? '•••-••-••••' : savedAuthRepSsn
            }
          }))
        }
      } catch (e) {
        console.error('Failed to load user for address', e)
      }
    }
    bootstrap()
  }, [])

  // Joint holding type should not be auto-defaulted - user must select explicitly

  useEffect(() => {
    if (accountType !== 'joint') return
    if (!jointUsePrimaryAddress) return
    setForm(prev => ({
      ...prev,
      jointHolder: {
        ...prev.jointHolder,
        street1: prev.street1,
        street2: prev.street2,
        city: prev.city,
        state: prev.state,
        zip: prev.zip,
        country: prev.country
      }
    }))
  }, [accountType, jointUsePrimaryAddress, form.street1, form.street2, form.city, form.state, form.zip, form.country])

  const setFieldValue = (name, value) => {
    if (name.startsWith('jointHolder.')) {
      const fieldName = name.replace('jointHolder.', '')
      setForm(prev => ({ 
        ...prev, 
        jointHolder: { ...prev.jointHolder, [fieldName]: value }
      }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    } else if (name.startsWith('authorizedRep.')) {
      const fieldName = name.replace('authorizedRep.', '')
      setForm(prev => ({
        ...prev,
        authorizedRep: { ...prev.authorizedRep, [fieldName]: value }
      }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    } else {
      setForm(prev => ({ ...prev, [name]: value }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name.endsWith('firstName') || name.endsWith('lastName')) {
      setFieldValue(name, formatName(value))
      return
    }
    if (name === 'entityName') {
      setFieldValue(name, formatName(value))
      return
    }
    if (name.endsWith('.city') || name === 'city') {
      setFieldValue(name, formatCity(value))
      return
    }
    if (name.endsWith('.street1') || name === 'street1' || name.endsWith('.street2') || name === 'street2') {
      setFieldValue(name, formatStreet(value))
      return
    }
    if (name.endsWith('.zip') || name === 'zip') {
      setFieldValue(name, formatZip(value))
      return
    }
    if (name.endsWith('.phone') || name === 'phone') {
      setFieldValue(name, formatPhone(value))
      return
    }
    if (name.endsWith('.ssn') || name === 'ssn') {
      setFieldValue(name, formatSsn(value))
      return
    }
    setFieldValue(name, value)
  }

  const validate = () => {
    const newErrors = {}
    if (accountType === 'entity') {
      if (!form.entityName.trim()) newErrors.entityName = 'Required'
    }
    if (accountType !== 'entity') {
      if (!form.firstName.trim()) newErrors.firstName = 'Required'
      if (!form.lastName.trim()) newErrors.lastName = 'Required'
    }
    if (!form.phone.trim()) newErrors.phone = 'Required'
    else if (!isCompletePhone(form.phone)) newErrors.phone = 'Enter full 10-digit phone number'
    if (!form.street1.trim()) newErrors.street1 = 'Required'
    if (!form.city.trim()) newErrors.city = 'Required'
    else if (/[0-9]/.test(form.city)) newErrors.city = 'No numbers allowed'
    if (!form.state.trim()) newErrors.state = 'Required'
  if (!form.zip.trim()) newErrors.zip = 'Required'
  else if (form.zip.length !== 5) newErrors.zip = 'Enter 5 digits'
  if (!form.dob) newErrors.dob = 'Required'
  else if (accountType === 'entity') {
    const date = (() => { const [y,m,d] = form.dob.split('-').map(Number); return new Date(y, m-1, d) })()
    const today = new Date()
    const min = (() => { const [y,m,d] = MIN_DOB.split('-').map(Number); return new Date(y, m-1, d) })()
    if (!(date >= min && date <= today)) newErrors.dob = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Cannot be in the future.`
  } else if (!isAdultDob(form.dob)) {
    newErrors.dob = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
  }
  // Skip SSN validation if it's masked (already on file)
  if (!form.ssn.trim()) newErrors.ssn = 'Required'
  else if (form.ssn !== '•••-••-••••' && !isCompleteSsn(form.ssn)) newErrors.ssn = 'Enter full SSN'
    
    // Validate joint holder fields if account type is joint
    if (accountType === 'joint') {
      if (!form.jointHoldingType.trim()) newErrors.jointHoldingType = 'Required'
      if (!form.jointHolder.firstName.trim()) newErrors['jointHolder.firstName'] = 'Required'
      if (!form.jointHolder.lastName.trim()) newErrors['jointHolder.lastName'] = 'Required'
      if (!form.jointHolder.street1.trim()) newErrors['jointHolder.street1'] = 'Required'
      if (!form.jointHolder.city.trim()) newErrors['jointHolder.city'] = 'Required'
      else if (/[0-9]/.test(form.jointHolder.city)) newErrors['jointHolder.city'] = 'No numbers allowed'
      if (!form.jointHolder.state.trim()) newErrors['jointHolder.state'] = 'Required'
      if (!form.jointHolder.zip.trim()) newErrors['jointHolder.zip'] = 'Required'
      else if (form.jointHolder.zip.length !== 5) newErrors['jointHolder.zip'] = 'Enter 5 digits'
      if (!form.jointHolder.dob || !isAdultDob(form.jointHolder.dob)) newErrors['jointHolder.dob'] = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
      // Skip joint holder SSN validation if it's masked (already on file)
      if (!form.jointHolder.ssn.trim()) newErrors['jointHolder.ssn'] = 'Required'
      else if (form.jointHolder.ssn !== '•••-••-••••' && !isCompleteSsn(form.jointHolder.ssn)) newErrors['jointHolder.ssn'] = 'Enter full SSN'
      if (!/\S+@\S+\.\S+/.test(form.jointHolder.email)) newErrors['jointHolder.email'] = 'Invalid email'
      if (!form.jointHolder.phone.trim()) newErrors['jointHolder.phone'] = 'Required'
      else if (!isCompletePhone(form.jointHolder.phone)) newErrors['jointHolder.phone'] = 'Enter full 10-digit phone number'
    }
    if (accountType === 'entity') {
      // Authorized representative must also be provided
      if (!form.authorizedRep.firstName.trim()) newErrors['authorizedRep.firstName'] = 'Required'
      if (!form.authorizedRep.lastName.trim()) newErrors['authorizedRep.lastName'] = 'Required'
      if (!form.authorizedRep.street1.trim()) newErrors['authorizedRep.street1'] = 'Required'
      if (!form.authorizedRep.city.trim()) newErrors['authorizedRep.city'] = 'Required'
      else if (/[0-9]/.test(form.authorizedRep.city)) newErrors['authorizedRep.city'] = 'No numbers allowed'
      if (!form.authorizedRep.state.trim()) newErrors['authorizedRep.state'] = 'Required'
      if (!form.authorizedRep.zip.trim()) newErrors['authorizedRep.zip'] = 'Required'
      else if (form.authorizedRep.zip.length !== 5) newErrors['authorizedRep.zip'] = 'Enter 5 digits'
      if (!form.authorizedRep.dob || !isAdultDob(form.authorizedRep.dob)) newErrors['authorizedRep.dob'] = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
      // Skip authorized rep SSN validation if it's masked (already on file)
      if (!form.authorizedRep.ssn.trim()) newErrors['authorizedRep.ssn'] = 'Required'
      else if (form.authorizedRep.ssn !== '•••-••-••••' && !isCompleteSsn(form.authorizedRep.ssn)) newErrors['authorizedRep.ssn'] = 'Enter full SSN'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    
    // Note: Identity fields (name, DOB, SSN) are disabled when there are active investments
    // Contact info (phone, address) can still be updated per investment
    
    setIsSaving(true)
    try {
      const userId = localStorage.getItem('currentUserId')
      const investmentId = localStorage.getItem('currentInvestmentId')
      if (!userId) return

      // Update user profile
      const jointAddress = jointUsePrimaryAddress ? {
        street1: form.street1,
        street2: form.street2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country
      } : {
        street1: form.jointHolder.street1,
        street2: form.jointHolder.street2,
        city: form.jointHolder.city,
        state: form.jointHolder.state,
        zip: form.jointHolder.zip,
        country: form.jointHolder.country
      }

      // Don't send masked SSN values - they're already on file
      const isSsnMasked = form.ssn === '•••-••-••••'
      const isAuthRepSsnMasked = form.authorizedRep.ssn === '•••-••-••••'
      
      const userData = {
        ...(accountType !== 'entity' ? {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim()
        } : {}),
        phoneNumber: normalizePhoneForDB(form.phone.trim()),
        ...(accountType === 'entity' ? { entity: {
          name: form.entityName,
          registrationDate: form.dob,
          // Only send taxId if it's not masked (already on file)
          ...(isSsnMasked ? {} : { taxId: form.ssn }),
          address: {
            street1: form.street1,
            street2: form.street2,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country
          }
        }} : {}),
        ...(accountType !== 'entity' ? {
          dob: form.dob,
          // Only send ssn if it's not masked (already on file)
          ...(isSsnMasked ? {} : { ssn: form.ssn }),
          address: {
            street1: form.street1,
            street2: form.street2,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country
          }
        } : {}),
        ...(accountType === 'entity' ? { authorizedRepresentative: {
          firstName: form.authorizedRep.firstName.trim(),
          lastName: form.authorizedRep.lastName.trim(),
          dob: form.authorizedRep.dob,
          // Only send ssn if it's not masked (already on file)
          ...(isAuthRepSsnMasked ? {} : { ssn: form.authorizedRep.ssn }),
          address: {
            street1: form.authorizedRep.street1,
            street2: form.authorizedRep.street2,
            city: form.authorizedRep.city,
            state: form.authorizedRep.state,
            zip: form.authorizedRep.zip,
            country: form.authorizedRep.country
          }
        }} : {})
      }

      // Add joint holder data if account type is joint
      if (accountType === 'joint') {
        const isJointSsnMasked = form.jointHolder.ssn === '•••-••-••••'
        userData.jointHoldingType = form.jointHoldingType
        userData.jointHolder = {
          firstName: form.jointHolder.firstName.trim(),
          lastName: form.jointHolder.lastName.trim(),
          address: jointAddress,
          dob: form.jointHolder.dob,
          // Only send ssn if it's not masked (already on file)
          ...(isJointSsnMasked ? {} : { ssn: form.jointHolder.ssn }),
          email: form.jointHolder.email,
          phone: normalizePhoneForDB(form.jointHolder.phone)
        }
      }

      const resUser = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      await resUser.json()

      // Also reflect into the current investment if available
      if (investmentId) {
        let investmentFields = {}
        
        if (accountType === 'entity') {
          investmentFields = {
            entity: {
              name: form.entityName,
              registrationDate: form.dob,
              taxId: form.ssn,
              address: {
                street1: form.street1,
                street2: form.street2,
                city: form.city,
                state: form.state,
                zip: form.zip,
                country: form.country
              }
            },
            authorizedRepresentative: {
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
            }
          }
        } else if (accountType === 'joint') {
          // For joint accounts, only save joint-specific data
          // Personal info is at user level, no need to duplicate
          investmentFields = {}
        } else {
          // For individual/IRA accounts, don't duplicate personalInfo and address
          // This data is already stored at the user level
          investmentFields = {}
        }

        // Add joint holder data to investment if account type is joint
        if (accountType === 'joint') {
          investmentFields.jointHoldingType = form.jointHoldingType
          investmentFields.jointHolder = {
            firstName: form.jointHolder.firstName.trim(),
            lastName: form.jointHolder.lastName.trim(),
            address: jointAddress,
            dob: form.jointHolder.dob,
            ssn: form.jointHolder.ssn,
            email: form.jointHolder.email,
            phone: normalizePhoneForDB(form.jointHolder.phone)
          }
        }

        await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _action: 'updateInvestment',
            investmentId,
            fields: investmentFields
          })
        })
      }

      const summary = {
        ...(accountType !== 'entity' ? {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim()
        } : {}),
        phone: form.phone.trim(),
        street1: form.street1,
        street2: form.street2,
        city: form.city,
        state: form.state,
        zip: form.zip,
        country: form.country,
        dob: form.dob,
        ssn: form.ssn,
        accountType,
        jointHoldingType: form.jointHoldingType,
        jointHolder: accountType === 'joint' ? {
          firstName: form.jointHolder.firstName,
          lastName: form.jointHolder.lastName,
          email: form.jointHolder.email,
          phone: form.jointHolder.phone,
          dob: form.jointHolder.dob,
          ssn: form.jointHolder.ssn,
          address: jointAddress
        } : undefined,
        entityName: accountType === 'entity' ? form.entityName : undefined,
        authorizedRep: accountType === 'entity' ? {
          firstName: form.authorizedRep.firstName,
          lastName: form.authorizedRep.lastName,
          dob: form.authorizedRep.dob,
          ssn: form.authorizedRep.ssn,
          address: {
            street1: form.authorizedRep.street1,
            street2: form.authorizedRep.street2,
            city: form.authorizedRep.city,
            state: form.authorizedRep.state,
            zip: form.authorizedRep.zip,
            country: form.authorizedRep.country,
          }
        } : undefined
      }
      if (typeof onReviewSummary === 'function') onReviewSummary(summary)
      if (typeof onCompleted === 'function') onCompleted(summary)
    } catch (e) {
      console.error('Failed saving address & identity', e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* Warning message if user has active investments */}
      {hasActiveInvestments && (
        <div style={{
          padding: '16px',
          marginBottom: '20px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          color: '#92400e',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          <strong>⚠️ Identity Information Locked:</strong> Your name, date of birth, and SSN/TIN cannot be modified while you have pending or active investments. You can still update your phone number and address for this investment.
        </div>
      )}
      
      {/* Joint Holding Type Selection - only show for joint accounts */}
      {accountType === 'joint' && (
        <div className={styles.jointHoldingTypeSection}>
          <div className={styles.field}>
            <label className={styles.label}>Joint Holding Type</label>
            <select
              name="jointHoldingType"
              value={form.jointHoldingType}
              onChange={handleChange}
              className={`${styles.input} ${errors.jointHoldingType ? styles.inputError : ''}`}
            >
              <option value="">Select joint holding type</option>
              <option value="spouse">Spouse</option>
              <option value="sibling">Sibling</option>
              <option value="domestic_partner">Domestic Partner</option>
              <option value="business_partner">Business Partner</option>
              <option value="other">Other</option>
            </select>
            {errors.jointHoldingType && <span className={styles.error}>{errors.jointHoldingType}</span>}
          </div>
        </div>
      )}

      {/* Authorized Representative first for Entities */}
      {accountType === 'entity' && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Authorized Representative Information</h3>
          </div>
          <div className={styles.grid}>
            <div className={styles.field}> 
              <label className={styles.label}>First Name</label>
              <input className={`${styles.input} ${errors['authorizedRep.firstName'] ? styles.inputError : ''}`} name="authorizedRep.firstName" value={form.authorizedRep.firstName} onChange={handleChange} placeholder="Enter first name" disabled={hasActiveInvestments} />
              {errors['authorizedRep.firstName'] && <span className={styles.error}>{errors['authorizedRep.firstName']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Last Name</label>
              <input className={`${styles.input} ${errors['authorizedRep.lastName'] ? styles.inputError : ''}`} name="authorizedRep.lastName" value={form.authorizedRep.lastName} onChange={handleChange} placeholder="Enter last name" disabled={hasActiveInvestments} />
              {errors['authorizedRep.lastName'] && <span className={styles.error}>{errors['authorizedRep.lastName']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Street Address</label>
              <input className={`${styles.input} ${errors['authorizedRep.street1'] ? styles.inputError : ''}`} name="authorizedRep.street1" value={form.authorizedRep.street1} onChange={handleChange} placeholder="No PO Boxes" />
              {errors['authorizedRep.street1'] && <span className={styles.error}>{errors['authorizedRep.street1']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Apt or Unit</label>
              <input className={styles.input} name="authorizedRep.street2" value={form.authorizedRep.street2} onChange={handleChange} placeholder="Apt, unit, etc." />
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>City</label>
              <input className={`${styles.input} ${errors['authorizedRep.city'] ? styles.inputError : ''}`} name="authorizedRep.city" value={form.authorizedRep.city} onChange={handleChange} placeholder="Enter city" />
              {errors['authorizedRep.city'] && <span className={styles.error}>{errors['authorizedRep.city']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Zip Code</label>
              <input className={`${styles.input} ${errors['authorizedRep.zip'] ? styles.inputError : ''}`} name="authorizedRep.zip" value={form.authorizedRep.zip} onChange={handleChange} placeholder="Enter ZIP code" inputMode="numeric" />
              {errors['authorizedRep.zip'] && <span className={styles.error}>{errors['authorizedRep.zip']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>State</label>
              <select
                name="authorizedRep.state"
                value={form.authorizedRep.state}
                onChange={handleChange}
                className={`${styles.input} ${errors['authorizedRep.state'] ? styles.inputError : ''}`}
              >
                <option value="">Select state</option>
                {US_STATES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {errors['authorizedRep.state'] && <span className={styles.error}>{errors['authorizedRep.state']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Country</label>
              <input className={styles.input} name="authorizedRep.country" value={form.authorizedRep.country} readOnly disabled />
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Date of Birth</label>
              <input className={`${styles.input} ${errors['authorizedRep.dob'] ? styles.inputError : ''}`} type="date" name="authorizedRep.dob" value={form.authorizedRep.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} disabled={hasActiveInvestments} />
              {errors['authorizedRep.dob'] && <span className={styles.error}>{errors['authorizedRep.dob']}</span>}
            </div>
            <div className={styles.field}> 
              <div className={styles.labelRow}>
                <label className={styles.label}>SSN</label>
                <button type="button" className={styles.helpLink} onClick={() => setShowAuthorizedRepSsnHelp(v => !v)}>Why do we need this?</button>
              </div>
              <input 
                className={`${styles.input} ${errors['authorizedRep.ssn'] ? styles.inputError : ''}`} 
                type="password"
                name="authorizedRep.ssn" 
                value={form.authorizedRep.ssn} 
                onChange={handleChange} 
                placeholder="123-45-6789" 
                inputMode="numeric" 
                disabled={hasActiveInvestments} 
                readOnly={hasActiveInvestments}
                autoComplete="off"
              />
              {errors['authorizedRep.ssn'] && <span className={styles.error}>{errors['authorizedRep.ssn']}</span>}
              {showAuthorizedRepSsnHelp && (
                <div className={styles.helpText}>
                  A Taxpayer Identification Number (TIN) is necessary for compliance with Anti-Money Laundering (AML) and Know Your Customer (KYC) regulations. This information is securely stored and used only for verification purposes.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Holder / Entity Information Section */}
      <div className={styles.sectionTitle}>
        <h3>{accountType === 'entity' ? 'Entity Information' : (accountType === 'joint' ? 'Primary Holder Information' : 'Holder Information')}</h3>
      </div>
      <div className={styles.grid}>
        {accountType === 'entity' && (
          <>
            <div className={styles.field}> 
              <label className={styles.label}>Entity Name</label>
              <input className={`${styles.input} ${errors.entityName ? styles.inputError : ''}`} name="entityName" value={form.entityName} onChange={handleChange} placeholder="Enter entity name" disabled={hasActiveInvestments} />
              {errors.entityName && <span className={styles.error}>{errors.entityName}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Phone Number</label>
              <input className={`${styles.input} ${errors.phone ? styles.inputError : ''}`} name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 555-5555" inputMode="tel" />
              {errors.phone && <span className={styles.error}>{errors.phone}</span>}
            </div>
          </>
        )}
        {accountType !== 'entity' && (
          <>
            <div className={styles.field}> 
              <label className={styles.label}>First Name</label>
              <input className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`} name="firstName" value={form.firstName} onChange={handleChange} placeholder="Enter first name" disabled={hasActiveInvestments} />
              {errors.firstName && <span className={styles.error}>{errors.firstName}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Last Name</label>
              <input className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`} name="lastName" value={form.lastName} onChange={handleChange} placeholder="Enter last name" disabled={hasActiveInvestments} />
              {errors.lastName && <span className={styles.error}>{errors.lastName}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Phone Number</label>
              <input className={`${styles.input} ${errors.phone ? styles.inputError : ''}`} name="phone" value={form.phone} onChange={handleChange} placeholder="(555) 555-5555" inputMode="tel" />
              {errors.phone && <span className={styles.error}>{errors.phone}</span>}
            </div>
          </>
        )}
        <div className={styles.field}> 
          <label className={styles.label}>Street Address</label>
          <input className={`${styles.input} ${errors.street1 ? styles.inputError : ''}`} name="street1" value={form.street1} onChange={handleChange} placeholder="No PO Boxes" />
          {errors.street1 && <span className={styles.error}>{errors.street1}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>Apt or Unit</label>
          <input className={styles.input} name="street2" value={form.street2} onChange={handleChange} placeholder="Apt, unit, etc." />
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>City</label>
          <input className={`${styles.input} ${errors.city ? styles.inputError : ''}`} name="city" value={form.city} onChange={handleChange} placeholder="Enter city" />
          {errors.city && <span className={styles.error}>{errors.city}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>Zip Code</label>
          <input className={`${styles.input} ${errors.zip ? styles.inputError : ''}`} name="zip" value={form.zip} onChange={handleChange} placeholder="Enter ZIP code" inputMode="numeric" />
          {errors.zip && <span className={styles.error}>{errors.zip}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>State</label>
          <select
            name="state"
            value={form.state}
            onChange={handleChange}
            className={`${styles.input} ${errors.state ? styles.inputError : ''}`}
          >
            <option value="">Select state</option>
            {US_STATES.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {errors.state && <span className={styles.error}>{errors.state}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>Country</label>
          <input className={styles.input} name="country" value={form.country} readOnly disabled />
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>{dateLabel}</label>
          <input className={`${styles.input} ${errors.dob ? styles.inputError : ''}`} type="date" name="dob" value={form.dob} onChange={handleChange} min={MIN_DOB} max={accountType === 'entity' ? maxToday : maxAdultDob} disabled={hasActiveInvestments} />
          {errors.dob && <span className={styles.error}>{errors.dob}</span>}
        </div>
        <div className={styles.field}> 
          <div className={styles.labelRow}>
            <label className={styles.label}>{idLabel}</label>
            <button type="button" className={styles.helpLink} onClick={() => setShowSsnHelp(v => !v)}>
              Why do we need this?
            </button>
          </div>
          <input 
            className={`${styles.input} ${errors.ssn ? styles.inputError : ''}`} 
            type="password"
            name="ssn" 
            value={form.ssn} 
            onChange={handleChange} 
            placeholder={accountType === 'entity' ? 'Enter EIN or TIN' : '123-45-6789'} 
            inputMode="numeric" 
            disabled={hasActiveInvestments} 
            readOnly={hasActiveInvestments}
            autoComplete="off"
          />
          {errors.ssn && <span className={styles.error}>{errors.ssn}</span>}
          {showSsnHelp && (
            <div className={styles.helpText}>
              A Taxpayer Identification Number (TIN) is necessary for compliance with Anti-Money Laundering (AML) and Know Your Customer (KYC) regulations. This information is securely stored and used only for verification purposes.
            </div>
          )}
        </div>
      </div>

      {/* Authorized Representative Information for Entities - section moved above */}

      {/* Joint Holder Information Section - only show for joint accounts */}
      {accountType === 'joint' && (
        <>
          <div className={styles.sectionTitle}>
            <h3>Joint Holder Information</h3>
          </div>
          {/* Move the toggle below identity fields for better flow */}

          <div className={styles.grid}>
            <div className={styles.field}> 
              <label className={styles.label}>First Name</label>
              <input className={`${styles.input} ${errors['jointHolder.firstName'] ? styles.inputError : ''}`} name="jointHolder.firstName" value={form.jointHolder.firstName} onChange={handleChange} placeholder="Enter first name" disabled={hasActiveInvestments} />
              {errors['jointHolder.firstName'] && <span className={styles.error}>{errors['jointHolder.firstName']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Last Name</label>
              <input className={`${styles.input} ${errors['jointHolder.lastName'] ? styles.inputError : ''}`} name="jointHolder.lastName" value={form.jointHolder.lastName} onChange={handleChange} placeholder="Enter last name" disabled={hasActiveInvestments} />
              {errors['jointHolder.lastName'] && <span className={styles.error}>{errors['jointHolder.lastName']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Email</label>
              <input className={`${styles.input} ${errors['jointHolder.email'] ? styles.inputError : ''}`} name="jointHolder.email" value={form.jointHolder.email} onChange={handleChange} placeholder="name@example.com" />
              {errors['jointHolder.email'] && <span className={styles.error}>{errors['jointHolder.email']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Phone</label>
              <input className={`${styles.input} ${errors['jointHolder.phone'] ? styles.inputError : ''}`} name="jointHolder.phone" value={form.jointHolder.phone} onChange={handleChange} placeholder="(555) 555-5555" />
              {errors['jointHolder.phone'] && <span className={styles.error}>{errors['jointHolder.phone']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Date of Birth</label>
              <input className={`${styles.input} ${errors['jointHolder.dob'] ? styles.inputError : ''}`} type="date" name="jointHolder.dob" value={form.jointHolder.dob} onChange={handleChange} min={MIN_DOB} max={maxAdultDob} disabled={hasActiveInvestments} />
              {errors['jointHolder.dob'] && <span className={styles.error}>{errors['jointHolder.dob']}</span>}
            </div>
            <div className={styles.field}> 
              <div className={styles.labelRow}>
                <label className={styles.label}>SSN</label>
                <button type="button" className={styles.helpLink} onClick={() => setShowJointSsnHelp(v => !v)}>Why do we need this?</button>
              </div>
              <input 
                className={`${styles.input} ${errors['jointHolder.ssn'] ? styles.inputError : ''}`} 
                type="password"
                name="jointHolder.ssn" 
                value={form.jointHolder.ssn} 
                onChange={handleChange} 
                placeholder="123-45-6789" 
                inputMode="numeric" 
                disabled={hasActiveInvestments} 
                readOnly={hasActiveInvestments}
                autoComplete="off"
              />
              {errors['jointHolder.ssn'] && <span className={styles.error}>{errors['jointHolder.ssn']}</span>}
              {showJointSsnHelp && (
                <div className={styles.helpText}>
                  A Taxpayer Identification Number (TIN) is necessary for compliance with Anti-Money Laundering (AML) and Know Your Customer (KYC) regulations. This information is securely stored and used only for verification purposes.
                </div>
              )}
            </div>
          </div>

          <div style={{ margin: '16px 0 12px 0' }}>
            {jointUsePrimaryAddress ? (
              <button type="button" onClick={() => setJointUsePrimaryAddress(false)} className={styles.secondaryButton}>
                The joint holder has a different address
              </button>
            ) : (
              <button type="button" onClick={() => setJointUsePrimaryAddress(true)} className={styles.secondaryButton}>
                Use same address as primary
              </button>
            )}
          </div>

          {/* Address fields are revealed below the toggle to keep flow */}
          {!jointUsePrimaryAddress && (
            <div className={styles.grid}>
              <div className={styles.field}> 
                <label className={styles.label}>Street Address</label>
                <input className={`${styles.input} ${errors['jointHolder.street1'] ? styles.inputError : ''}`} name="jointHolder.street1" value={form.jointHolder.street1} onChange={handleChange} placeholder="No PO Boxes" />
                {errors['jointHolder.street1'] && <span className={styles.error}>{errors['jointHolder.street1']}</span>}
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>Apt or Unit</label>
                <input className={styles.input} name="jointHolder.street2" value={form.jointHolder.street2} onChange={handleChange} placeholder="Apt, unit, etc." />
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>City</label>
                <input className={`${styles.input} ${errors['jointHolder.city'] ? styles.inputError : ''}`} name="jointHolder.city" value={form.jointHolder.city} onChange={handleChange} placeholder="Enter city" />
                {errors['jointHolder.city'] && <span className={styles.error}>{errors['jointHolder.city']}</span>}
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>Zip Code</label>
                <input className={`${styles.input} ${errors['jointHolder.zip'] ? styles.inputError : ''}`} name="jointHolder.zip" value={form.jointHolder.zip} onChange={handleChange} placeholder="Enter ZIP code" inputMode="numeric" />
                {errors['jointHolder.zip'] && <span className={styles.error}>{errors['jointHolder.zip']}</span>}
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>State</label>
                <select
                  name="jointHolder.state"
                  value={form.jointHolder.state}
                  onChange={handleChange}
                  className={`${styles.input} ${errors['jointHolder.state'] ? styles.inputError : ''}`}
                >
                  <option value="">Select state</option>
                  {US_STATES.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {errors['jointHolder.state'] && <span className={styles.error}>{errors['jointHolder.state']}</span>}
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>Country</label>
                <input className={styles.input} name="jointHolder.country" value={form.jointHolder.country} readOnly disabled />
              </div>
            </div>
          )}
        </>
      )}

      <div className={styles.actions}>
        <button className={styles.primaryButton} onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}


