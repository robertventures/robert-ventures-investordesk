'use client'

import { useEffect, useState } from 'react'
import Header from '../components/Header'
import styles from './page.module.css'
import stepStyles from '../components/TabbedSignup.module.css'
import TabbedInvestmentType from '../components/TabbedInvestmentType'
import InvestmentForm from '../components/InvestmentForm'
import TabbedResidentialIdentity from '../components/TabbedResidentialIdentity'

export default function InvestmentPage() {
  const [activeStep, setActiveStep] = useState(1)
  const [isStep1Completed, setIsStep1Completed] = useState(false)
  const [isStep2Completed, setIsStep2Completed] = useState(false)

  const [selectedAccountType, setSelectedAccountType] = useState('individual')
  const [investmentAmount, setInvestmentAmount] = useState(0)
  const [investmentPaymentFrequency, setInvestmentPaymentFrequency] = useState('compounding')
  const [investmentLockup, setInvestmentLockup] = useState('1-year')

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

  return (
    <main className={styles.main}>
      <Header />
      <div className={styles.container}>
        <section className={`${stepStyles.card} ${isStep1Completed && activeStep !== 1 ? stepStyles.collapsed : ''}`}>
          <header className={stepStyles.cardHeader} onClick={() => setActiveStep(1)}>
            <div className={stepStyles.stepCircle}>1</div>
            <h2 className={stepStyles.cardTitle}>Investment</h2>
            {isStep1Completed && <div className={stepStyles.checkmark}>✓</div>}
          </header>
          {activeStep === 1 && (
            <div className={stepStyles.cardBody}>
              <div className={stepStyles.sectionSpacer}>
                <TabbedInvestmentType
                  onCompleted={() => {}}
                  showContinueButton={false}
                  autoSaveOnSelect
                  onChange={setSelectedAccountType}
                  selectedValue={selectedAccountType}
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
                onCompleted={() => { setIsStep1Completed(true); setActiveStep(2) }}
                disableAuthGuard
              />
            </div>
          )}
        </section>

        <section className={`${stepStyles.card} ${isStep2Completed && activeStep !== 2 ? stepStyles.collapsed : ''}`}>
          <header className={stepStyles.cardHeader} onClick={() => setActiveStep(2)}>
            <div className={stepStyles.stepCircle}>2</div>
            <h2 className={stepStyles.cardTitle}>Investor Information</h2>
            {isStep2Completed && <div className={stepStyles.checkmark}>✓</div>}
          </header>
          {activeStep === 2 && (
            <div className={stepStyles.cardBody}>
              <TabbedResidentialIdentity accountType={selectedAccountType} onCompleted={() => { setIsStep2Completed(true) }} />
            </div>
          )}
        </section>
      </div>
    </main>
  )
}


