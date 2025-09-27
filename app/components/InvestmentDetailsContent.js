'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './InvestmentDetailsContent.module.css'
import { calculateInvestmentValue, formatCurrency, formatDate, getInvestmentStatus } from '../../lib/investmentCalculations'

export default function InvestmentDetailsContent({ investmentId }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('investment-info')
  const [investmentData, setInvestmentData] = useState(null)
  const [userData, setUserData] = useState(null)
  const [appTime, setAppTime] = useState(null)
  const [isWithdrawing, setIsWithdrawing] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) {
        router.push('/')
        return
      }

      try {
        // Get current app time for calculations
        const timeRes = await fetch('/api/admin/time-machine')
        const timeData = await timeRes.json()
        const currentAppTime = timeData.success ? timeData.appTime : new Date().toISOString()
        setAppTime(currentAppTime)

        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          const investment = data.user.investments?.find(inv => inv.id === investmentId)
          if (investment) {
            setInvestmentData(investment)
            setUserData(data.user)
          } else {
            router.push('/dashboard')
          }
        }
      } catch (e) {
        console.error('Failed to load investment data', e)
        router.push('/dashboard')
      }
    }
    loadData()
  }, [investmentId, router])

  const handleWithdrawal = async () => {
    if (!investmentData || !userData) return

    setIsWithdrawing(true)
    
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData.id, investmentId: investmentData.id })
      })
      
      const data = await res.json()
      
      if (data.success) {
        alert('Withdrawal request submitted successfully!')
        router.push('/dashboard')
      } else {
        alert(data.error || 'Failed to process withdrawal')
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error)
      alert('An error occurred while processing the withdrawal')
    } finally {
      setIsWithdrawing(false)
    }
  }

  if (!investmentData || !userData) {
    return <div className={styles.loading}>Loading investment details...</div>
  }

  // Use new calculation functions
  const calculation = calculateInvestmentValue(investmentData, appTime)
  const status = getInvestmentStatus(investmentData)
  
  // Legacy format for existing UI
  const totalEarnings = calculation.totalEarnings
  const monthlyEarnings = calculation.monthlyInterestAmount
  const monthsElapsed = calculation.monthsElapsed

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  return (
    <div className={styles.content}>
      {/* Investment Identifiers */}
      <div className={styles.identifierSection}>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>TYPE</span>
          <span className={styles.identifierValue}>{investmentData.accountType || 'Individual'}</span>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>ID</span>
          <div className={styles.identifierWithCopy}>
            <span className={styles.identifierValue}>{investmentId}</span>
            <button 
              onClick={() => copyToClipboard(investmentId)}
              className={styles.copyButton}
            >
              📋
            </button>
          </div>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>CONTACT ID</span>
          <div className={styles.identifierWithCopy}>
            <span className={styles.identifierValue}>{userData.id}</span>
            <button 
              onClick={() => copyToClipboard(userData.id)}
              className={styles.copyButton}
            >
              📋
            </button>
          </div>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>SIGNATURE DATE</span>
          <span className={styles.identifierValue}>{formatDate(investmentData.signedAt)}</span>
        </div>
      </div>

      {/* Tabs - Only show if withdrawal is available */}
      {calculation.isWithdrawable && (
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === 'investment-info' ? styles.active : ''}`}
            onClick={() => setActiveTab('investment-info')}
          >
            📈 INVESTMENT INFO
          </button>
          <button 
            className={`${styles.tab} ${activeTab === 'withdrawal' ? styles.active : ''}`}
            onClick={() => setActiveTab('withdrawal')}
          >
            💰 WITHDRAWAL
          </button>
        </div>
      )}

      {/* Tab Content */}
      {(activeTab === 'investment-info' || !calculation.isWithdrawable) && (
        <div className={styles.tabContent}>
          {/* Value Summary - Prominent display */}
          <div className={styles.valueCard}>
            <div className={styles.valueHeader}>
              <h3 className={styles.valueTitle}>Investment Value</h3>
              <span className={`${styles.statusBadge} ${status.isLocked ? styles.pending : styles.completed}`}>
                {status.statusLabel}
              </span>
            </div>
            <div className={styles.valueGrid}>
              <div className={styles.valueItem}>
                <span className={styles.valueAmount}>{formatCurrency(calculation.currentValue)}</span>
                <span className={styles.valueLabel}>Current Value</span>
              </div>
              <div className={styles.valueItem}>
                <span className={styles.valueAmount}>{formatCurrency(investmentData.amount)}</span>
                <span className={styles.valueLabel}>Original Investment</span>
              </div>
              <div className={styles.valueItem}>
                <span className={styles.valueAmount}>{formatCurrency(calculation.totalEarnings)}</span>
                <span className={styles.valueLabel}>Total Earnings</span>
              </div>
              {investmentData.status === 'confirmed' && (
                <div className={styles.valueItem}>
                  <span className={styles.valueAmount}>{calculation.monthsElapsed.toFixed(1)}</span>
                  <span className={styles.valueLabel}>Months Elapsed</span>
                </div>
              )}
            </div>
          </div>

          {/* Investment Details */}
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h3 className={styles.detailsTitle}>Investment Details</h3>
            </div>
            <div className={styles.detailsContent}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>ACCOUNT TYPE</span>
                  <span className={styles.detailValue}>{investmentData.accountType || 'Individual'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>LOCKUP PERIOD</span>
                  <span className={styles.detailValue}>
                    {investmentData.lockupPeriod === '3-year' ? '3 Years' : '1 Year'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>INTEREST RATE</span>
                  <span className={styles.detailValue}>{investmentData.lockupPeriod === '1-year' ? '8%' : '10%'} APY</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>PAYMENT TYPE</span>
                  <span className={styles.detailValue}>
                    {investmentData.paymentFrequency === 'monthly' ? 'Monthly Interest' : 'Compounding'}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>BONDS</span>
                  <span className={styles.detailValue}>{investmentData.bonds || '0'}</span>
                </div>
                {investmentData.status === 'confirmed' && investmentData.confirmedAt && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>CONFIRMED DATE</span>
                    <span className={styles.detailValue}>{formatDate(investmentData.confirmedAt)}</span>
                  </div>
                )}
                {investmentData.status === 'confirmed' && calculation.lockdownEndDate && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>LOCKDOWN END DATE</span>
                    <span className={styles.detailValue}>{formatDate(calculation.lockdownEndDate)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'withdrawal' && calculation.isWithdrawable && (
        <div className={styles.tabContent}>
          <div className={styles.withdrawalCard}>
            <h3 className={styles.withdrawalTitle}>Withdrawal Available</h3>
            <div className={styles.withdrawalInfo}>
              <p className={styles.withdrawalText}>
                Your investment lockdown period has ended. You can now withdraw the full amount.
              </p>
              <div className={styles.withdrawalBreakdown}>
                <div className={styles.breakdownItem}>
                  <span className={styles.detailLabel}>PRINCIPAL AMOUNT</span>
                  <span className={styles.detailValue}>{formatCurrency(investmentData.amount)}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.detailLabel}>TOTAL EARNINGS</span>
                  <span className={styles.detailValue}>{formatCurrency(calculation.totalEarnings)}</span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.detailLabel}>TOTAL WITHDRAWAL</span>
                  <span className={styles.detailValue}><strong>{formatCurrency(calculation.currentValue)}</strong></span>
                </div>
              </div>
              <button
                onClick={handleWithdrawal}
                disabled={isWithdrawing}
                className={styles.withdrawButton}
              >
                {isWithdrawing ? 'Processing Withdrawal...' : `Withdraw ${formatCurrency(calculation.currentValue)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
