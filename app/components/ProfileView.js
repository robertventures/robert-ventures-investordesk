'use client'
import { useEffect, useMemo, useState } from 'react'
import styles from './ProfileView.module.css'

export default function ProfileView() {
  const MIN_DOB = '1900-01-01'
  const maxDob = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
    return cutoff.toISOString().split('T')[0]
  }, [])
  const maxToday = useMemo(() => {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }, [])

  const parseDateString = (value = '') => {
    const [year, month, day] = (value || '').split('-').map(Number)
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
            jointHolder: data.user.jointHolder ? {
              firstName: data.user.jointHolder.firstName || '',
              lastName: data.user.jointHolder.lastName || '',
              email: data.user.jointHolder.email || '',
              phone: data.user.jointHolder.phone || '',
              dob: data.user.jointHolder.dob || '',
              ssn: data.user.jointHolder.ssn || '',
              address: {
                street1: data.user.jointHolder.address?.street1 || '',
                street2: data.user.jointHolder.address?.street2 || '',
                city: data.user.jointHolder.address?.city || '',
                state: data.user.jointHolder.address?.state || '',
                zip: data.user.jointHolder.address?.zip || '',
                country: data.user.jointHolder.address?.country || 'United States'
              }
            } : {
              firstName: '',
              lastName: '',
              email: '',
              phone: '',
              dob: '',
              ssn: '',
              address: {
                street1: '',
                street2: '',
                city: '',
                state: '',
                zip: '',
                country: 'United States'
              }
            },
            jointHoldingType: data.user.jointHoldingType || '',
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

  const handleJointHolderChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, jointHolder: { ...prev.jointHolder, [name]: value } }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    setSaveSuccess(false)
  }

  const handleJointAddressChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, jointHolder: { ...prev.jointHolder, address: { ...prev.jointHolder.address, [name]: value } } }))
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
    if (formData.dob && !isAdultDob(formData.dob)) newErrors.dob = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
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
      if (!formData.authorizedRepresentative.dob || !isAdultDob(formData.authorizedRepresentative.dob)) newErrors.repDob = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
      if (!formData.authorizedRepresentative.ssn.trim()) newErrors.repSsn = 'Required'
      if (formData.authorizedRepresentative.address) {
        if (!formData.authorizedRepresentative.address.street1.trim()) newErrors.repStreet1 = 'Required'
        if (!formData.authorizedRepresentative.address.city.trim()) newErrors.repCity = 'Required'
        if (!formData.authorizedRepresentative.address.state) newErrors.repState = 'Required'
        if (!formData.authorizedRepresentative.address.zip.trim()) newErrors.repZip = 'Required'
      }
    }

    const hasJointInvestment = Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'joint')
    const showJoint = hasJointInvestment || !!userData?.jointHolder
    if (showJoint && formData.jointHolder) {
      if (!formData.jointHoldingType?.trim()) newErrors.jointHoldingType = 'Required'
      if (!formData.jointHolder.firstName.trim()) newErrors.jointFirstName = 'Required'
      if (!formData.jointHolder.lastName.trim()) newErrors.jointLastName = 'Required'
      if (!formData.jointHolder.email.trim() || !/\S+@\S+\.\S+/.test(formData.jointHolder.email)) newErrors.jointEmail = 'Valid email required'
      if (!formData.jointHolder.phone.trim()) newErrors.jointPhone = 'Required'
      if (!formData.jointHolder.dob || !isAdultDob(formData.jointHolder.dob)) newErrors.jointDob = `Enter a valid date (YYYY-MM-DD). Min ${MIN_DOB}. Must be 18+.`
      if (!formData.jointHolder.ssn.trim()) newErrors.jointSsn = 'Required'
      if (formData.jointHolder.address) {
        if (!formData.jointHolder.address.street1.trim()) newErrors.jointStreet1 = 'Required'
        if (!formData.jointHolder.address.city.trim()) newErrors.jointCity = 'Required'
        if (!formData.jointHolder.address.state) newErrors.jointState = 'Required'
        if (!formData.jointHolder.address.zip.trim()) newErrors.jointZip = 'Required'
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
          ...(Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'joint') || !!userData?.jointHolder ? {
            jointHoldingType: formData.jointHoldingType,
            jointHolder: {
              firstName: formData.jointHolder.firstName,
              lastName: formData.jointHolder.lastName,
              email: formData.jointHolder.email,
              phone: formData.jointHolder.phone,
              dob: formData.jointHolder.dob,
              ssn: formData.jointHolder.ssn,
              address: {
                street1: formData.jointHolder.address.street1,
                street2: formData.jointHolder.address.street2,
                city: formData.jointHolder.address.city,
                state: formData.jointHolder.address.state,
                zip: formData.jointHolder.address.zip,
                country: formData.jointHolder.address.country
              }
            }
          } : {}),
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

  const hasJointInvestment = Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'joint')
  const showJointSection = hasJointInvestment || !!userData?.jointHolder
  const hasEntityInvestment = Array.isArray(userData?.investments) && userData.investments.some(inv => inv.accountType === 'entity')
  const showEntitySection = hasEntityInvestment || !!userData?.entity

  return (
    <div className={styles.profileContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Profile Information</h1>
        <p className={styles.subtitle}>Manage your account details and preferences</p>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Primary Holder</h2>

          <div className={styles.subCard}>
            <h3 className={styles.subSectionTitle}>Personal Information</h3>
            <div className={styles.compactGrid}>
              <div className={styles.field}>
                <label className={styles.label}>First Name</label>
                <input className={`${styles.input} ${errors.firstName ? styles.inputError : ''}`} name="firstName" value={formData.firstName} onChange={handleChange} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Last Name</label>
                <input className={`${styles.input} ${errors.lastName ? styles.inputError : ''}`} name="lastName" value={formData.lastName} onChange={handleChange} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Date of Birth</label>
                <input className={`${styles.input} ${errors.dob ? styles.inputError : ''}`} type="date" name="dob" value={formData.dob} onChange={handleChange} min={MIN_DOB} max={maxDob} />
                {errors.dob && <span className={styles.errorText}>{errors.dob}</span>}
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Social Security Number</label>
                <input className={styles.input} name="ssn" value={formData.ssn} onChange={handleChange} placeholder="123-45-6789" />
              </div>
            </div>
          </div>

          <div className={styles.subCard}>
            <h3 className={styles.subSectionTitle}>Contact Information</h3>
            <div className={styles.compactGrid}>
              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input className={`${styles.input} ${errors.email ? styles.inputError : ''}`} name="email" value={formData.email} disabled />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phone</label>
                <input className={`${styles.input} ${errors.phoneNumber ? styles.inputError : ''}`} name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} />
              </div>
            </div>
          </div>

          {formData.address && (
            <div className={styles.subCard}>
              <h3 className={styles.subSectionTitle}>Legal Address</h3>
              <div className={styles.compactGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Street 1</label>
                  <input className={`${styles.input} ${errors.street1 ? styles.inputError : ''}`} name="street1" value={formData.address.street1} onChange={handleAddressChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Street 2</label>
                  <input className={styles.input} name="street2" value={formData.address.street2} onChange={handleAddressChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>City</label>
                  <input className={`${styles.input} ${errors.city ? styles.inputError : ''}`} name="city" value={formData.address.city} onChange={handleAddressChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <input className={`${styles.input} ${errors.state ? styles.inputError : ''}`} name="state" value={formData.address.state} onChange={handleAddressChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>ZIP Code</label>
                  <input className={`${styles.input} ${errors.zip ? styles.inputError : ''}`} name="zip" value={formData.address.zip} onChange={handleAddressChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Country</label>
                  <input className={styles.input} name="country" value={formData.address.country} disabled />
                </div>
              </div>
            </div>
          )}
        </section>

        {showJointSection && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Joint Holder</h2>

            <div className={styles.subCard}>
              <h3 className={styles.subSectionTitle}>Joint Details</h3>
              <div className={styles.compactGrid}>
                <div className={`${styles.field} ${styles.fullRow}`}>
                  <label className={styles.label}>Joint Holder Relationship</label>
                  <select
                    className={`${styles.input} ${errors.jointHoldingType ? styles.inputError : ''}`}
                    name="jointHoldingType"
                    value={formData.jointHoldingType || ''}
                    onChange={handleChange}
                  >
                    <option value="">Select relationship to primary holder</option>
                    <option value="spouse">Spouse</option>
                    <option value="sibling">Sibling</option>
                    <option value="domestic_partner">Domestic Partner</option>
                    <option value="business_partner">Business Partner</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>First Name</label>
                  <input className={`${styles.input} ${errors.jointFirstName ? styles.inputError : ''}`} name="firstName" value={formData.jointHolder?.firstName || ''} onChange={handleJointHolderChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Last Name</label>
                  <input className={`${styles.input} ${errors.jointLastName ? styles.inputError : ''}`} name="lastName" value={formData.jointHolder?.lastName || ''} onChange={handleJointHolderChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input className={`${styles.input} ${errors.jointEmail ? styles.inputError : ''}`} name="email" value={formData.jointHolder?.email || ''} onChange={handleJointHolderChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone</label>
                  <input className={`${styles.input} ${errors.jointPhone ? styles.inputError : ''}`} name="phone" value={formData.jointHolder?.phone || ''} onChange={handleJointHolderChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date of Birth</label>
                  <input className={`${styles.input} ${errors.jointDob ? styles.inputError : ''}`} type="date" name="dob" value={formData.jointHolder?.dob || ''} onChange={handleJointHolderChange} min={MIN_DOB} max={maxDob} />
                  {errors.jointDob && <span className={styles.errorText}>{errors.jointDob}</span>}
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>SSN</label>
                  <input className={`${styles.input} ${errors.jointSsn ? styles.inputError : ''}`} name="ssn" value={formData.jointHolder?.ssn || ''} onChange={handleJointHolderChange} />
                </div>
              </div>
            </div>

            <div className={styles.subCard}>
              <h3 className={styles.subSectionTitle}>Legal Address</h3>
              <div className={styles.compactGrid}>
                <div className={styles.field}><label className={styles.label}>Street 1</label><input className={`${styles.input} ${errors.jointStreet1 ? styles.inputError : ''}`} name="street1" value={formData.jointHolder?.address?.street1 || ''} onChange={handleJointAddressChange} /></div>
                <div className={styles.field}><label className={styles.label}>Street 2</label><input className={styles.input} name="street2" value={formData.jointHolder?.address?.street2 || ''} onChange={handleJointAddressChange} /></div>
                <div className={styles.field}><label className={styles.label}>City</label><input className={`${styles.input} ${errors.jointCity ? styles.inputError : ''}`} name="city" value={formData.jointHolder?.address?.city || ''} onChange={handleJointAddressChange} /></div>
                <div className={styles.field}><label className={styles.label}>State</label><input className={`${styles.input} ${errors.jointState ? styles.inputError : ''}`} name="state" value={formData.jointHolder?.address?.state || ''} onChange={handleJointAddressChange} /></div>
                <div className={styles.field}><label className={styles.label}>ZIP Code</label><input className={`${styles.input} ${errors.jointZip ? styles.inputError : ''}`} name="zip" value={formData.jointHolder?.address?.zip || ''} onChange={handleJointAddressChange} /></div>
                <div className={styles.field}><label className={styles.label}>Country</label><input className={styles.input} name="country" value={formData.jointHolder?.address?.country || 'United States'} disabled /></div>
              </div>
            </div>
          </section>
        )}

        {showEntitySection && (
          <>
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Entity Information</h2>
              <div className={styles.compactGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Entity Name</label>
                  <input
                    className={`${styles.input} ${errors.entityName ? styles.inputError : ''}`}
                    type="text"
                    name="name"
                    value={formData.entity?.name || ''}
                    onChange={handleEntityChange}
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
                    min={MIN_DOB}
                    max={maxToday}
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
                  />
                  {errors.entityTaxId && <span className={styles.errorText}>{errors.entityTaxId}</span>}
                </div>
              </div>
              <div className={styles.compactGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 1</label>
                  <input
                    className={`${styles.input} ${errors.entityStreet1 ? styles.inputError : ''}`}
                    type="text"
                    name="street1"
                    value={formData.entity?.address?.street1 || ''}
                    onChange={handleEntityAddressChange}
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
            </section>

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Authorized Representative</h2>
              <div className={styles.compactGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Date of Birth</label>
                  <input
                    className={`${styles.input} ${errors.repDob ? styles.inputError : ''}`}
                    type="date"
                    name="dob"
                    value={formData.authorizedRepresentative?.dob || ''}
                    onChange={handleAuthorizedRepChange}
                    min={MIN_DOB}
                    max={maxDob}
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
                  />
                  {errors.repSsn && <span className={styles.errorText}>{errors.repSsn}</span>}
                </div>
              </div>
              <div className={styles.compactGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Street Address 1</label>
                  <input
                    className={`${styles.input} ${errors.repStreet1 ? styles.inputError : ''}`}
                    type="text"
                    name="street1"
                    value={formData.authorizedRepresentative?.address?.street1 || ''}
                    onChange={handleAuthorizedRepAddressChange}
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
            </section>
          </>
        )}

        <section className={styles.section}>
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
            {saveSuccess && <span className={styles.success}>Saved!</span>}
          </div>
        </section>
      </div>
    </div>
  )
}
