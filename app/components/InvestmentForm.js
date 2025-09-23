'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import styles from './InvestmentForm.module.css'

export default function InvestmentForm({ onCompleted, disableAuthGuard = false, accountType, initialAmount, initialPaymentFrequency, initialLockup, onValuesChange }) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    investmentAmount: typeof initialAmount === 'number' ? initialAmount : 0,
    paymentFrequency: initialPaymentFrequency === 'monthly' || initialPaymentFrequency === 'compounding' ? initialPaymentFrequency : 'compounding'
  })
  const [errors, setErrors] = useState({})
  const [selectedLockup, setSelectedLockup] = useState(initialLockup === '1-year' || initialLockup === '3-year' ? initialLockup : '1-year')
  const [isAmountFocused, setIsAmountFocused] = useState(false)
  const [displayAmount, setDisplayAmount] = useState('')

  // Calculate bonds based on $10 per bond
  const bonds = Math.floor(formData.investmentAmount / 10)

  // Calculate anticipated earnings based on payment frequency
  const calculateEarnings1Year = () => {
    const amount = formData.investmentAmount
    const apy = 0.08
    const years = 1
    
    if (formData.paymentFrequency === 'monthly') {
      // Interest paid monthly
      return (amount * apy * years).toFixed(2)
    } else {
      // Compounded monthly
      const monthlyRate = apy / 12
      const totalMonths = years * 12
      const compoundAmount = amount * Math.pow(1 + monthlyRate, totalMonths)
      return (compoundAmount - amount).toFixed(2)
    }
  }

  const calculateEarnings3Year = () => {
    const amount = formData.investmentAmount
    const apy = 0.10
    const years = 3
    
    if (formData.paymentFrequency === 'monthly') {
      // Interest paid monthly
      return (amount * apy * years).toFixed(2)
    } else {
      // Compounded monthly
      const monthlyRate = apy / 12
      const totalMonths = years * 12
      const compoundAmount = amount * Math.pow(1 + monthlyRate, totalMonths)
      return (compoundAmount - amount).toFixed(2)
    }
  }

  const earnings1Year = calculateEarnings1Year()
  const earnings3Year = calculateEarnings3Year()
  // Annualized earnings for display (APY * amount)
  const annualEarnings1Year = (formData.investmentAmount * 0.08).toFixed(2)
  const annualEarnings3Year = (formData.investmentAmount * 0.10).toFixed(2)

  useEffect(() => {
    // Check if user is logged in (has session data)
    if (disableAuthGuard) return
    const userId = typeof window !== 'undefined' ? localStorage.getItem('currentUserId') : null
    if (!userId) {
      alert('Please complete the signup process first.')
      router.push('/')
    }
  }, [router, disableAuthGuard])

  // Keep in sync if parent updates values
  useEffect(() => {
    if (typeof initialAmount === 'number') {
      setFormData(prev => ({ ...prev, investmentAmount: initialAmount }))
      setDisplayAmount(initialAmount > 0 ? initialAmount.toLocaleString() : '')
    }
  }, [initialAmount])

  // Update display amount when formData changes
  useEffect(() => {
    if (!isAmountFocused) {
      setDisplayAmount(formData.investmentAmount > 0 ? formData.investmentAmount.toLocaleString() : '')
    }
  }, [formData.investmentAmount, isAmountFocused])
  useEffect(() => {
    if (initialPaymentFrequency === 'monthly' || initialPaymentFrequency === 'compounding') {
      setFormData(prev => ({ ...prev, paymentFrequency: initialPaymentFrequency }))
    }
  }, [initialPaymentFrequency])
  useEffect(() => {
    if (initialLockup === '1-year' || initialLockup === '3-year') {
      setSelectedLockup(initialLockup)
    }
  }, [initialLockup])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    let nextValue = value
    if (name === 'investmentAmount') {
      // Remove commas and strip leading zeros so typing doesn't result in values like 01000
      const cleanValue = value.replace(/,/g, '').replace(/^0+(?=\d)/, '')
      nextValue = cleanValue
      setDisplayAmount(cleanValue) // Show raw input while typing
    }
    const numericValue = name === 'investmentAmount' ? (nextValue === '' ? 0 : parseFloat(nextValue) || 0) : nextValue
    
    setFormData(prev => ({ ...prev, [name]: numericValue }))
    if (typeof onValuesChange === 'function') onValuesChange({ amount: name === 'investmentAmount' ? numericValue : formData.investmentAmount, paymentFrequency: formData.paymentFrequency, lockupPeriod: selectedLockup })
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const handleRadioChange = (e) => {
    const { name, value } = e.target
    if (accountType === 'ira' && value === 'monthly') return
    setFormData(prev => ({ ...prev, [name]: value }))
    if (typeof onValuesChange === 'function') onValuesChange({ amount: formData.investmentAmount, paymentFrequency: value, lockupPeriod: selectedLockup })
  }


  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.investmentAmount || formData.investmentAmount < 1000) {
      newErrors.investmentAmount = 'Minimum investment is $1,000'
    }
    
    if (!formData.paymentFrequency) {
      newErrors.paymentFrequency = 'Please select a payment frequency'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInvest = async (lockupPeriod) => {
    if (!validateForm()) return
    try {
      const userId = typeof window !== 'undefined' ? localStorage.getItem('currentUserId') : null
      if (!userId) {
        alert('Please sign in to continue')
        router.push('/')
        return
      }

      const earnings = lockupPeriod === '1-year' ? earnings1Year : earnings3Year
      const investmentPayload = {
        amount: formData.investmentAmount,
        paymentFrequency: formData.paymentFrequency,
        lockupPeriod,
        anticipatedEarnings: Number(earnings),
        bonds,
      }

      const existingInvestmentId = typeof window !== 'undefined' ? localStorage.getItem('currentInvestmentId') : null
      if (existingInvestmentId) {
        // Update existing draft investment instead of creating a new one
        const updateRes = await fetch(`/api/users/${userId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _action: 'updateInvestment',
            investmentId: existingInvestmentId,
            fields: { ...investmentPayload, status: 'draft' }
          })
        })
        const updateData = await updateRes.json()
        if (!updateData.success) {
          // If the server says the investment does not exist, clear stale id and create new
          if (updateData.error === 'Investment not found') {
            localStorage.removeItem('currentInvestmentId')
          } else {
            alert(updateData.error || 'Failed to update investment')
            return
          }
        } else {
          if (typeof onCompleted === 'function') {
            onCompleted(existingInvestmentId)
          } else {
            router.push('/investment')
          }
          return
        }
      }

      // No existing investment: create once
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'startInvestment', investment: investmentPayload })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to start investment')
        return
      }
      // Save current investment id for next steps
      if (data.investment?.id) {
        localStorage.setItem('currentInvestmentId', data.investment.id)
        // If account type was already chosen earlier in the step, persist it now
        if (accountType) {
          await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              _action: 'updateInvestment',
              investmentId: data.investment.id,
              fields: { accountType }
            })
          })
        }
      }
      if (typeof onCompleted === 'function') {
        onCompleted(data.investment?.id)
      } else {
        router.push('/investment')
      }
    } catch (err) {
      console.error('Error starting investment', err)
      alert('An error occurred. Please try again.')
    }
  }

  return (
    <div className={styles.investmentForm}>
      <div className={styles.formContainer}>
        {/* Step 1: Enter Investment Amount */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Enter Investment Amount</h2>
          <div className={styles.amountSection}>
            <div className={styles.inputGroup}>
              <div className={styles.currencyInput}>
                <span className={styles.currencyPrefix}>$</span>
                <input
                  type="text"
                  name="investmentAmount"
                  value={isAmountFocused ? displayAmount : (formData.investmentAmount > 0 ? formData.investmentAmount.toLocaleString() : '')}
                  onChange={handleInputChange}
                  className={styles.amountInput}
                  onFocus={() => setIsAmountFocused(true)}
                  onBlur={() => setIsAmountFocused(false)}
                  placeholder="0"
                />
                <span className={styles.bondsSuffix}>= {bonds} Bond{bonds !== 1 ? 's' : ''}</span>
              </div>
              
            </div>
            {errors.investmentAmount && (
              <div className={styles.errorMessage}>{errors.investmentAmount}</div>
            )}
          </div>
        </div>

        {/* Step 2: Enter Payment Frequency */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Enter Payment Frequency</h2>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption}>
              <input
                type="radio"
                name="paymentFrequency"
                value="compounding"
                checked={formData.paymentFrequency === 'compounding'}
                onChange={handleRadioChange}
                className={styles.radioInput}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Compounded Monthly</span>
              </div>
            </label>
            
            <label className={`${styles.radioOption} ${accountType === 'ira' ? styles.disabled : ''}`}>
              <input
                type="radio"
                name="paymentFrequency"
                value="monthly"
                checked={formData.paymentFrequency === 'monthly'}
                onChange={handleRadioChange}
                className={styles.radioInput}
                disabled={accountType === 'ira'}
              />
              <div className={styles.radioContent}>
                <span className={styles.radioLabel}>Interest Paid Monthly</span>
              </div>
            </label>
          </div>
          {errors.paymentFrequency && (
            <div className={styles.errorMessage}>{errors.paymentFrequency}</div>
          )}
        </div>

        {/* Step 3: Select Investment Option */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Select Investment Option</h2>
          
          <div className={styles.investmentCards}>
            <div 
              className={`${styles.investmentCard} ${selectedLockup === '1-year' ? styles.selected : ''}`}
              onClick={() => { setSelectedLockup('1-year'); if (typeof onValuesChange === 'function') onValuesChange({ amount: formData.investmentAmount, paymentFrequency: formData.paymentFrequency, lockupPeriod: '1-year' }) }}
              role="button"
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>1-Year Lock-Up</h3>
                <div className={styles.cardYield}>8% APY</div>
              </div>
              <div className={styles.cardEarnings}>
                Estimated annual earnings: <span className={styles.earningsAmount}>${parseFloat(annualEarnings1Year).toLocaleString()}</span>
              </div>
            </div>
            
            <div 
              className={`${styles.investmentCard} ${selectedLockup === '3-year' ? styles.selected : ''}`}
              onClick={() => { setSelectedLockup('3-year'); if (typeof onValuesChange === 'function') onValuesChange({ amount: formData.investmentAmount, paymentFrequency: formData.paymentFrequency, lockupPeriod: '3-year' }) }}
              role="button"
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>3-Year Lock-Up</h3>
                <div className={styles.cardYield}>10% APY</div>
              </div>
              <div className={styles.cardEarnings}>
                Estimated annual earnings: <span className={styles.earningsAmount}>${parseFloat(annualEarnings3Year).toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className={styles.actionsRow}>
            <button 
              onClick={() => handleInvest(selectedLockup)}
              className={styles.investButton}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
