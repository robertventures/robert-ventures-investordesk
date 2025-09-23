'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './TabbedResidentialIdentity.module.css'

export default function TabbedResidentialIdentity({ onCompleted, accountType: accountTypeProp }) {
  const router = useRouter()
  const US_STATES = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'
  ]
  const [form, setForm] = useState({
    entityName: '',
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
  const idLabel = accountType === 'entity' ? 'EIN or TIN' : 'SSN'
  const dateLabel = accountType === 'entity' ? 'Registration Date' : 'Date of Birth'

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

          setForm(prev => ({
            ...prev,
            entityName: u.entityName || '',
            street1: u.address?.street1 || '',
            street2: u.address?.street2 || '',
            city: u.address?.city || '',
            state: u.address?.state || '',
            zip: u.address?.zip || '',
            country: u.address?.country || 'United States',
            dob: u.dob || '',
            ssn: (u.ssn || u.taxId || ''),
            jointHoldingType: u.jointHoldingType || '',
            jointHolder: {
              street1: u.jointHolder?.address?.street1 || '',
              street2: u.jointHolder?.address?.street2 || '',
              city: u.jointHolder?.address?.city || '',
              state: u.jointHolder?.address?.state || '',
              zip: u.jointHolder?.address?.zip || '',
              country: u.jointHolder?.address?.country || 'United States',
              dob: u.jointHolder?.dob || '',
              ssn: u.jointHolder?.ssn || '',
              email: u.jointHolder?.email || '',
              phone: u.jointHolder?.phone || ''
            },
            authorizedRep: {
              street1: u.authorizedRepresentative?.address?.street1 || '',
              street2: u.authorizedRepresentative?.address?.street2 || '',
              city: u.authorizedRepresentative?.address?.city || '',
              state: u.authorizedRepresentative?.address?.state || '',
              zip: u.authorizedRepresentative?.address?.zip || '',
              country: u.authorizedRepresentative?.address?.country || 'United States',
              dob: u.authorizedRepresentative?.dob || '',
              ssn: u.authorizedRepresentative?.ssn || ''
            }
          }))
        }
      } catch (e) {
        console.error('Failed to load user for address', e)
      }
    }
    bootstrap()
  }, [])

  // When switching to joint account type, default the joint holding type if not set
  useEffect(() => {
    if (accountType === 'joint' && !form.jointHoldingType) {
      setForm(prev => ({ ...prev, jointHoldingType: 'spouse' }))
    }
  }, [accountType])

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

  const handleChange = (e) => {
    const { name, value } = e.target
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

  const validate = () => {
    const newErrors = {}
    if (accountType === 'entity') {
      if (!form.entityName.trim()) newErrors.entityName = 'Required'
    }
    if (!form.street1.trim()) newErrors.street1 = 'Required'
    if (!form.city.trim()) newErrors.city = 'Required'
    if (!form.state.trim()) newErrors.state = 'Required'
    if (!form.zip.trim()) newErrors.zip = 'Required'
    if (!form.dob) newErrors.dob = 'Required'
    if (!form.ssn.trim()) newErrors.ssn = 'Required'
    
    // Validate joint holder fields if account type is joint
    if (accountType === 'joint') {
      if (!form.jointHoldingType.trim()) newErrors.jointHoldingType = 'Required'
      if (!form.jointHolder.street1.trim()) newErrors['jointHolder.street1'] = 'Required'
      if (!form.jointHolder.city.trim()) newErrors['jointHolder.city'] = 'Required'
      if (!form.jointHolder.state.trim()) newErrors['jointHolder.state'] = 'Required'
      if (!form.jointHolder.zip.trim()) newErrors['jointHolder.zip'] = 'Required'
      if (!form.jointHolder.dob) newErrors['jointHolder.dob'] = 'Required'
      // SSN is optional for joint holder
      if (!/\S+@\S+\.\S+/.test(form.jointHolder.email)) newErrors['jointHolder.email'] = 'Invalid email'
      if (!form.jointHolder.phone.trim()) newErrors['jointHolder.phone'] = 'Required'
    }
    if (accountType === 'entity') {
      // Authorized representative must also be provided
      if (!form.authorizedRep.street1.trim()) newErrors['authorizedRep.street1'] = 'Required'
      if (!form.authorizedRep.city.trim()) newErrors['authorizedRep.city'] = 'Required'
      if (!form.authorizedRep.state.trim()) newErrors['authorizedRep.state'] = 'Required'
      if (!form.authorizedRep.zip.trim()) newErrors['authorizedRep.zip'] = 'Required'
      if (!form.authorizedRep.dob) newErrors['authorizedRep.dob'] = 'Required'
      if (!form.authorizedRep.ssn.trim()) newErrors['authorizedRep.ssn'] = 'Required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
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

      const userData = {
        ...(accountType === 'entity' ? { entity: {
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
        }} : {}),
        ...(accountType !== 'entity' ? {
          dob: form.dob,
          ssn: form.ssn,
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
        }} : {})
      }

      // Add joint holder data if account type is joint
      if (accountType === 'joint') {
        userData.jointHoldingType = form.jointHoldingType
        userData.jointHolder = {
          address: jointAddress,
          dob: form.jointHolder.dob,
          ssn: form.jointHolder.ssn,
          email: form.jointHolder.email,
          phone: form.jointHolder.phone
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
        const investmentFields = accountType === 'entity' ? {
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
        } : {
          personalInfo: { dob: form.dob, ssn: form.ssn },
          address: {
            street1: form.street1,
            street2: form.street2,
            city: form.city,
            state: form.state,
            zip: form.zip,
            country: form.country
          }
        }

        // Add joint holder data to investment if account type is joint
        if (accountType === 'joint') {
          investmentFields.jointHoldingType = form.jointHoldingType
          investmentFields.jointHolder = {
            address: jointAddress,
            dob: form.jointHolder.dob,
            ssn: form.jointHolder.ssn,
            email: form.jointHolder.email,
            phone: form.jointHolder.phone
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

      if (typeof onCompleted === 'function') onCompleted()
      router.push('/finalize-investment')
    } catch (e) {
      console.error('Failed saving address & identity', e)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className={styles.wrapper}>
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
              <label className={styles.label}>Street Address</label>
              <input className={`${styles.input} ${errors['authorizedRep.street1'] ? styles.inputError : ''}`} name="authorizedRep.street1" value={form.authorizedRep.street1} onChange={handleChange} placeholder="No PO Boxes" />
              {errors['authorizedRep.street1'] && <span className={styles.error}>{errors['authorizedRep.street1']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Apt or Unit</label>
              <input className={styles.input} name="authorizedRep.street2" value={form.authorizedRep.street2} onChange={handleChange} />
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>City</label>
              <input className={`${styles.input} ${errors['authorizedRep.city'] ? styles.inputError : ''}`} name="authorizedRep.city" value={form.authorizedRep.city} onChange={handleChange} />
              {errors['authorizedRep.city'] && <span className={styles.error}>{errors['authorizedRep.city']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>Zip Code</label>
              <input className={`${styles.input} ${errors['authorizedRep.zip'] ? styles.inputError : ''}`} name="authorizedRep.zip" value={form.authorizedRep.zip} onChange={handleChange} />
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
              <input className={`${styles.input} ${errors['authorizedRep.dob'] ? styles.inputError : ''}`} type="date" name="authorizedRep.dob" value={form.authorizedRep.dob} onChange={handleChange} />
              {errors['authorizedRep.dob'] && <span className={styles.error}>{errors['authorizedRep.dob']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>SSN</label>
              <input className={`${styles.input} ${errors['authorizedRep.ssn'] ? styles.inputError : ''}`} name="authorizedRep.ssn" value={form.authorizedRep.ssn} onChange={handleChange} placeholder="123-45-6789" />
              {errors['authorizedRep.ssn'] && <span className={styles.error}>{errors['authorizedRep.ssn']}</span>}
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
          <div className={styles.field}> 
            <label className={styles.label}>Entity Name</label>
            <input className={`${styles.input} ${errors.entityName ? styles.inputError : ''}`} name="entityName" value={form.entityName} onChange={handleChange} placeholder="Enter entity name" />
            {errors.entityName && <span className={styles.error}>{errors.entityName}</span>}
          </div>
        )}
        <div className={styles.field}> 
          <label className={styles.label}>Street Address</label>
          <input className={`${styles.input} ${errors.street1 ? styles.inputError : ''}`} name="street1" value={form.street1} onChange={handleChange} placeholder="No PO Boxes" />
          {errors.street1 && <span className={styles.error}>{errors.street1}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>Apt or Unit</label>
          <input className={styles.input} name="street2" value={form.street2} onChange={handleChange} />
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>City</label>
          <input className={`${styles.input} ${errors.city ? styles.inputError : ''}`} name="city" value={form.city} onChange={handleChange} />
          {errors.city && <span className={styles.error}>{errors.city}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>Zip Code</label>
          <input className={`${styles.input} ${errors.zip ? styles.inputError : ''}`} name="zip" value={form.zip} onChange={handleChange} />
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
          <input className={`${styles.input} ${errors.dob ? styles.inputError : ''}`} type="date" name="dob" value={form.dob} onChange={handleChange} />
          {errors.dob && <span className={styles.error}>{errors.dob}</span>}
        </div>
        <div className={styles.field}> 
          <label className={styles.label}>{idLabel}</label>
          <input className={`${styles.input} ${errors.ssn ? styles.inputError : ''}`} name="ssn" value={form.ssn} onChange={handleChange} placeholder={accountType === 'entity' ? 'Enter EIN or TIN' : '123-45-6789'} />
          {errors.ssn && <span className={styles.error}>{errors.ssn}</span>}
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
              <input className={`${styles.input} ${errors['jointHolder.dob'] ? styles.inputError : ''}`} type="date" name="jointHolder.dob" value={form.jointHolder.dob} onChange={handleChange} />
              {errors['jointHolder.dob'] && <span className={styles.error}>{errors['jointHolder.dob']}</span>}
            </div>
            <div className={styles.field}> 
              <label className={styles.label}>SSN (optional)</label>
              <input className={`${styles.input} ${errors['jointHolder.ssn'] ? styles.inputError : ''}`} name="jointHolder.ssn" value={form.jointHolder.ssn} onChange={handleChange} placeholder="123-45-6789" />
              {errors['jointHolder.ssn'] && <span className={styles.error}>{errors['jointHolder.ssn']}</span>}
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
                <input className={styles.input} name="jointHolder.street2" value={form.jointHolder.street2} onChange={handleChange} />
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>City</label>
                <input className={`${styles.input} ${errors['jointHolder.city'] ? styles.inputError : ''}`} name="jointHolder.city" value={form.jointHolder.city} onChange={handleChange} />
                {errors['jointHolder.city'] && <span className={styles.error}>{errors['jointHolder.city']}</span>}
              </div>
              <div className={styles.field}> 
                <label className={styles.label}>Zip Code</label>
                <input className={`${styles.input} ${errors['jointHolder.zip'] ? styles.inputError : ''}`} name="jointHolder.zip" value={form.jointHolder.zip} onChange={handleChange} />
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


