'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import styles from './page.module.css'
import stepStyles from '../components/TabbedSignup.module.css'
import TabbedInvestmentType from '../components/TabbedInvestmentType'
import InvestmentForm from '../components/InvestmentForm'
import TabbedResidentialIdentity from '../components/TabbedResidentialIdentity'

export default function InvestmentPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(1)
  const [isStep1Completed, setIsStep1Completed] = useState(false)
  const [isStep2Completed, setIsStep2Completed] = useState(false)
  const [reviewModeStep1, setReviewModeStep1] = useState(false)
  const [reviewModeStep2, setReviewModeStep2] = useState(false)
  const [step2Unlocked, setStep2Unlocked] = useState(false)

  const [selectedAccountType, setSelectedAccountType] = useState('individual')
  const [lockedAccountType, setLockedAccountType] = useState(null)
  const [investmentAmount, setInvestmentAmount] = useState(0)
  const [investmentPaymentFrequency, setInvestmentPaymentFrequency] = useState('compounding')
  const [investmentLockup, setInvestmentLockup] = useState('1-year')
  const [investmentSummary, setInvestmentSummary] = useState(null)
  const [identitySummary, setIdentitySummary] = useState(null)
  const formattedInvestmentSummary = useMemo(() => {
    if (!investmentSummary) return []
    const accountTypeLabels = {
      individual: 'Individual',
      joint: 'Joint',
      entity: 'Entity',
      ira: 'IRA'
    }
    const lockupLabels = {
      '1-year': '1-Year Lock-Up',
      '3-year': '3-Year Lock-Up'
    }
    const lines = []
    lines.push({ label: 'Account Type', value: accountTypeLabels[investmentSummary.accountType] || '—' })
    lines.push({ label: 'Investment Amount', value: typeof investmentSummary.amount === 'number' ? `$${Number(investmentSummary.amount).toLocaleString()}` : '—' })
    lines.push({ label: 'Total Bonds', value: typeof investmentSummary.bonds === 'number' ? investmentSummary.bonds.toLocaleString() : '—' })
    lines.push({ label: 'Payment Frequency', value: investmentSummary.paymentFrequency === 'monthly' ? 'Interest Paid Monthly' : 'Compounded Monthly' })
    lines.push({ label: 'Lockup Period', value: lockupLabels[investmentSummary.lockupPeriod] || '—' })
    return lines
  }, [investmentSummary])

  const formattedIdentitySummary = useMemo(() => {
    if (!identitySummary) return []
    const lines = []
    if (identitySummary.accountType === 'entity' && identitySummary.entityName) {
      lines.push({ label: 'Entity Name', value: identitySummary.entityName })
    }
    const primaryName = [identitySummary.firstName, identitySummary.lastName].filter(Boolean).join(' ')
    if (primaryName) {
      lines.push({ label: identitySummary.accountType === 'entity' ? 'Primary Contact' : 'Holder Name', value: primaryName })
    }
    if (identitySummary.accountType === 'joint') {
      lines.push({ label: 'Joint Holding Type', value: identitySummary.jointHoldingType || '—' })
    }
    const addressParts = [identitySummary.street1, identitySummary.street2, identitySummary.city, identitySummary.state, identitySummary.zip]
      .filter(Boolean)
    if (addressParts.length) lines.push({ label: 'Address', value: addressParts.join(', ') })
    if (identitySummary.dob) lines.push({ label: identitySummary.accountType === 'entity' ? 'Registration Date' : 'Date of Birth', value: identitySummary.dob })
    if (identitySummary.ssn) lines.push({ label: identitySummary.accountType === 'entity' ? 'EIN/TIN' : 'SSN', value: identitySummary.ssn })
    if (identitySummary.accountType === 'entity' && identitySummary.entityName) {
      // already added above
    }
    if (identitySummary.accountType === 'entity' && identitySummary.authorizedRep) {
      const rep = identitySummary.authorizedRep
      if (rep.dob) lines.push({ label: 'Authorized Rep DOB', value: rep.dob })
      if (rep.ssn) lines.push({ label: 'Authorized Rep SSN', value: rep.ssn })
      const repAddress = [rep.address?.street1, rep.address?.street2, rep.address?.city, rep.address?.state, rep.address?.zip].filter(Boolean)
      if (repAddress.length) lines.push({ label: 'Authorized Rep Address', value: repAddress.join(', ') })
    }
    if (identitySummary.accountType === 'joint') {
      const joint = identitySummary.jointHolder
      if (joint) {
        const fullName = [joint.firstName, joint.lastName].filter(Boolean).join(' ')
        if (fullName) lines.push({ label: 'Joint Holder', value: fullName })
        if (joint.email) lines.push({ label: 'Joint Email', value: joint.email })
        if (joint.phone) lines.push({ label: 'Joint Phone', value: joint.phone })
        if (joint.dob) lines.push({ label: 'Joint DOB', value: joint.dob })
        if (joint.ssn) lines.push({ label: 'Joint SSN', value: joint.ssn })
        const jointAddress = [joint.address?.street1, joint.address?.street2, joint.address?.city, joint.address?.state, joint.address?.zip].filter(Boolean)
        if (jointAddress.length) lines.push({ label: 'Joint Address', value: jointAddress.join(', ') })
      }
    }
    return lines
  }, [identitySummary])

  const renderSummary = (items) => {
    if (!items.length) return null
    return (
      <div className={stepStyles.reviewSummary}>
        {items.map(({ label, value }) => (
          <div key={label} className={stepStyles.summaryRow}>
            <span className={stepStyles.summaryLabel}>{label}</span>
            <span className={stepStyles.summaryValue}>{value || '—'}</span>
          </div>
        ))}
      </div>
    )
  }

  useEffect(() => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('currentUserId') : null
    if (!userId) {
      window.location.href = '/'
    }
    const checkAdmin = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user?.isAdmin) {
          window.location.href = '/dashboard'
        }
        // Load locked account type if present to enforce in UI
        if (data.success && data.user?.lockedAccountType) {
          setLockedAccountType(data.user.lockedAccountType)
          setSelectedAccountType(data.user.lockedAccountType)
        }
        
        // Load existing draft investment data if it exists
        const investmentId = localStorage.getItem('currentInvestmentId')
        if (data.success && investmentId) {
          const existingInvestment = (data.user.investments || []).find(inv => inv.id === investmentId && inv.status === 'draft')
          if (existingInvestment) {
            if (existingInvestment.accountType) setSelectedAccountType(existingInvestment.accountType)
            if (typeof existingInvestment.amount === 'number') setInvestmentAmount(existingInvestment.amount)
            if (existingInvestment.paymentFrequency) setInvestmentPaymentFrequency(existingInvestment.paymentFrequency)
            if (existingInvestment.lockupPeriod) setInvestmentLockup(existingInvestment.lockupPeriod)
          }
        }
      } catch {}
    }
    if (userId) checkAdmin()
  }, [])

  // If user switches to IRA and payment frequency is monthly, force compounding
  useEffect(() => {
    if (selectedAccountType === 'ira' && investmentPaymentFrequency === 'monthly') {
      setInvestmentPaymentFrequency('compounding')
    }
  }, [selectedAccountType, investmentPaymentFrequency])

  const shouldShowSummaryStep1 = reviewModeStep1 && isStep1Completed && Boolean(investmentSummary)
  // Keep incomplete steps expanded regardless of active step
  const showStep1Edit = (!isStep1Completed) || (activeStep === 1 && !shouldShowSummaryStep1)
  const isStep1Collapsed = isStep1Completed && !showStep1Edit

  const shouldShowSummaryStep2 = reviewModeStep2 && isStep2Completed && Boolean(identitySummary)
  // Keep incomplete steps expanded regardless of active step
  const showStep2Edit = (!isStep2Completed) || (activeStep === 2 && !shouldShowSummaryStep2)
  const isStep2Collapsed = !step2Unlocked || (isStep2Completed && !showStep2Edit)
  const canFinalize = shouldShowSummaryStep1 && shouldShowSummaryStep2

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <section className={`${stepStyles.card} ${isStep1Collapsed ? stepStyles.collapsed : ''}`}>
          <header className={stepStyles.cardHeader} onClick={() => { setActiveStep(1); setReviewModeStep1(false) }}>
            <div className={stepStyles.stepCircle}>1</div>
            <h2 className={stepStyles.cardTitle}>Investment</h2>
            {isStep1Completed && <div className={stepStyles.checkmark}>✓</div>}
          </header>
          {shouldShowSummaryStep1 && (
            <div className={stepStyles.reviewBlock}>
              {renderSummary(formattedInvestmentSummary)}
              <button
                type="button"
                className={stepStyles.secondaryButton}
                onClick={() => { setReviewModeStep1(false); setActiveStep(1) }}
              >
                Edit Selection
              </button>
            </div>
          )}
          {showStep1Edit && (
            <div className={stepStyles.cardBody}>
              <div className={stepStyles.sectionSpacer}>
                <TabbedInvestmentType
                  onCompleted={() => {}}
                  showContinueButton={false}
                  autoSaveOnSelect
                  onChange={setSelectedAccountType}
                  selectedValue={selectedAccountType}
                  lockedAccountType={lockedAccountType}
                />
              </div>
              <InvestmentForm 
                accountType={selectedAccountType}
                initialAmount={investmentAmount}
                initialPaymentFrequency={investmentPaymentFrequency}
                initialLockup={investmentLockup}
                onValuesChange={(vals) => {
                  if (typeof vals.amount === 'number') setInvestmentAmount(vals.amount)
                  if (vals.paymentFrequency) setInvestmentPaymentFrequency(vals.paymentFrequency)
                  if (vals.lockupPeriod) setInvestmentLockup(vals.lockupPeriod)
                }}
                onReviewSummary={setInvestmentSummary}
                onCompleted={() => {
                  setIsStep1Completed(true)
                  setReviewModeStep1(true)
                  setStep2Unlocked(true)
                  setActiveStep(2)
                }}
                disableAuthGuard
              />
            </div>
          )}
        </section>

        <section className={`${stepStyles.card} ${isStep2Collapsed ? stepStyles.collapsed : ''}`}>
          <header className={stepStyles.cardHeader} onClick={() => { setStep2Unlocked(true); setActiveStep(2); setReviewModeStep2(false) }}>
            <div className={stepStyles.stepCircle}>2</div>
            <h2 className={stepStyles.cardTitle}>Investor Information</h2>
            {isStep2Completed && <div className={stepStyles.checkmark}>✓</div>}
          </header>
          {showStep2Edit && (
            <div className={stepStyles.cardBody}>
              <TabbedResidentialIdentity
                accountType={selectedAccountType}
                onReviewSummary={setIdentitySummary}
                onCompleted={() => {
                  setIsStep2Completed(true)
                  setReviewModeStep2(true)
                  // Do not collapse step 1 unless it was actually completed
                  setReviewModeStep1(v => (isStep1Completed ? true : v))
                  setActiveStep(2)
                }}
              />
            </div>
          )}
          {shouldShowSummaryStep2 && (
            <div className={stepStyles.reviewBlock}>
              {renderSummary(formattedIdentitySummary)}
              <button
                type="button"
                className={`${stepStyles.secondaryButton}`}
                onClick={() => { setReviewModeStep2(false); setActiveStep(2) }}
              >
                Edit Information
              </button>
            </div>
          )}
        </section>
        {canFinalize && (
          <div className={stepStyles.reviewActions}>
            <button
              type="button"
              className={stepStyles.primaryButton}
              onClick={() => router.push('/finalize-investment')}
            >
              Continue
            </button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p className={styles.footerText}>
          Want to explore first?{' '}
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className={styles.linkButton}
          >
            Continue to Dashboard
          </button>
        </p>
      </div>
    </main>
  )
}


