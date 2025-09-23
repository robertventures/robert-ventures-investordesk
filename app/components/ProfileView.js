'use client'
import { useEffect, useState } from 'react'
import styles from './ProfileView.module.css'

export default function ProfileView() {
  const [userData, setUserData] = useState(null)
  const [formData, setFormData] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const loadUser = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return

      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setUserData(data.user)
          setFormData({
            firstName: data.user.firstName || '',
            lastName: data.user.lastName || '',
            email: data.user.email || '',
            phoneNumber: data.user.phoneNumber || '',
            dob: data.user.dob || '',
            ssn: data.user.ssn || '',
            address: {
              street1: data.user.address?.street1 || '',
              street2: data.user.address?.street2 || '',
              city: data.user.address?.city || '',
              state: data.user.address?.state || '',
              zip: data.user.address?.zip || '',
              country: data.user.address?.country || 'United States'
            },
            entity: {
              name: data.user.entity?.name || '',
              registrationDate: data.user.entity?.registrationDate || '',
              taxId: data.user.entity?.taxId || '',
              address: {
                street1: data.user.entity?.address?.street1 || '',
                street2: data.user.entity?.address?.street2 || '',
                city: data.user.entity?.address?.city || '',
                state: data.user.entity?.address?.state || '',
                zip: data.user.entity?.address?.zip || '',
                country: data.user.entity?.address?.country || 'United States'
              }
            },
            authorizedRepresentative: {
              dob: data.user.authorizedRepresentative?.dob || '',
              ssn: data.user.authorizedRepresentative?.ssn || '',
              address: {
                street1: data.user.authorizedRepresentative?.address?.street1 || '',
                street2: data.user.authorizedRepresentative?.address?.street2 || '',
                city: data.user.authorizedRepresentative?.address?.city || '',
                state: data.user.authorizedRepresentative?.address?.state || '',
                zip: data.user.authorizedRepresentative?.address?.zip || '',
                country: data.user.authorizedRepresentative?.address?.country || 'United States'
              }
            }
          })
        }
      } catch (e) {
        console.error('Failed to load user data', e)
      }
    }
    loadUser()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleAddressChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, address: { ...prev.address, [name]: value } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleEntityChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, entity: { ...prev.entity, [name]: value } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleEntityAddressChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, entity: { ...prev.entity, address: { ...prev.entity.address, [name]: value } } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleAuthorizedRepChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, authorizedRepresentative: { ...prev.authorizedRepresentative, [name]: value } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleAuthorizedRepAddressChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, authorizedRepresentative: { ...prev.authorizedRepresentative, address: { ...prev.authorizedRepresentative.address, [name]: value } } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.firstName.trim()) newErrors.firstName = 'Required'
    if (!formData.lastName.trim()) newErrors.lastName = 'Required'
    if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email'
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Required'
    if (formData.address) {
      if (!formData.address.street1.trim()) newErrors.street1 = 'Required'
      if (!formData.address.city.trim()) newErrors.city = 'Required'
      if (!formData.address.state) newErrors.state = 'Required'
      if (!formData.address.zip.trim()) newErrors.zip = 'Required'
    }

    const hasEntityInvestment = Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'entity')
    const showEntity = hasEntityInvestment || !!userData?.entity
    if (showEntity && formData.entity) {
      if (!formData.entity.name.trim()) newErrors.entityName = 'Required'
      if (!formData.entity.registrationDate) newErrors.entityRegistrationDate = 'Required'
      if (!formData.entity.taxId.trim()) newErrors.entityTaxId = 'Required'
      if (formData.entity.address) {
        if (!formData.entity.address.street1.trim()) newErrors.entityStreet1 = 'Required'
        if (!formData.entity.address.city.trim()) newErrors.entityCity = 'Required'
        if (!formData.entity.address.state) newErrors.entityState = 'Required'
        if (!formData.entity.address.zip.trim()) newErrors.entityZip = 'Required'
      }
    }

    if (showEntity && formData.authorizedRepresentative) {
      if (!formData.authorizedRepresentative.dob) newErrors.repDob = 'Required'
      if (!formData.authorizedRepresentative.ssn.trim()) newErrors.repSsn = 'Required'
      if (formData.authorizedRepresentative.address) {
        if (!formData.authorizedRepresentative.address.street1.trim()) newErrors.repStreet1 = 'Required'
        if (!formData.authorizedRepresentative.address.city.trim()) newErrors.repCity = 'Required'
        if (!formData.authorizedRepresentative.address.state) newErrors.repState = 'Required'
        if (!formData.authorizedRepresentative.address.zip.trim()) newErrors.repZip = 'Required'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      const userId = localStorage.getItem('currentUserId')
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          phoneNumber: formData.phoneNumber,
          dob: formData.dob,
          ssn: formData.ssn,
          // We keep email read-only in UI but send it anyway for consistency
          email: formData.email,
          address: {
            street1: formData.address.street1,
            street2: formData.address.street2,
            city: formData.address.city,
            state: formData.address.state,
            zip: formData.address.zip,
            country: formData.address.country
          },
          ...(formData.entity && (Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'entity') || !!userData?.entity) ? {
            entity: {
              name: formData.entity.name,
              registrationDate: formData.entity.registrationDate,
              taxId: formData.entity.taxId,
              address: {
                street1: formData.entity.address.street1,
                street2: formData.entity.address.street2,
                city: formData.entity.address.city,
                state: formData.entity.address.state,
                zip: formData.entity.address.zip,
                country: formData.entity.address.country
              }
            }
          } : {}),
          ...(formData.authorizedRepresentative && (Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'entity') || !!userData?.entity) ? {
            authorizedRepresentative: {
              dob: formData.authorizedRepresentative.dob,
              ssn: formData.authorizedRepresentative.ssn,
              address: {
                street1: formData.authorizedRepresentative.address.street1,
                street2: formData.authorizedRepresentative.address.street2,
                city: formData.authorizedRepresentative.address.city,
                state: formData.authorizedRepresentative.address.state,
                zip: formData.authorizedRepresentative.address.zip,
                country: formData.authorizedRepresentative.address.country
              }
            }
          } : {})
        })
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUserData(data.user)
        setSaveSuccess(true)
      }
    } catch (e) {
      console.error('Failed to save profile', e)
    } finally {
      setIsSaving(false)
    }
  }

  if (!userData || !formData) {
    return <div className={styles.loading}>Loading profile...</div>
  }

  return (
    <div className={styles.profileContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile Information</h1>
        <p className={styles.subtitle}>Manage your account details and preferences</p>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Personal Details</h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label className={styles.label}>First Name</label>
              <input
                className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`}
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Enter first name"
              />
              {errors.firstName && <span className={styles.errorText}>{errors.firstName}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Last Name</label>
              <input
                className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`}
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Enter last name"
              />
              {errors.lastName && <span className={styles.errorText}>{errors.lastName}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Email Address</label>
              <input
                className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter email"
                disabled
              />
              {errors.email && <span className={styles.errorText}>{errors.email}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Phone Number</label>
              <input
                className={`${styles.input} ${errors.phoneNumber ? styles.inputError : ''}`}
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="Enter phone number"
              />
              {errors.phoneNumber && <span className={styles.errorText}>{errors.phoneNumber}</span>}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Date of Birth</label>
              <input
                className={styles.input}
                type="date"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Social Security Number</label>
              <input
                className={styles.input}
                type="text"
                name="ssn"
                value={formData.ssn}
                onChange={handleChange}
                placeholder="Enter SSN"
              />
            </div>
          </div>
        </div>

        {formData.address && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Address Information</h2>
            <div className={styles.fieldGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Street Address 1</label>
                <input
                  className={`${styles.input} ${errors.street1 ? styles.inputError : ''}`}
                  type="text"
                  name="street1"
                  value={formData.address.street1}
                  onChange={handleAddressChange}
                  placeholder="Street address line 1"
                />
                {errors.street1 && <span className={styles.errorText}>{errors.street1}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Street Address 2</label>
                <input
                  className={styles.input}
                  type="text"
                  name="street2"
                  value={formData.address.street2}
                  onChange={handleAddressChange}
                  placeholder="Street address line 2 (optional)"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>City</label>
                <input
                  className={`${styles.input} ${errors.city ? styles.inputError : ''}`}
                  type="text"
                  name="city"
                  value={formData.address.city}
                  onChange={handleAddressChange}
                  placeholder="City"
                />
                {errors.city && <span className={styles.errorText}>{errors.city}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>State</label>
                <input
                  className={`${styles.input} ${errors.state ? styles.inputError : ''}`}
                  type="text"
                  name="state"
                  value={formData.address.state}
                  onChange={handleAddressChange}
                  placeholder="State"
                />
                {errors.state && <span className={styles.errorText}>{errors.state}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>ZIP Code</label>
                <input
                  className={`${styles.input} ${errors.zip ? styles.inputError : ''}`}
                  type="text"
                  name="zip"
                  value={formData.address.zip}
                  onChange={handleAddressChange}
                  placeholder="ZIP Code"
                />
                {errors.zip && <span className={styles.errorText}>{errors.zip}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Country</label>
                <input
                  className={styles.input}
                  type="text"
                  name="country"
                  value={formData.address.country}
                  onChange={handleAddressChange}
                  disabled
                />
              </div>
            </div>
          </div>
        )}

        {((Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'entity')) || !!userData?.entity) && (
          <>
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Entity Information</h2>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Entity Name</label>
                  <input
                    className={`${styles.input} ${errors.entityName ? styles.inputError : ''}`}
                    type="text"
                    name="name"
                    value={formData.entity?.name || ''}
                    onChange={handleEntityChange}
                    placeholder="Enter entity name"
                  />
                  {errors.entityName && <span className={styles.errorText}>{errors.entityName}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Registration Date</label>
                  <input
                    className={`${styles.input} ${errors.entityRegistrationDate ? styles.inputError : ''}`}
                    type="date"
                    name="registrationDate"
                    value={formData.entity?.registrationDate || ''}
                    onChange={handleEntityChange}
                  />
                  {errors.entityRegistrationDate && <span className={styles.errorText}>{errors.entityRegistrationDate}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>EIN / Tax ID</label>
                  <input
                    className={`${styles.input} ${errors.entityTaxId ? styles.inputError : ''}`}
                    type="text"
                    name="taxId"
                    value={formData.entity?.taxId || ''}
                    onChange={handleEntityChange}
                    placeholder="Enter tax ID"
                  />
                  {errors.entityTaxId && <span className={styles.errorText}>{errors.entityTaxId}</span>}
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 1</label>
                  <input
                    className={`${styles.input} ${errors.entityStreet1 ? styles.inputError : ''}`}
                    type="text"
                    name="street1"
                    value={formData.entity?.address?.street1 || ''}
                    onChange={handleEntityAddressChange}
                    placeholder="Street address line 1"
                  />
                  {errors.entityStreet1 && <span className={styles.errorText}>{errors.entityStreet1}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 2</label>
                  <input
                    className={styles.input}
                    type="text"
                    name="street2"
                    value={formData.entity?.address?.street2 || ''}
                    onChange={handleEntityAddressChange}
                    placeholder="Street address line 2 (optional)"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>City</label>
                  <input
                    className={`${styles.input} ${errors.entityCity ? styles.inputError : ''}`}
                    type="text"
                    name="city"
                    value={formData.entity?.address?.city || ''}
                    onChange={handleEntityAddressChange}
                    placeholder="City"
                  />
                  {errors.entityCity && <span className={styles.errorText}>{errors.entityCity}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <input
                    className={`${styles.input} ${errors.entityState ? styles.inputError : ''}`}
                    type="text"
                    name="state"
                    value={formData.entity?.address?.state || ''}
                    onChange={handleEntityAddressChange}
                    placeholder="State"
                  />
                  {errors.entityState && <span className={styles.errorText}>{errors.entityState}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>ZIP Code</label>
                  <input
                    className={`${styles.input} ${errors.entityZip ? styles.inputError : ''}`}
                    type="text"
                    name="zip"
                    value={formData.entity?.address?.zip || ''}
                    onChange={handleEntityAddressChange}
                    placeholder="ZIP Code"
                  />
                  {errors.entityZip && <span className={styles.errorText}>{errors.entityZip}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Country</label>
                  <input
                    className={styles.input}
                    type="text"
                    name="country"
                    value={formData.entity?.address?.country || 'United States'}
                    onChange={handleEntityAddressChange}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Authorized Representative</h2>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Date of Birth</label>
                  <input
                    className={`${styles.input} ${errors.repDob ? styles.inputError : ''}`}
                    type="date"
                    name="dob"
                    value={formData.authorizedRepresentative?.dob || ''}
                    onChange={handleAuthorizedRepChange}
                  />
                  {errors.repDob && <span className={styles.errorText}>{errors.repDob}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>SSN</label>
                  <input
                    className={`${styles.input} ${errors.repSsn ? styles.inputError : ''}`}
                    type="text"
                    name="ssn"
                    value={formData.authorizedRepresentative?.ssn || ''}
                    onChange={handleAuthorizedRepChange}
                    placeholder="123-45-6789"
                  />
                  {errors.repSsn && <span className={styles.errorText}>{errors.repSsn}</span>}
                </div>
              </div>
              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 1</label>
                  <input
                    className={`${styles.input} ${errors.repStreet1 ? styles.inputError : ''}`}
                    type="text"
                    name="street1"
                    value={formData.authorizedRepresentative?.address?.street1 || ''}
                    onChange={handleAuthorizedRepAddressChange}
                    placeholder="Street address line 1"
                  />
                  {errors.repStreet1 && <span className={styles.errorText}>{errors.repStreet1}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 2</label>
                  <input
                    className={styles.input}
                    type="text"
                    name="street2"
                    value={formData.authorizedRepresentative?.address?.street2 || ''}
                    onChange={handleAuthorizedRepAddressChange}
                    placeholder="Street address line 2 (optional)"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>City</label>
                  <input
                    className={`${styles.input} ${errors.repCity ? styles.inputError : ''}`}
                    type="text"
                    name="city"
                    value={formData.authorizedRepresentative?.address?.city || ''}
                    onChange={handleAuthorizedRepAddressChange}
                    placeholder="City"
                  />
                  {errors.repCity && <span className={styles.errorText}>{errors.repCity}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <input
                    className={`${styles.input} ${errors.repState ? styles.inputError : ''}`}
                    type="text"
                    name="state"
                    value={formData.authorizedRepresentative?.address?.state || ''}
                    onChange={handleAuthorizedRepAddressChange}
                    placeholder="State"
                  />
                  {errors.repState && <span className={styles.errorText}>{errors.repState}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>ZIP Code</label>
                  <input
                    className={`${styles.input} ${errors.repZip ? styles.inputError : ''}`}
                    type="text"
                    name="zip"
                    value={formData.authorizedRepresentative?.address?.zip || ''}
                    onChange={handleAuthorizedRepAddressChange}
                    placeholder="ZIP Code"
                  />
                  {errors.repZip && <span className={styles.errorText}>{errors.repZip}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Country</label>
                  <input
                    className={styles.input}
                    type="text"
                    name="country"
                    value={formData.authorizedRepresentative?.address?.country || 'United States'}
                    onChange={handleAuthorizedRepAddressChange}
                    disabled
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Account Information</h2>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <label className={styles.label}>Account Created</label>
              <div className={styles.value}>
                {userData.createdAt ? new Date(userData.createdAt).toLocaleDateString() : 'Not available'}
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Total Investments</label>
              <div className={styles.value}>{userData.investments?.length || 0}</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Account Status</label>
              <div className={`${styles.value} ${styles.statusActive}`}>Active</div>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Last Login</label>
              <div className={styles.value}>Today</div>
            </div>
          </div>
          <div className={styles.actions}>
            <button 
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            {saveSuccess && (
              <span className={styles.success}>Saved!</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
