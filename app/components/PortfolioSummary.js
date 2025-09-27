'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './PortfolioSummary.module.css'
import { calculateInvestmentValue, formatCurrency, formatDate, getInvestmentStatus } from '../../lib/investmentCalculations'

export default function PortfolioSummary() {
  const router = useRouter()
  const [userData, setUserData] = useState(null)
  const [portfolioData, setPortfolioData] = useState({
    totalInvested: 0,
    totalPending: 0,
    totalEarnings: 0,
    totalCurrentValue: 0,
    investments: []
  })
  const [appTime, setAppTime] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return

      try {
        // First, run migration to fix any missing fields
        await fetch('/api/migrate-investments', { method: 'POST' })
        
        // Get current app time for calculations
        const timeRes = await fetch('/api/admin/time-machine')
        const timeData = await timeRes.json()
        const currentAppTime = timeData.success ? timeData.appTime : new Date().toISOString()
        setAppTime(currentAppTime)
        
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setUserData(data.user)
          
          // Calculate portfolio metrics from investments using the new calculation functions
          const investments = data.user.investments || []
          const confirmedInvestments = investments.filter(inv => inv.status === 'confirmed')
          const pendingInvestments = investments.filter(inv => inv.status === 'pending')
          const draftInvestments = investments.filter(inv => inv.status === 'draft')
          
          // Calculate totals using the precise calculation functions - only for confirmed investments
          let totalInvested = 0
          let totalEarnings = 0
          let totalCurrentValue = 0
          const investmentDetails = []
          
          confirmedInvestments.forEach(inv => {
            const calculation = calculateInvestmentValue(inv, currentAppTime)
            const status = getInvestmentStatus(inv)
            
            totalInvested += inv.amount || 0
            totalEarnings += calculation.totalEarnings
            totalCurrentValue += calculation.currentValue
            
            investmentDetails.push({
              ...inv,
              calculation,
              status
            })
          })
          
          // Pending investments (waiting for admin confirmation) + drafts
          const totalPending = [...pendingInvestments, ...draftInvestments].reduce((sum, inv) => sum + (inv.amount || 0), 0)
          
          // Add pending investments to display (but without earnings calculations)
          pendingInvestments.forEach(inv => {
            investmentDetails.push({
              ...inv,
              calculation: {
                currentValue: inv.amount,
                totalEarnings: 0,
                monthsElapsed: 0,
                isWithdrawable: false,
                lockdownEndDate: null
              },
              status: {
                status: 'pending',
                statusLabel: 'Pending Confirmation',
                isActive: false,
                isLocked: true
              }
            })
          })
          
          setPortfolioData({
            totalInvested,
            totalPending,
            totalEarnings,
            totalCurrentValue,
            investments: investmentDetails
          })
        }
      } catch (e) {
        console.error('Failed to load portfolio data', e)
      }
    }
    loadData()
  }, [])

  const handleInvestmentClick = (investmentId) => {
    router.push(`/investment-details/${investmentId}`)
  }

  if (!userData) {
    return <div className={styles.loading}>Loading portfolio...</div>
  }

  return (
    <div className={styles.portfolioSection}>
      <div className={styles.welcomeSection}>
        <h2 className={styles.welcomeText}>WELCOME BACK, {userData.firstName?.toUpperCase()} {userData.lastName?.toUpperCase()}</h2>
        <h1 className={styles.portfolioTitle}>YOUR PORTFOLIO</h1>
      </div>
      
      <div className={styles.content}>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL INVESTED</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalInvested)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL PENDING</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalPending)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL EARNINGS</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalEarnings)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>CURRENT VALUE</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalCurrentValue)}</span>
          </div>
        </div>
        
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <div className={styles.chartTitle}>
              <span className={styles.dollarIcon}>$</span>
              <span className={styles.chartTitleText}>TOTAL EARNINGS</span>
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={styles.legendColor}></div>
                <span>Total Earnings</span>
              </div>
            </div>
          </div>
          <div className={styles.chartPlaceholder}>
            <div className={styles.chartGrid}>
              <div className={styles.yAxisLabel}>Valuation</div>
              <div className={styles.chartArea}>
                {/* Empty chart placeholder */}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Investments Section - Moved to Bottom */}
      {portfolioData.investments.length > 0 && (
        <div className={styles.investmentsSection}>
          <h2 className={styles.investmentsTitle}>INVESTMENTS</h2>
          <div className={styles.investmentsList}>
            {portfolioData.investments.map(inv => (
              <div 
                key={inv.id} 
                className={styles.investmentCard}
                onClick={() => handleInvestmentClick(inv.id)}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <div className={styles.investmentAmount}>{formatCurrency(inv.amount)}</div>
                    <div className={styles.investmentType}>
                      {inv.lockupPeriod === '3-year' ? '3Y' : '1Y'} • {inv.paymentFrequency === 'monthly' ? 'Monthly' : 'Compound'}
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${inv.status.isLocked ? styles.locked : styles.available}`}>
                    {inv.status.statusLabel}
                  </span>
                </div>
                <div className={styles.cardBottom}>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Current</span>
                    <span className={styles.compactValue}>{formatCurrency(inv.calculation.currentValue)}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Earnings</span>
                    <span className={styles.compactValue}>{formatCurrency(inv.calculation.totalEarnings)}</span>
                  </div>
                  <div className={styles.viewDetails}>View Details →</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
