'use client'

import { useState, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import styles from './ImportInvestorsTab.module.css'

/**
 * Field definitions for investor import
 * Maps internal field names to user-friendly labels
 */
const FIELD_DEFINITIONS = {
  // Required user fields
  email: { label: 'Email', required: true, category: 'User Profile' },
  firstName: { label: 'First Name', required: true, category: 'User Profile' },
  lastName: { label: 'Last Name', required: true, category: 'User Profile' },
  
  // Optional user fields
  phoneNumber: { label: 'Phone Number', required: false, category: 'User Profile' },
  dob: { label: 'Date of Birth', required: false, category: 'User Profile' },
  ssn: { label: 'SSN/TIN', required: false, category: 'User Profile' },
  accountType: { label: 'Account Type', required: false, category: 'User Profile' },
  
  // Address fields
  'address.street1': { label: 'Address Street 1', required: false, category: 'Address' },
  'address.street2': { label: 'Address Street 2', required: false, category: 'Address' },
  'address.city': { label: 'City', required: false, category: 'Address' },
  'address.state': { label: 'State', required: false, category: 'Address' },
  'address.zip': { label: 'ZIP Code', required: false, category: 'Address' },
  
  // Investment fields
  'investment.amount': { label: 'Investment Amount', required: false, category: 'Investment' },
  'investment.paymentFrequency': { label: 'Payment Frequency', required: false, category: 'Investment' },
  'investment.lockupPeriod': { label: 'Lockup Period', required: false, category: 'Investment' },
  'investment.investmentDate': { label: 'Investment Date', required: false, category: 'Investment' },
  'investment.status': { label: 'Investment Status', required: false, category: 'Investment' },
  
  // Dates
  createdAt: { label: 'Account Created Date', required: false, category: 'Dates' },
  verifiedAt: { label: 'Verified Date', required: false, category: 'Dates' }
}

const IMPORT_STAGES = {
  UPLOAD: 'upload',
  MAPPING: 'mapping',
  REVIEW: 'review',
  IMPORTING: 'importing',
  COMPLETE: 'complete'
}

const IMPORT_MODES = {
  CSV: 'csv',
  MANUAL: 'manual'
}

export default function ImportInvestorsTab({ currentUser, onImportComplete }) {
  const [importMode, setImportMode] = useState(null) // null, 'csv', or 'manual'
  const [stage, setStage] = useState(IMPORT_STAGES.UPLOAD)
  const [csvData, setCsvData] = useState(null)
  const [csvHeaders, setCsvHeaders] = useState([])
  const [fieldMapping, setFieldMapping] = useState({})
  const [editableData, setEditableData] = useState([])
  const [importResults, setImportResults] = useState(null)
  const [error, setError] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)
  
  // Manual form state
  const [manualForm, setManualForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    dob: '',
    ssn: '',
    accountType: 'individual',
    address: {
      street1: '',
      street2: '',
      city: '',
      state: '',
      zip: ''
    },
    investment: {
      amount: '',
      paymentFrequency: 'compounding',
      lockupPeriod: '1-year',
      investmentDate: '',
      status: 'active'
    },
    distributions: [],
    contributions: []
  })
  
  // Transaction form state (for adding distributions/contributions)
  const [transactionForm, setTransactionForm] = useState({
    type: 'distribution',
    amount: '',
    date: '',
    description: ''
  })

  // Handle CSV file upload
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0]
    if (!file) return

    setError(null)
    setIsProcessing(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`)
          setIsProcessing(false)
          return
        }

        const headers = results.meta.fields || []
        setCsvHeaders(headers)
        setCsvData(results.data)
        
        // Auto-detect field mappings
        const autoMapping = autoDetectFieldMapping(headers)
        setFieldMapping(autoMapping)
        
        setStage(IMPORT_STAGES.MAPPING)
        setIsProcessing(false)
      },
      error: (error) => {
        setError(`Failed to parse CSV: ${error.message}`)
        setIsProcessing(false)
      }
    })
  }, [])

  // Auto-detect field mappings based on CSV headers
  const autoDetectFieldMapping = (headers) => {
    const mapping = {}
    
    headers.forEach(header => {
      const lowerHeader = header.toLowerCase().trim()
      
      // Common mappings
      if (lowerHeader.includes('email') || lowerHeader === 'e-mail') {
        mapping[header] = 'email'
      } else if (lowerHeader.includes('first') && lowerHeader.includes('name')) {
        mapping[header] = 'firstName'
      } else if (lowerHeader.includes('last') && lowerHeader.includes('name')) {
        mapping[header] = 'lastName'
      } else if (lowerHeader.includes('phone')) {
        mapping[header] = 'phoneNumber'
      } else if (lowerHeader.includes('dob') || lowerHeader.includes('birth')) {
        mapping[header] = 'dob'
      } else if (lowerHeader.includes('ssn') || lowerHeader.includes('tax') && lowerHeader.includes('id')) {
        mapping[header] = 'ssn'
      } else if (lowerHeader.includes('account') && lowerHeader.includes('type')) {
        mapping[header] = 'accountType'
      } else if (lowerHeader.includes('street') || lowerHeader.includes('address')) {
        mapping[header] = 'address.street1'
      } else if (lowerHeader.includes('city')) {
        mapping[header] = 'address.city'
      } else if (lowerHeader.includes('state')) {
        mapping[header] = 'address.state'
      } else if (lowerHeader.includes('zip') || lowerHeader.includes('postal')) {
        mapping[header] = 'address.zip'
      } else if (lowerHeader.includes('amount') || lowerHeader.includes('investment')) {
        mapping[header] = 'investment.amount'
      } else if (lowerHeader.includes('payment') && lowerHeader.includes('freq')) {
        mapping[header] = 'investment.paymentFrequency'
      } else if (lowerHeader.includes('lockup')) {
        mapping[header] = 'investment.lockupPeriod'
      } else if (lowerHeader.includes('date') && lowerHeader.includes('invest')) {
        mapping[header] = 'investment.investmentDate'
      } else if (lowerHeader.includes('created')) {
        mapping[header] = 'createdAt'
      }
    })
    
    return mapping
  }

  // Update field mapping
  const handleMappingChange = (csvHeader, targetField) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvHeader]: targetField
    }))
  }

  // Proceed to review stage
  const proceedToReview = () => {
    // Check required fields are mapped
    const requiredFields = Object.keys(FIELD_DEFINITIONS).filter(
      key => FIELD_DEFINITIONS[key].required
    )
    
    const mappedFields = Object.values(fieldMapping)
    const missingFields = requiredFields.filter(field => !mappedFields.includes(field))
    
    if (missingFields.length > 0) {
      setError(`Missing required field mappings: ${missingFields.map(f => FIELD_DEFINITIONS[f].label).join(', ')}`)
      return
    }

    // Transform CSV data to editable format
    const transformedData = csvData.map((row, index) => {
      const investor = { _rowId: index }
      
      Object.entries(fieldMapping).forEach(([csvHeader, targetField]) => {
        if (!targetField || targetField === '') return
        
        const value = row[csvHeader]
        
        // Handle nested fields (e.g., address.city)
        if (targetField.includes('.')) {
          const [parent, child] = targetField.split('.')
          if (!investor[parent]) investor[parent] = {}
          investor[parent][child] = value
        } else {
          investor[targetField] = value
        }
      })
      
      return investor
    })
    
    setEditableData(transformedData)
    setStage(IMPORT_STAGES.REVIEW)
    setError(null)
  }

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
        
        // If investment data is present, structure it properly
        if (investor.investment && Object.keys(investor.investment).some(k => investor.investment[k])) {
          investor.investments = [{
            amount: parseFloat(investor.investment.amount) || 0,
            paymentFrequency: investor.investment.paymentFrequency || 'compounding',
            lockupPeriod: investor.investment.lockupPeriod || '1-year',
            investmentDate: investor.investment.investmentDate || new Date().toISOString(),
            status: investor.investment.status || 'active'
          }]
          delete investor.investment
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
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setManualForm(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }))
    } else {
      setManualForm(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  // Handle transaction form changes
  const handleTransactionFormChange = (field, value) => {
    setTransactionForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Add distribution or contribution
  const handleAddTransaction = () => {
    if (!transactionForm.amount || !transactionForm.date) {
      setError('Amount and date are required for transactions')
      return
    }

    const transaction = {
      type: transactionForm.type,
      amount: parseFloat(transactionForm.amount),
      date: transactionForm.date,
      description: transactionForm.description || '',
      id: `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    if (transactionForm.type === 'distribution') {
      setManualForm(prev => ({
        ...prev,
        distributions: [...prev.distributions, transaction]
      }))
    } else {
      setManualForm(prev => ({
        ...prev,
        contributions: [...prev.contributions, transaction]
      }))
    }

    // Reset transaction form
    setTransactionForm({
      type: transactionForm.type,
      amount: '',
      date: '',
      description: ''
    })
    setError(null)
  }

  // Remove transaction
  const handleRemoveTransaction = (transactionId, type) => {
    if (type === 'distribution') {
      setManualForm(prev => ({
        ...prev,
        distributions: prev.distributions.filter(t => t.id !== transactionId)
      }))
    } else {
      setManualForm(prev => ({
        ...prev,
        contributions: prev.contributions.filter(t => t.id !== transactionId)
      }))
    }
  }

  // Add manual form data to review
  const handleAddManualInvestor = () => {
    // Validate required fields
    if (!manualForm.email || !manualForm.firstName || !manualForm.lastName) {
      setError('Email, First Name, and Last Name are required')
      return
    }

    // Add to editable data
    const newInvestor = {
      ...manualForm,
      _rowId: editableData.length
    }
    
    setEditableData(prev => [...prev, newInvestor])
    
    // Reset form
    setManualForm({
      email: '',
      firstName: '',
      lastName: '',
      phoneNumber: '',
      dob: '',
      ssn: '',
      accountType: 'individual',
      address: {
        street1: '',
        street2: '',
        city: '',
        state: '',
        zip: ''
      },
      investment: {
        amount: '',
        paymentFrequency: 'compounding',
        lockupPeriod: '1-year',
        investmentDate: '',
        status: 'active'
      },
      distributions: [],
      contributions: []
    })
    
    setTransactionForm({
      type: 'distribution',
      amount: '',
      date: '',
      description: ''
    })
    
    setError(null)
    setStage(IMPORT_STAGES.REVIEW)
  }

  // Reset to start
  const handleReset = () => {
    setImportMode(null)
    setStage(IMPORT_STAGES.UPLOAD)
    setCsvData(null)
    setCsvHeaders([])
    setFieldMapping({})
    setEditableData([])
    setImportResults(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={styles.container}>
      {/* Stage Indicator - Only show if mode is selected */}
      {importMode && (
        <div className={styles.stageIndicator}>
          <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.UPLOAD ? styles.active : ''}`}>
            {importMode === IMPORT_MODES.CSV ? '1. Upload CSV' : '1. Add Investor'}
          </div>
          {importMode === IMPORT_MODES.CSV && (
            <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.MAPPING ? styles.active : ''}`}>
              2. Map Fields
            </div>
          )}
          <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.REVIEW ? styles.active : ''}`}>
            {importMode === IMPORT_MODES.CSV ? '3. Review & Edit' : '2. Review & Edit'}
          </div>
          <div className={`${styles.stageItem} ${stage === IMPORT_STAGES.IMPORTING || stage === IMPORT_STAGES.COMPLETE ? styles.active : ''}`}>
            {importMode === IMPORT_MODES.CSV ? '4. Import' : '3. Import'}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className={styles.error}>
          ❌ {error}
        </div>
      )}

      {/* Mode Selection */}
      {!importMode && stage === IMPORT_STAGES.UPLOAD && (
        <div className={styles.stage}>
          <h3>Add Investors</h3>
          <p>Choose how you want to add investors to the platform.</p>
          
          <div className={styles.modeSelection}>
            <div 
              className={styles.modeCard}
              onClick={() => setImportMode(IMPORT_MODES.CSV)}
            >
              <div className={styles.modeIcon}>📄</div>
              <h4>Upload CSV File</h4>
              <p>Import multiple investors at once from a CSV file exported from Wealthblock or other platforms.</p>
              <button className={styles.modeButton}>Choose CSV Upload</button>
            </div>

            <div 
              className={styles.modeCard}
              onClick={() => {
                setImportMode(IMPORT_MODES.MANUAL)
                setStage(IMPORT_STAGES.UPLOAD)
              }}
            >
              <div className={styles.modeIcon}>✍️</div>
              <h4>Add Manually</h4>
              <p>Add investors one at a time by filling out a form with their information.</p>
              <button className={styles.modeButton}>Choose Manual Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* Stage: CSV Upload */}
      {importMode === IMPORT_MODES.CSV && stage === IMPORT_STAGES.UPLOAD && (
        <div className={styles.stage}>
          <h3>Upload Investor Data</h3>
          <p>Upload a CSV file exported from Wealthblock containing investor information.</p>
          
          <div className={styles.uploadArea}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className={styles.fileInput}
            />
            {isProcessing && <p>Processing file...</p>}
          </div>

          <div className={styles.help}>
            <h4>Expected Fields:</h4>
            <ul>
              <li><strong>Required:</strong> Email, First Name, Last Name</li>
              <li><strong>Optional:</strong> Phone, DOB, SSN, Address, Investment Details</li>
            </ul>
          </div>

          <div className={styles.actions}>
            <button onClick={handleReset} className={styles.secondaryButton}>
              Back to Mode Selection
            </button>
          </div>
        </div>
      )}

      {/* Stage: Manual Form */}
      {importMode === IMPORT_MODES.MANUAL && stage === IMPORT_STAGES.UPLOAD && (
        <div className={styles.stage}>
          <h3>Add Investor Manually</h3>
          <p>Fill out the form below to add an investor. You can add multiple investors before importing.</p>
          
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
                    placeholder="+1-555-0100"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={manualForm.dob}
                    onChange={(e) => handleManualFormChange('dob', e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>SSN/TIN</label>
                  <input
                    type="text"
                    value={manualForm.ssn}
                    onChange={(e) => handleManualFormChange('ssn', e.target.value)}
                    placeholder="123-45-6789"
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

            {/* Investment Section */}
            <div className={styles.formSection}>
              <h4>Investment Details (Optional)</h4>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label>Investment Amount</label>
                  <input
                    type="number"
                    value={manualForm.investment.amount}
                    onChange={(e) => handleManualFormChange('investment.amount', e.target.value)}
                    placeholder="50000"
                    min="0"
                    step="1000"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Payment Frequency</label>
                  <select
                    value={manualForm.investment.paymentFrequency}
                    onChange={(e) => handleManualFormChange('investment.paymentFrequency', e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="compounding">Compounding</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Lockup Period</label>
                  <select
                    value={manualForm.investment.lockupPeriod}
                    onChange={(e) => handleManualFormChange('investment.lockupPeriod', e.target.value)}
                  >
                    <option value="1-year">1 Year</option>
                    <option value="3-year">3 Years</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Investment Date</label>
                  <input
                    type="date"
                    value={manualForm.investment.investmentDate}
                    onChange={(e) => handleManualFormChange('investment.investmentDate', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Transactions Section - Distributions & Contributions */}
            <div className={styles.formSection}>
              <h4>Historical Transactions (Optional)</h4>
              <p className={styles.sectionNote}>
                Add past distributions (payments to investor) and contributions (additional investments).
              </p>
              
              {/* Add Transaction Form */}
              <div className={styles.transactionForm}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Transaction Type</label>
                    <select
                      value={transactionForm.type}
                      onChange={(e) => handleTransactionFormChange('type', e.target.value)}
                      className={styles.transactionTypeSelect}
                    >
                      <option value="distribution">Distribution (Payment to Investor)</option>
                      <option value="contribution">Contribution (Additional Investment)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Amount</label>
                    <input
                      type="number"
                      value={transactionForm.amount}
                      onChange={(e) => handleTransactionFormChange('amount', e.target.value)}
                      placeholder="5000"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Date</label>
                    <input
                      type="date"
                      value={transactionForm.date}
                      onChange={(e) => handleTransactionFormChange('date', e.target.value)}
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                    <label>Description (Optional)</label>
                    <input
                      type="text"
                      value={transactionForm.description}
                      onChange={(e) => handleTransactionFormChange('description', e.target.value)}
                      placeholder="e.g., Q4 2024 distribution"
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleAddTransaction} 
                  className={styles.addTransactionButton}
                >
                  + Add {transactionForm.type === 'distribution' ? 'Distribution' : 'Contribution'}
                </button>
              </div>

              {/* Display Added Transactions */}
              {(manualForm.distributions.length > 0 || manualForm.contributions.length > 0) && (
                <div className={styles.transactionsList}>
                  {/* Distributions */}
                  {manualForm.distributions.length > 0 && (
                    <div className={styles.transactionGroup}>
                      <h5>Distributions ({manualForm.distributions.length})</h5>
                      <div className={styles.transactionItems}>
                        {manualForm.distributions.map(dist => (
                          <div key={dist.id} className={styles.transactionItem}>
                            <div className={styles.transactionInfo}>
                              <span className={styles.transactionAmount}>${dist.amount.toLocaleString()}</span>
                              <span className={styles.transactionDate}>
                                {new Date(dist.date).toLocaleDateString()}
                              </span>
                              {dist.description && (
                                <span className={styles.transactionDesc}>{dist.description}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTransaction(dist.id, 'distribution')}
                              className={styles.transactionRemove}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className={styles.transactionTotal}>
                        Total Distributions: ${manualForm.distributions.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                      </div>
                    </div>
                  )}

                  {/* Contributions */}
                  {manualForm.contributions.length > 0 && (
                    <div className={styles.transactionGroup}>
                      <h5>Contributions ({manualForm.contributions.length})</h5>
                      <div className={styles.transactionItems}>
                        {manualForm.contributions.map(cont => (
                          <div key={cont.id} className={styles.transactionItem}>
                            <div className={styles.transactionInfo}>
                              <span className={styles.transactionAmount}>${cont.amount.toLocaleString()}</span>
                              <span className={styles.transactionDate}>
                                {new Date(cont.date).toLocaleDateString()}
                              </span>
                              {cont.description && (
                                <span className={styles.transactionDesc}>{cont.description}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTransaction(cont.id, 'contribution')}
                              className={styles.transactionRemove}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className={styles.transactionTotal}>
                        Total Contributions: ${manualForm.contributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <button onClick={handleReset} className={styles.secondaryButton}>
              Back to Mode Selection
            </button>
            <button onClick={handleAddManualInvestor} className={styles.primaryButton}>
              Add to Review List
              {(manualForm.distributions.length > 0 || manualForm.contributions.length > 0) && (
                <span className={styles.transactionBadge}>
                  {manualForm.distributions.length + manualForm.contributions.length} txn
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Stage: Mapping */}
      {stage === IMPORT_STAGES.MAPPING && (
        <div className={styles.stage}>
          <h3>Map CSV Fields</h3>
          <p>Map columns from your CSV to the investor database fields.</p>
          
          <div className={styles.mappingTable}>
            <table>
              <thead>
                <tr>
                  <th>CSV Column</th>
                  <th>Sample Data</th>
                  <th>Maps To</th>
                </tr>
              </thead>
              <tbody>
                {csvHeaders.map(header => (
                  <tr key={header}>
                    <td>{header}</td>
                    <td className={styles.sampleData}>
                      {csvData[0]?.[header] || '—'}
                    </td>
                    <td>
                      <select
                        value={fieldMapping[header] || ''}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className={styles.mappingSelect}
                      >
                        <option value="">— Skip —</option>
                        {Object.entries(FIELD_DEFINITIONS).map(([field, def]) => (
                          <option key={field} value={field}>
                            {def.label} {def.required ? '*' : ''} ({def.category})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.actions}>
            <button onClick={handleReset} className={styles.secondaryButton}>
              Cancel
            </button>
            <button onClick={proceedToReview} className={styles.primaryButton}>
              Continue to Review
            </button>
          </div>
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
                {editableData.filter(row => row.investment?.amount).length}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Distributions</div>
              <div className={styles.summaryValue}>
                {editableData.reduce((sum, row) => sum + (row.distributions?.length || 0), 0)}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Total Contributions</div>
              <div className={styles.summaryValue}>
                {editableData.reduce((sum, row) => sum + (row.contributions?.length || 0), 0)}
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

                  {/* Investment */}
                  {row.investment?.amount && (
                    <div className={styles.cardSection}>
                      <h5>Investment</h5>
                      <div className={styles.investmentDisplay}>
                        <div className={styles.investmentAmount}>
                          ${parseFloat(row.investment.amount || 0).toLocaleString()}
                        </div>
                        <div className={styles.investmentDetails}>
                          <span>{row.investment.paymentFrequency || 'compounding'}</span>
                          <span>•</span>
                          <span>{row.investment.lockupPeriod || '1-year'}</span>
                          {row.investment.investmentDate && (
                            <>
                              <span>•</span>
                              <span>{new Date(row.investment.investmentDate).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={styles.note}>
                        ℹ️ <strong>Note:</strong> Bank account will be linked when investor sets up their account
                      </div>
                    </div>
                  )}

                  {/* Distributions */}
                  {row.distributions && row.distributions.length > 0 && (
                    <div className={styles.cardSection}>
                      <h5>Distributions ({row.distributions.length})</h5>
                      <div className={styles.transactionsDisplay}>
                        {row.distributions.map((dist, idx) => (
                          <div key={idx} className={styles.transactionRow}>
                            <span className={styles.txAmount}>${dist.amount.toLocaleString()}</span>
                            <span className={styles.txDate}>
                              {new Date(dist.date).toLocaleDateString()}
                            </span>
                            {dist.description && (
                              <span className={styles.txDesc}>{dist.description}</span>
                            )}
                          </div>
                        ))}
                        <div className={styles.txTotal}>
                          Total: ${row.distributions.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contributions */}
                  {row.contributions && row.contributions.length > 0 && (
                    <div className={styles.cardSection}>
                      <h5>Contributions ({row.contributions.length})</h5>
                      <div className={styles.transactionsDisplay}>
                        {row.contributions.map((cont, idx) => (
                          <div key={idx} className={styles.transactionRow}>
                            <span className={styles.txAmount}>${cont.amount.toLocaleString()}</span>
                            <span className={styles.txDate}>
                              {new Date(cont.date).toLocaleDateString()}
                            </span>
                            {cont.description && (
                              <span className={styles.txDesc}>{cont.description}</span>
                            )}
                          </div>
                        ))}
                        <div className={styles.txTotal}>
                          Total: ${row.contributions.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.actions}>
            {importMode === IMPORT_MODES.CSV && (
              <button onClick={() => setStage(IMPORT_STAGES.MAPPING)} className={styles.secondaryButton}>
                Back to Mapping
              </button>
            )}
            {importMode === IMPORT_MODES.MANUAL && (
              <button onClick={() => setStage(IMPORT_STAGES.UPLOAD)} className={styles.secondaryButton}>
                Add Another Investor
              </button>
            )}
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

