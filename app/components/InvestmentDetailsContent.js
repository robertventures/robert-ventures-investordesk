'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './InvestmentDetailsContent.module.css'
import TransactionsList from './TransactionsList'
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
  const status = getInvestmentStatus(investmentData, appTime)
  
  // Legacy format for existing UI
  let totalEarnings = calculation.totalEarnings
  let monthlyEarnings = calculation.monthlyInterestAmount
  // For monthly payout investments, compute earnings from paid distributions
  if (userData && Array.isArray(userData.transactions) && investmentData.paymentFrequency === 'monthly') {
    const paid = userData.transactions
      .filter(ev => ev.type === 'monthly_distribution' && ev.investmentId === investmentId)
      .reduce((sum, ev) => sum + (Number(ev.amount) || 0), 0)
    totalEarnings = Math.round(paid * 100) / 100
    // Use the configured monthly payout amount if available; otherwise keep calc
    monthlyEarnings = calculation.monthlyInterestAmount
  }
  const monthsElapsed = calculation.monthsElapsed

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  // Projections: compounding vs monthly payout
  const apy = investmentData.lockupPeriod === '3-year' ? 0.10 : 0.08
  const monthlyRate = apy / 12
  const isMonthly = investmentData.paymentFrequency === 'monthly'
  const baseValue = calculation.currentValue
  let growthProjections = []
  if (isMonthly) {
    const monthlyPayout = Math.round(investmentData.amount * monthlyRate * 100) / 100
    const projectRevenue = (months) => Math.round(monthlyPayout * months * 100) / 100
    growthProjections = [
      { label: '1 Year', months: 12 },
      { label: '5 Years', months: 60 },
      { label: '10 Years', months: 120 }
    ].map(({ label, months }) => ({ label, projectedRevenue: projectRevenue(months), monthlyPayout }))
  } else {
    const projectMonths = (months) => Math.round(baseValue * Math.pow(1 + monthlyRate, months) * 100) / 100
    growthProjections = [
      { label: '1 Year', months: 12 },
      { label: '5 Years', months: 60 },
      { label: '10 Years', months: 120 }
    ].map(({ label, months }) => {
      const projected = projectMonths(months)
      return { label, projected, growth: Math.round((projected - baseValue) * 100) / 100 }
    })
  }

  return (
    <div className={styles.content}>
      {/* Investment Identifiers */}
      <div className={styles.identifierSection}>
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

      {/* Tabs - Always show Investment Info and Activity; include Withdrawal when available */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'investment-info' ? styles.active : ''}`}
          onClick={() => setActiveTab('investment-info')}
        >
          📈 INVESTMENT INFO
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'activity' ? styles.active : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          🧾 ACTIVITY
        </button>
        {calculation.isWithdrawable && (
          <button 
            className={`${styles.tab} ${activeTab === 'withdrawal' ? styles.active : ''}`}
            onClick={() => setActiveTab('withdrawal')}
          >
            💰 WITHDRAWAL
          </button>
        )}
      </div>

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
                <span className={styles.valueAmount}>{formatCurrency(investmentData.amount)}</span>
                <span className={styles.valueLabel}>Original Investment</span>
              </div>
              <div className={styles.valueItem}>
                <span className={styles.valueAmount}>{formatCurrency(calculation.currentValue)}</span>
                <span className={styles.valueLabel}>Current Value</span>
              </div>
              <div className={styles.valueItem}>
                <span className={styles.valueAmount}>{formatCurrency(calculation.totalEarnings)}</span>
                <span className={styles.valueLabel}>Total Earnings</span>
              </div>
              
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
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>BOND ISSUED</span>
                  <span className={styles.detailValue}>{investmentData.submittedAt ? formatDate(investmentData.submittedAt) : (investmentData.createdAt ? formatDate(investmentData.createdAt) : '-')}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>BOND APPROVED</span>
                  <span className={styles.detailValue}>{investmentData.confirmedAt ? formatDate(investmentData.confirmedAt) : 'Pending Approval'}</span>
                </div>
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

      {activeTab === 'activity' && (
        <div className={styles.tabContent}>
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h3 className={styles.detailsTitle}>Activity</h3>
            </div>
            <div className={styles.detailsContent}>
              <TransactionsList limit={null} showViewAll={false} filterInvestmentId={investmentId} />
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
              <div className={styles.withdrawalProjection}>
                <div className={styles.projectionHeader}>
                  <h4 className={styles.projectionTitle}>
                    {isMonthly ? 'Projected Payouts if You Keep Investing' : 'Projected Growth if You Keep Investing'}
                  </h4>
                  <span className={styles.projectionSub}>
                    {isMonthly ? `Assumes monthly payouts at ${Math.round(apy * 100)}% APY` : `Assumes monthly compounding at ${Math.round(apy * 100)}% APY`}
                  </span>
                </div>
                <table className={styles.projectionTable}>
                  <thead>
                    <tr>
                      <th>Horizon</th>
                      {isMonthly ? <th>Projected Revenue</th> : <th>Projected Value</th>}
                      {!isMonthly && <th>Additional Growth</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {isMonthly ? (
                      growthProjections.map(row => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{formatCurrency(row.projectedRevenue)}</td>
                        </tr>
                      ))
                    ) : (
                      growthProjections.map(row => (
                        <tr key={row.label}>
                          <td>{row.label}</td>
                          <td>{formatCurrency(row.projected)}</td>
                          <td>{formatCurrency(row.growth)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <div className={styles.projectionNote}>For illustration only. Actual returns may vary.</div>
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
