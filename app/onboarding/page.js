'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'

const ONBOARDING_STEPS = {
  PASSWORD: 'password',
  SSN: 'ssn',
  BANK: 'bank',
  COMPLETE: 'complete'
}

export default function OnboardingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get('token')
  
  const [currentStep, setCurrentStep] = useState(ONBOARDING_STEPS.PASSWORD)
  const [userData, setUserData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Password step state
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // SSN step state
  const [ssn, setSsn] = useState('')
  
  // Bank step state
  const [bankMethod, setBankMethod] = useState('manual') // 'manual' or 'plaid'
  const [bankDetails, setBankDetails] = useState({
    accountHolder: '',
    routingNumber: '',
    accountNumber: '',
    accountType: 'checking'
  })

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing onboarding link')
      return
    }
    // In a real implementation, verify the token with the API
  }, [token])

  // Handle password setup
  const handlePasswordSetup = async (e) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to set password')
      }
      
      setUserData(data.user)
      setCurrentStep(ONBOARDING_STEPS.SSN)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle SSN submission
  const handleSSNSubmit = async (e) => {
    e.preventDefault()
    
    // Validate SSN format (XXX-XX-XXXX)
    const ssnRegex = /^\d{3}-\d{2}-\d{4}$/
    if (!ssnRegex.test(ssn)) {
      setError('Please enter SSN in format: XXX-XX-XXXX')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/users/${userData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssn })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to update SSN')
      }
      
      setCurrentStep(ONBOARDING_STEPS.BANK)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle bank account setup
  const handleBankSubmit = async (e) => {
    e.preventDefault()
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/users/${userData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccounts: [{
            ...bankDetails,
            id: `BANK-${userData.id}`,
            isPrimary: true,
            addedAt: new Date().toISOString()
          }],
          needsOnboarding: false,
          onboardingCompleted: true
        })
      })
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to add bank account')
      }
      
      setCurrentStep(ONBOARDING_STEPS.COMPLETE)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Format SSN as user types
  const handleSSNChange = (value) => {
    let formatted = value.replace(/\D/g, '')
    if (formatted.length > 3) {
      formatted = formatted.slice(0, 3) + '-' + formatted.slice(3)
    }
    if (formatted.length > 6) {
      formatted = formatted.slice(0, 6) + '-' + formatted.slice(6, 10)
    }
    setSsn(formatted)
  }

  return (
    <div className={styles.container}>
      <div className={styles.onboardingBox}>
        <h1 className={styles.title}>Welcome to Robert Ventures</h1>
        <p className={styles.subtitle}>Complete your account setup</p>

        {/* Progress Indicator */}
        <div className={styles.progressBar}>
          <div className={`${styles.step} ${currentStep === ONBOARDING_STEPS.PASSWORD ? styles.active : styles.completed}`}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepLabel}>Password</div>
          </div>
          <div className={`${styles.step} ${currentStep === ONBOARDING_STEPS.SSN ? styles.active : currentStep === ONBOARDING_STEPS.BANK || currentStep === ONBOARDING_STEPS.COMPLETE ? styles.completed : ''}`}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepLabel}>SSN</div>
          </div>
          <div className={`${styles.step} ${currentStep === ONBOARDING_STEPS.BANK ? styles.active : currentStep === ONBOARDING_STEPS.COMPLETE ? styles.completed : ''}`}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepLabel}>Bank Account</div>
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            ❌ {error}
          </div>
        )}

        {/* Step 1: Password Setup */}
        {currentStep === ONBOARDING_STEPS.PASSWORD && (
          <form onSubmit={handlePasswordSetup} className={styles.form}>
            <h2>Set Your Password</h2>
            <p>Create a secure password for your account</p>
            
            <div className={styles.formGroup}>
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
              />
            </div>
            
            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? 'Setting Password...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2: SSN Verification */}
        {currentStep === ONBOARDING_STEPS.SSN && (
          <form onSubmit={handleSSNSubmit} className={styles.form}>
            <h2>Verify Your Identity</h2>
            <p>Please provide your Social Security Number for tax compliance</p>
            
            <div className={styles.formGroup}>
              <label>Social Security Number</label>
              <input
                type="text"
                value={ssn}
                onChange={(e) => handleSSNChange(e.target.value)}
                required
                placeholder="XXX-XX-XXXX"
                maxLength={11}
              />
              <small className={styles.helpText}>
                This information is required for tax reporting (IRS Form 1099)
              </small>
            </div>
            
            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? 'Verifying...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 3: Bank Account Setup */}
        {currentStep === ONBOARDING_STEPS.BANK && (
          <div className={styles.form}>
            <h2>Link Your Bank Account</h2>
            <p>Add a bank account to receive distributions</p>
            
            <div className={styles.bankMethodSelector}>
              <button
                type="button"
                className={`${styles.methodButton} ${bankMethod === 'manual' ? styles.active : ''}`}
                onClick={() => setBankMethod('manual')}
              >
                Manual Entry
              </button>
              <button
                type="button"
                className={`${styles.methodButton} ${bankMethod === 'plaid' ? styles.active : ''}`}
                onClick={() => setBankMethod('plaid')}
              >
                Link with Plaid (Coming Soon)
              </button>
            </div>

            {bankMethod === 'manual' && (
              <form onSubmit={handleBankSubmit}>
                <div className={styles.formGroup}>
                  <label>Account Holder Name</label>
                  <input
                    type="text"
                    value={bankDetails.accountHolder}
                    onChange={(e) => setBankDetails({...bankDetails, accountHolder: e.target.value})}
                    required
                    placeholder="John Doe"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Routing Number</label>
                  <input
                    type="text"
                    value={bankDetails.routingNumber}
                    onChange={(e) => setBankDetails({...bankDetails, routingNumber: e.target.value})}
                    required
                    placeholder="123456789"
                    maxLength={9}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Account Number</label>
                  <input
                    type="text"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                    required
                    placeholder="1234567890"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Account Type</label>
                  <select
                    value={bankDetails.accountType}
                    onChange={(e) => setBankDetails({...bankDetails, accountType: e.target.value})}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </div>
                
                <button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? 'Adding Account...' : 'Complete Setup'}
                </button>
              </form>
            )}

            {bankMethod === 'plaid' && (
              <div className={styles.comingSoon}>
                <p>Plaid integration coming soon!</p>
                <p>Please use manual entry for now.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === ONBOARDING_STEPS.COMPLETE && (
          <div className={styles.complete}>
            <div className={styles.successIcon}>✓</div>
            <h2>Setup Complete!</h2>
            <p>Your account is now fully set up. You can now access your investment dashboard.</p>
            
            <button
              onClick={() => router.push('/dashboard')}
              className={styles.submitButton}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

