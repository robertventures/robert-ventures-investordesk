'use client'

import { useState } from 'react'
import styles from './ImportInvestorsTab.module.css'

const IMPORT_STAGES = {
  ADD: 'add',
  REVIEW: 'review',
  IMPORTING: 'importing',
  COMPLETE: 'complete'
}

// Phone formatting and validation
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
  return value
}

// Names: Allow only letters, spaces, hyphens, apostrophes, and periods
const formatName = (value = '') => value.replace(/[^a-zA-Z\s'\-\.]/g, '')

export default function ImportInvestorsTab({ currentUser, onImportComplete }) {
  const [stage, setStage] = useState(IMPORT_STAGES.ADD)
  const [editableData, setEditableData] = useState([])
  const [importResults, setImportResults] = useState(null)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  // Manual form state
  const [manualForm, setManualForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dob: '',
    accountType: 'individual',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: ''
    },
    // Joint account fields
    jointHoldingType: '',
    jointHolder: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      dob: '',
      address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      }
    },
    // Entity fields
    entity: {
      entityType: 'LLC',
      name: '',
      registrationDate: '',
      taxId: '',
      address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      }
    },
    authorizedRepresentative: {
      firstName: '',
      lastName: '',
      dob: '',
      address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      }
    },
    // IRA fields
    ira: {
      accountType: 'traditional',
      custodian: '',
      accountNumber: ''
    },
    investments: []
  })

  // Current investment being added
  const [currentInvestment, setCurrentInvestment] = useState({
    amount: '',
    paymentFrequency: 'compounding',
    lockupPeriod: '1-year',
    createdDate: '',
    confirmedDate: '',
    status: 'active'
  })


  // Handle data editing in review stage
  const handleDataEdit = (rowId, field, value) => {
    setEditableData(prev => prev.map(row => {
      if (row._rowId !== rowId) return row
      
      // Handle nested fields
      if (field.includes('.')) {
        const [parent, child] = field.split('.')
        return {
          ...row,
          [parent]: {
            ...row[parent],
            [child]: value
          }
        }
      }
      
      return {
        ...row,
        [field]: value
      }
    }))
  }

  // Remove row from import
  const handleRemoveRow = (rowId) => {
    setEditableData(prev => prev.filter(row => row._rowId !== rowId))
  }

  // Import investors
  const handleImport = async () => {
    setIsProcessing(true)
    setError(null)
    setStage(IMPORT_STAGES.IMPORTING)

    try {
      // Prepare data for import
      const investors = editableData.map(row => {
        const investor = { ...row }
        delete investor._rowId
        
        // Process investments array
        if (investor.investments && Array.isArray(investor.investments)) {
          investor.investments = investor.investments.map(inv => ({
            amount: parseFloat(inv.amount) || 0,
            paymentFrequency: inv.paymentFrequency || 'compounding',
            lockupPeriod: inv.lockupPeriod || '1-year',
            createdDate: inv.createdDate || new Date().toISOString(),
            confirmedDate: inv.confirmedDate || inv.createdDate || new Date().toISOString(),
            status: inv.status || 'active'
          })).filter(inv => inv.amount > 0) // Only include investments with amount
        }
        
        return investor
      })

      // Call import API
      const response = await fetch('/api/admin/import-investors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: currentUser.id,
          investors
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Import failed')
      }

      setImportResults(result)
      setStage(IMPORT_STAGES.COMPLETE)
      
      if (onImportComplete) {
        onImportComplete(result)
      }

    } catch (error) {
      console.error('Import error:', error)
      setError(error.message)
      setStage(IMPORT_STAGES.REVIEW)
    } finally {
      setIsProcessing(false)
    }
  }

  // Send welcome emails
  const handleSendWelcomeEmails = async () => {
    if (!importResults?.importedUserIds?.length) return

    setIsProcessing(true)
    try {
      const response = await fetch('/api/auth/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: currentUser.id,
          userIds: importResults.importedUserIds
        })
      })

      const result = await response.json()

      if (result.success) {
        alert(`Emails sent: ${result.totalSent} successful, ${result.totalFailed} failed`)
      } else {
        alert(`Failed to send emails: ${result.error}`)
      }
    } catch (error) {
      console.error('Error sending emails:', error)
      alert(`Error sending emails: ${error.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle manual form field changes
  const handleManualFormChange = (field, value) => {
    // Apply formatting based on field type
    let formattedValue = value
    
    if (field === 'phoneNumber' || field.endsWith('.phoneNumber')) {
      formattedValue = formatPhone(value)
    } else if (field === 'firstName' || field === 'lastName' || 
               field.endsWith('.firstName') || field.endsWith('.lastName')) {
      formattedValue = formatName(value)
    }
    
    // Handle nested fields (e.g., address.street1, jointHolder.firstName, entity.name)
    if (field.includes('.')) {
      const parts = field.split('.')
      
      if (parts.length === 2) {
        const [parent, child] = parts
        setManualForm(prev => ({
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: formattedValue
          }
        }))
      } else if (parts.length === 3) {
        // Three levels deep (e.g., jointHolder.address.street1)
        const [grandparent, parent, child] = parts
        setManualForm(prev => ({
          ...prev,
          [grandparent]: {
            ...prev[grandparent],
            [parent]: {
              ...prev[grandparent][parent],
              [child]: formattedValue
            }
          }
        }))
      }
    } else {
      setManualForm(prev => ({
        ...prev,
        [field]: formattedValue
      }))
    }
  }

  // Handle current investment field changes
  const handleInvestmentChange = (field, value) => {
    setCurrentInvestment(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Add investment to list
  const handleAddInvestment = () => {
    if (!currentInvestment.amount) {
      setError('Investment amount is required')
      return
    }

    const newInvestment = {
      ...currentInvestment,
      id: `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    setManualForm(prev => ({
      ...prev,
      investments: [...prev.investments, newInvestment]
    }))

    // Reset current investment form
    setCurrentInvestment({
      amount: '',
      paymentFrequency: 'compounding',
      lockupPeriod: '1-year',
      createdDate: '',
      confirmedDate: '',
      status: 'active'
    })

    setError(null)
  }

  // Remove investment from list
  const handleRemoveInvestment = (investmentId) => {
    setManualForm(prev => ({
      ...prev,
      investments: prev.investments.filter(inv => inv.id !== investmentId)
    }))
  }

  // Add manual form data to review
  const handleAddManualInvestor = () => {
    // Validate required fields
    if (!manualForm.email || !manualForm.firstName || !manualForm.lastName) {
      setError('Email, First Name, and Last Name are required')
      return
    }

    // Validate email format
    if (!/\S+@\S+\.\S+/.test(manualForm.email)) {
      setError('Please enter a valid email address')
      return
    }

    // Validate phone number if provided
    if (manualForm.phoneNumber && !isCompletePhone(manualForm.phoneNumber)) {
      setError('Phone number must be 10 digits')
      return
    }

    // Validate account-type-specific required fields
    if (manualForm.accountType === 'joint') {
      if (!manualForm.jointHoldingType) {
        setError('Joint holding type is required for joint accounts')
        return
      }
      if (!manualForm.jointHolder.firstName || !manualForm.jointHolder.lastName) {
        setError('Joint holder first name and last name are required')
        return
      }
      if (!manualForm.jointHolder.email) {
        setError('Joint holder email is required')
        return
      }
      if (manualForm.jointHolder.phoneNumber && !isCompletePhone(manualForm.jointHolder.phoneNumber)) {
        setError('Joint holder phone number must be 10 digits')
        return
      }
    }

    if (manualForm.accountType === 'entity') {
      if (!manualForm.entity.name) {
        setError('Entity name is required for entity accounts')
        return
      }
      if (!manualForm.entity.taxId) {
        setError('Entity Tax ID/EIN is required')
        return
      }
      if (!manualForm.authorizedRepresentative.firstName || !manualForm.authorizedRepresentative.lastName) {
        setError('Authorized representative name is required')
        return
      }
    }

    if (manualForm.accountType === 'ira') {
      if (!manualForm.ira.custodian) {
        setError('IRA custodian is required')
        return
      }
      if (!manualForm.ira.accountNumber) {
        setError('IRA account number is required')
        return
      }
    }

    // Normalize phone numbers before adding
    const newInvestor = {
      ...manualForm,
      phoneNumber: manualForm.phoneNumber ? normalizePhoneForDB(manualForm.phoneNumber) : '',
      _rowId: editableData.length
    }

    // Normalize joint holder phone if applicable
    if (newInvestor.accountType === 'joint' && newInvestor.jointHolder.phoneNumber) {
      newInvestor.jointHolder.phoneNumber = normalizePhoneForDB(newInvestor.jointHolder.phoneNumber)
    }
    
    setEditableData(prev => [...prev, newInvestor])
    
    // Reset form
    setManualForm({
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      dob: '',
      accountType: 'individual',
      address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      },
      jointHoldingType: '',
      jointHolder: {
        firstName: '',
        lastName: '',
        email: '',
        phoneNumber: '',
        dob: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          zip: ''
        }
      },
      entity: {
        entityType: 'LLC',
        name: '',
        registrationDate: '',
        taxId: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          zip: ''
        }
      },
      authorizedRepresentative: {
        firstName: '',
        lastName: '',
        dob: '',
        address: {
          street1: '',
          street2: '',
          city: '',
          state: '',
          zip: ''
        }
      },
      ira: {
        accountType: 'traditional',
        custodian: '',
        accountNumber: ''
      },
      investments: []
    })

    setCurrentInvestment({
      amount: '',
      paymentFrequency: 'compounding',
      lockupPeriod: '1-year',
      createdDate: '',
      confirmedDate: '',
      status: 'active'
    })
    
    setError(null)
    setShowForm(false)
    setStage(IMPORT_STAGES.REVIEW)
  }

  // Reset to start
  const handleReset = () => {
    setStage(IMPORT_STAGES.ADD)
    setEditableData([])
    setImportResults(null)
    setError(null)
  }

  return (
    <div className={styles.container}>
      {/* Stage Indicator */}
      <div className={styles.stageIndicator}>
        <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.ADD ? styles.active : ''}`}>
          1. Add Investor
        </div>
        <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.REVIEW ? styles.active : ''}`}>
          2. Review & Edit
        </div>
        <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.IMPORTING || stage === IMPORT_STAGES.COMPLETE ? styles.active : ''}`}>
          3. Import
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className={styles.error}>
          ❌ {error}
        </div>
      )}

      {/* Stage: Add Investor */}
      {stage === IMPORT_STAGES.ADD && (
        <div className={styles.stage}>
          <h3>Add Investors from Wealthblock</h3>
          <p>Manually add investors from your Wealthblock export. You can add multiple investors before importing.</p>
          
          {!showForm && (
            <div className={styles.addButtonContainer}>
              <button onClick={() => setShowForm(true)} className={styles.addNewInvestorButton}>
                + Add New Investor
              </button>
              {editableData.length > 0 && (
                <p className={styles.addedCount}>
                  {editableData.length} investor{editableData.length !== 1 ? 's' : ''} added
                </p>
              )}
            </div>
          )}

          {showForm && (
          <div className={styles.manualForm}>
            {/* User Information Section */}
            <div className={styles.formSection}>
              <h4>User Information</h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Email *</label>
                  <input
                    type="email"
                    value={manualForm.email}
                    onChange={(e) => handleManualFormChange('email', e.target.value)}
                    placeholder="investor@example.com"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Account Type *</label>
                  <select
                    value={manualForm.accountType}
                    onChange={(e) => handleManualFormChange('accountType', e.target.value)}
                  >
                    <option value="individual">Individual</option>
                    <option value="joint">Joint</option>
                    <option value="entity">Entity</option>
                    <option value="ira">IRA</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={manualForm.firstName}
                    onChange={(e) => handleManualFormChange('firstName', e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={manualForm.lastName}
                    onChange={(e) => handleManualFormChange('lastName', e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    value={manualForm.phoneNumber}
                    onChange={(e) => handleManualFormChange('phoneNumber', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                  {manualForm.phoneNumber && !isCompletePhone(manualForm.phoneNumber) && (
                    <span className={styles.fieldHint}>Enter 10 digits</span>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={manualForm.dob}
                    onChange={(e) => handleManualFormChange('dob', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className={styles.formSection}>
              <h4>Address</h4>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Street Address 1</label>
                  <input
                    type="text"
                    value={manualForm.address.street1}
                    onChange={(e) => handleManualFormChange('address.street1', e.target.value)}
                    placeholder="123 Main St"
                  />
                </div>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label>Street Address 2</label>
                  <input
                    type="text"
                    value={manualForm.address.street2}
                    onChange={(e) => handleManualFormChange('address.street2', e.target.value)}
                    placeholder="Apt 4B"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>City</label>
                  <input
                    type="text"
                    value={manualForm.address.city}
                    onChange={(e) => handleManualFormChange('address.city', e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>State</label>
                  <input
                    type="text"
                    value={manualForm.address.state}
                    onChange={(e) => handleManualFormChange('address.state', e.target.value)}
                    placeholder="California"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>ZIP Code</label>
                  <input
                    type="text"
                    value={manualForm.address.zip}
                    onChange={(e) => handleManualFormChange('address.zip', e.target.value)}
                    placeholder="94102"
                  />
                </div>
              </div>
            </div>

            {/* Joint Account Fields */}
            {manualForm.accountType === 'joint' && (
              <>
                <div className={styles.formSection}>
                  <h4>Joint Account Details</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Joint Holding Type *</label>
                      <select
                        value={manualForm.jointHoldingType}
                        onChange={(e) => handleManualFormChange('jointHoldingType', e.target.value)}
                        required
                      >
                        <option value="">Select holding type</option>
                        <option value="joint-tenants">Joint Tenants with Right of Survivorship</option>
                        <option value="tenants-common">Tenants in Common</option>
                        <option value="community-property">Community Property</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h4>Joint Holder Information</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.firstName}
                        onChange={(e) => handleManualFormChange('jointHolder.firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Last Name *</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.lastName}
                        onChange={(e) => handleManualFormChange('jointHolder.lastName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Email *</label>
                      <input
                        type="email"
                        value={manualForm.jointHolder.email}
                        onChange={(e) => handleManualFormChange('jointHolder.email', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        value={manualForm.jointHolder.phoneNumber}
                        onChange={(e) => handleManualFormChange('jointHolder.phoneNumber', e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                      {manualForm.jointHolder.phoneNumber && !isCompletePhone(manualForm.jointHolder.phoneNumber) && (
                        <span className={styles.fieldHint}>Enter 10 digits</span>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={manualForm.jointHolder.dob}
                        onChange={(e) => handleManualFormChange('jointHolder.dob', e.target.value)}
                      />
                    </div>
                  </div>

                  <h5 className={styles.subheading}>Joint Holder Address</h5>
                  <div className={styles.formGrid}>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 1</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.address.street1}
                        onChange={(e) => handleManualFormChange('jointHolder.address.street1', e.target.value)}
                      />
                    </div>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 2</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.address.street2}
                        onChange={(e) => handleManualFormChange('jointHolder.address.street2', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>City</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.address.city}
                        onChange={(e) => handleManualFormChange('jointHolder.address.city', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>State</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.address.state}
                        onChange={(e) => handleManualFormChange('jointHolder.address.state', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>ZIP Code</label>
                      <input
                        type="text"
                        value={manualForm.jointHolder.address.zip}
                        onChange={(e) => handleManualFormChange('jointHolder.address.zip', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Entity Account Fields */}
            {manualForm.accountType === 'entity' && (
              <>
                <div className={styles.formSection}>
                  <h4>Entity Information</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Entity Type *</label>
                      <select
                        value={manualForm.entity.entityType}
                        onChange={(e) => handleManualFormChange('entity.entityType', e.target.value)}
                        required
                      >
                        <option value="LLC">LLC</option>
                        <option value="Corporation">Corporation</option>
                        <option value="Partnership">Partnership</option>
                        <option value="Trust">Trust</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>Entity Name *</label>
                      <input
                        type="text"
                        value={manualForm.entity.name}
                        onChange={(e) => handleManualFormChange('entity.name', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Tax ID / EIN *</label>
                      <input
                        type="text"
                        value={manualForm.entity.taxId}
                        onChange={(e) => handleManualFormChange('entity.taxId', e.target.value)}
                        placeholder="12-3456789"
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Registration Date</label>
                      <input
                        type="date"
                        value={manualForm.entity.registrationDate}
                        onChange={(e) => handleManualFormChange('entity.registrationDate', e.target.value)}
                      />
                    </div>
                  </div>

                  <h5 className={styles.subheading}>Entity Address</h5>
                  <div className={styles.formGrid}>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 1</label>
                      <input
                        type="text"
                        value={manualForm.entity.address.street1}
                        onChange={(e) => handleManualFormChange('entity.address.street1', e.target.value)}
                      />
                    </div>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 2</label>
                      <input
                        type="text"
                        value={manualForm.entity.address.street2}
                        onChange={(e) => handleManualFormChange('entity.address.street2', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>City</label>
                      <input
                        type="text"
                        value={manualForm.entity.address.city}
                        onChange={(e) => handleManualFormChange('entity.address.city', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>State</label>
                      <input
                        type="text"
                        value={manualForm.entity.address.state}
                        onChange={(e) => handleManualFormChange('entity.address.state', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>ZIP Code</label>
                      <input
                        type="text"
                        value={manualForm.entity.address.zip}
                        onChange={(e) => handleManualFormChange('entity.address.zip', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h4>Authorized Representative</h4>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.firstName}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Last Name *</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.lastName}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.lastName', e.target.value)}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={manualForm.authorizedRepresentative.dob}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.dob', e.target.value)}
                      />
                    </div>
                  </div>

                  <h5 className={styles.subheading}>Representative Address</h5>
                  <div className={styles.formGrid}>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 1</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.address.street1}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.address.street1', e.target.value)}
                      />
                    </div>
                    <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                      <label>Street Address 2</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.address.street2}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.address.street2', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>City</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.address.city}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.address.city', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>State</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.address.state}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.address.state', e.target.value)}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>ZIP Code</label>
                      <input
                        type="text"
                        value={manualForm.authorizedRepresentative.address.zip}
                        onChange={(e) => handleManualFormChange('authorizedRepresentative.address.zip', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* IRA Account Fields */}
            {manualForm.accountType === 'ira' && (
              <div className={styles.formSection}>
                <h4>IRA Account Information</h4>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>IRA Type *</label>
                    <select
                      value={manualForm.ira.accountType}
                      onChange={(e) => handleManualFormChange('ira.accountType', e.target.value)}
                      required
                    >
                      <option value="traditional">Traditional IRA</option>
                      <option value="roth">Roth IRA</option>
                      <option value="sep">SEP IRA</option>
                      <option value="simple">SIMPLE IRA</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Custodian *</label>
                    <input
                      type="text"
                      value={manualForm.ira.custodian}
                      onChange={(e) => handleManualFormChange('ira.custodian', e.target.value)}
                      placeholder="e.g., Fidelity, Charles Schwab"
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>IRA Account Number *</label>
                    <input
                      type="text"
                      value={manualForm.ira.accountNumber}
                      onChange={(e) => handleManualFormChange('ira.accountNumber', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Investment Section */}
            <div className={styles.formSection}>
              <h4>Investment Details (Optional)</h4>
              <p className={styles.sectionNote}>
                Add investments for this investor. You can add multiple investments.
              </p>
              
              {/* Add Investment Form */}
              <div className={styles.investmentForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Investment Amount</label>
                    <input
                      type="number"
                      value={currentInvestment.amount}
                      onChange={(e) => handleInvestmentChange('amount', e.target.value)}
                      placeholder="50000"
                      min="0"
                      step="1000"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Payment Frequency</label>
                    <select
                      value={currentInvestment.paymentFrequency}
                      onChange={(e) => handleInvestmentChange('paymentFrequency', e.target.value)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="compounding">Compounding</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Lockup Period</label>
                    <select
                      value={currentInvestment.lockupPeriod}
                      onChange={(e) => handleInvestmentChange('lockupPeriod', e.target.value)}
                    >
                      <option value="1-year">1 Year</option>
                      <option value="3-year">3 Years</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Investment Created Date</label>
                    <input
                      type="date"
                      value={currentInvestment.createdDate}
                      onChange={(e) => handleInvestmentChange('createdDate', e.target.value)}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Investment Confirmed Date</label>
                    <input
                      type="date"
                      value={currentInvestment.confirmedDate}
                      onChange={(e) => handleInvestmentChange('confirmedDate', e.target.value)}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleAddInvestment} 
                  className={styles.addInvestmentButton}
                >
                  + Add Investment
                </button>
              </div>

              {/* Display Added Investments */}
              {manualForm.investments.length > 0 && (
                <div className={styles.investmentsList}>
                  <h5>Added Investments ({manualForm.investments.length})</h5>
                  <div className={styles.investmentItems}>
                    {manualForm.investments.map(inv => (
                      <div key={inv.id} className={styles.investmentItem}>
                        <div className={styles.investmentInfo}>
                          <span className={styles.investmentAmount}>${parseFloat(inv.amount).toLocaleString()}</span>
                          <span className={styles.investmentDetails}>
                            {inv.paymentFrequency} • {inv.lockupPeriod}
                          </span>
                          {inv.createdDate && (
                            <span className={styles.investmentDate}>
                              Created: {new Date(inv.createdDate).toLocaleDateString()}
                            </span>
                          )}
                          {inv.confirmedDate && (
                            <span className={styles.investmentDate}>
                              Confirmed: {new Date(inv.confirmedDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveInvestment(inv.id)}
                          className={styles.investmentRemove}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.investmentTotal}>
                    Total Investment Amount: ${manualForm.investments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className={styles.actions}>
            <button 
              onClick={() => {
                setShowForm(false)
                setError(null)
              }} 
              className={styles.secondaryButton}
              type="button"
            >
              Cancel
            </button>
            {editableData.length > 0 && (
              <button 
                onClick={() => {
                  setShowForm(false)
                  setStage(IMPORT_STAGES.REVIEW)
                }} 
                className={styles.secondaryButton}
                type="button"
              >
                Go to Review ({editableData.length})
              </button>
            )}
            <button onClick={handleAddManualInvestor} className={styles.primaryButton} type="button">
              Add to Review List
              {manualForm.investments.length > 0 && (
                <span className={styles.investmentBadge}>
                  {manualForm.investments.length} investment{manualForm.investments.length !== 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Show button to go to review if there are investors added */}
      {!showForm && editableData.length > 0 && stage === IMPORT_STAGES.ADD && (
        <div className={styles.actions}>
          <button onClick={() => setStage(IMPORT_STAGES.REVIEW)} className={styles.primaryButton}>
            Continue to Review ({editableData.length} investor{editableData.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      {/* Stage: Review */}
      {stage === IMPORT_STAGES.REVIEW && (
        <div className={styles.stage}>
          <h3>Review & Edit Data</h3>
          <p>Review the mapped data and make any necessary edits before importing.</p>
          <p className={styles.recordCount}>
            <strong>{editableData.length}</strong> investors ready to import
          </p>

          {/* Summary Cards */}
          <div className={styles.reviewSummary}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Investors</div>
              <div className={styles.summaryValue}>{editableData.length}</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>With Investments</div>
              <div className={styles.summaryValue}>
                {editableData.filter(row => row.investments?.length > 0).length}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Investments</div>
              <div className={styles.summaryValue}>
                {editableData.reduce((sum, row) => sum + (row.investments?.length || 0), 0)}
              </div>
            </div>
          </div>

          {/* Detailed Review - Expandable Cards */}
          <div className={styles.reviewCards}>
            {editableData.map(row => (
              <div key={row._rowId} className={styles.investorCard}>
                <div className={styles.investorCardHeader}>
                  <div className={styles.investorCardTitle}>
                    <h4>{row.firstName} {row.lastName}</h4>
                    <span className={styles.investorEmail}>{row.email}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveRow(row._rowId)}
                    className={styles.cardRemoveButton}
                  >
                    Remove
                  </button>
                </div>

                <div className={styles.investorCardBody}>
                  {/* Basic Info */}
                  <div className={styles.cardSection}>
                    <h5>Basic Information</h5>
                    <div className={styles.cardGrid}>
                      <div className={styles.cardField}>
                        <label>Email</label>
                        <input
                          type="email"
                          value={row.email || ''}
                          onChange={(e) => handleDataEdit(row._rowId, 'email', e.target.value)}
                          className={styles.editInput}
                        />
                      </div>
                      <div className={styles.cardField}>
                        <label>Account Type</label>
                        <select
                          value={row.accountType || 'individual'}
                          onChange={(e) => handleDataEdit(row._rowId, 'accountType', e.target.value)}
                          className={styles.editSelect}
                        >
                          <option value="individual">Individual</option>
                          <option value="joint">Joint</option>
                          <option value="entity">Entity</option>
                          <option value="ira">IRA</option>
                        </select>
                      </div>
                      <div className={styles.cardField}>
                        <label>First Name</label>
                        <input
                          type="text"
                          value={row.firstName || ''}
                          onChange={(e) => handleDataEdit(row._rowId, 'firstName', e.target.value)}
                          className={styles.editInput}
                        />
                      </div>
                      <div className={styles.cardField}>
                        <label>Last Name</label>
                        <input
                          type="text"
                          value={row.lastName || ''}
                          onChange={(e) => handleDataEdit(row._rowId, 'lastName', e.target.value)}
                          className={styles.editInput}
                        />
                      </div>
                      <div className={styles.cardField}>
                        <label>Phone</label>
                        <input
                          type="text"
                          value={row.phoneNumber || ''}
                          onChange={(e) => handleDataEdit(row._rowId, 'phoneNumber', e.target.value)}
                          className={styles.editInput}
                        />
                      </div>
                      <div className={styles.cardField}>
                        <label>DOB</label>
                        <input
                          type="date"
                          value={row.dob || ''}
                          onChange={(e) => handleDataEdit(row._rowId, 'dob', e.target.value)}
                          className={styles.editInput}
                        />
                      </div>
                    </div>
                    <div className={styles.note}>
                      ℹ️ <strong>Note:</strong> SSN will be requested when investor sets up their account
                    </div>
                  </div>

                  {/* Address */}
                  {row.address && Object.values(row.address).some(v => v) && (
                    <div className={styles.cardSection}>
                      <h5>Address</h5>
                      <div className={styles.addressDisplay}>
                        {row.address.street1 && <div>{row.address.street1}</div>}
                        {row.address.street2 && <div>{row.address.street2}</div>}
                        {(row.address.city || row.address.state || row.address.zip) && (
                          <div>
                            {row.address.city}{row.address.city && row.address.state && ', '}
                            {row.address.state} {row.address.zip}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Investments */}
                  {row.investments && row.investments.length > 0 && (
                    <div className={styles.cardSection}>
                      <h5>Investments ({row.investments.length})</h5>
                      {row.investments.map((inv, idx) => (
                        <div key={idx} className={styles.investmentDisplay}>
                          <div className={styles.investmentAmount}>
                            ${parseFloat(inv.amount || 0).toLocaleString()}
                          </div>
                          <div className={styles.investmentDetails}>
                            <span>{inv.paymentFrequency || 'compounding'}</span>
                            <span>•</span>
                            <span>{inv.lockupPeriod || '1-year'}</span>
                            {inv.createdDate && (
                              <>
                                <span>•</span>
                                <span>Created: {new Date(inv.createdDate).toLocaleDateString()}</span>
                              </>
                            )}
                            {inv.confirmedDate && (
                              <>
                                <span>•</span>
                                <span>Confirmed: {new Date(inv.confirmedDate).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className={styles.investmentTotal}>
                        Total: ${row.investments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0).toLocaleString()}
                      </div>
                      <div className={styles.note}>
                        ℹ️ <strong>Note:</strong> Distributions will be auto-calculated after import based on these dates
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            <button onClick={() => setStage(IMPORT_STAGES.ADD)} className={styles.secondaryButton}>
              Add Another Investor
            </button>
            <button onClick={handleImport} className={styles.primaryButton} disabled={isProcessing}>
              {isProcessing ? 'Importing...' : `Import ${editableData.length} Investor${editableData.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Stage: Importing */}
      {stage === IMPORT_STAGES.IMPORTING && (
        <div className={styles.stage}>
          <h3>Importing...</h3>
          <p>Please wait while we import the investors.</p>
          <div className={styles.loader}></div>
        </div>
      )}

      {/* Stage: Complete */}
      {stage === IMPORT_STAGES.COMPLETE && importResults && (
        <div className={styles.stage}>
          <h3>✅ Import Complete!</h3>
          
          {importResults.message && (
            <div className={styles.importMessage}>
              ℹ️ {importResults.message}
            </div>
          )}
          
          <div className={styles.results}>
            <div className={styles.resultCard}>
              <div className={styles.resultLabel}>Total Processed</div>
              <div className={styles.resultValue}>{importResults.total}</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultLabel}>Successfully Imported</div>
              <div className={styles.resultValue}>{importResults.imported}</div>
            </div>
            <div className={styles.resultCard}>
              <div className={styles.resultLabel}>Skipped</div>
              <div className={styles.resultValue}>{importResults.skipped}</div>
            </div>
          </div>

          {importResults.errors && importResults.errors.length > 0 && (
            <div className={styles.errorList}>
              <h4>Errors:</h4>
              <ul>
                {importResults.errors.map((err, idx) => (
                  <li key={idx}>
                    <strong>{err.email}</strong>: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.actions}>
            <button
              onClick={handleSendWelcomeEmails}
              className={styles.primaryButton}
              disabled={isProcessing || !importResults.importedUserIds?.length}
            >
              {isProcessing ? 'Sending...' : '📧 Send Welcome Emails'}
            </button>
            <button onClick={handleReset} className={styles.secondaryButton}>
              Import More Investors
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

