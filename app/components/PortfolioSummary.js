'use client'
import { useEffect, useState } from 'react'
import styles from './PortfolioSummary.module.css'

export default function PortfolioSummary() {
  const [userData, setUserData] = useState(null)
  const [portfolioData, setPortfolioData] = useState({
    totalInvested: 0,
    totalPending: 0,
    totalEarnings: 0
  })

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return

      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setUserData(data.user)
          
          // Calculate portfolio metrics from investments
          const investments = data.user.investments || []
          const approvedInvestments = investments.filter(inv => inv.status === 'approved' || inv.status === 'invested')
          const totalInvested = approvedInvestments.reduce((sum, inv) => sum + (inv.amount || 0), 0)
          const totalPending = investments
            .filter(inv => inv.status !== 'approved' && inv.status !== 'invested')
            .reduce((sum, inv) => sum + (inv.amount || 0), 0)
          
          // Calculate actual earnings based on payment frequency and time elapsed
          const totalEarnings = approvedInvestments.reduce((sum, inv) => {
            if (!inv.amount || !inv.paymentFrequency || !inv.lockupPeriod) return sum
            
            const investmentDate = new Date(inv.createdAt || inv.signedAt || new Date())
            const now = new Date()
            const monthsElapsed = Math.floor((now - investmentDate) / (1000 * 60 * 60 * 24 * 30.44)) // Average days per month
            
            if (inv.paymentFrequency === 'monthly') {
              // For monthly payments, calculate cumulative monthly earnings
              const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
              const monthlyRate = annualRate / 12
              const monthlyEarnings = inv.amount * monthlyRate
              return sum + (monthlyEarnings * monthsElapsed)
            } else if (inv.paymentFrequency === 'compounding') {
              // For compounding, calculate compound interest
              const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
              const monthlyRate = annualRate / 12
              const compoundEarnings = inv.amount * Math.pow(1 + monthlyRate, monthsElapsed) - inv.amount
              return sum + compoundEarnings
            }
            
            return sum
          }, 0)
          
          setPortfolioData({
            totalInvested,
            totalPending,
            totalEarnings
          })
        }
      } catch (e) {
        console.error('Failed to load portfolio data', e)
      }
    }
    loadData()
  }, [])

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
            <span className={styles.metricValue}>${portfolioData.totalInvested.toLocaleString()}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL PENDING</span>
            <span className={styles.metricValue}>${portfolioData.totalPending.toLocaleString()}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL EARNINGS</span>
            <span className={styles.metricValue}>${portfolioData.totalEarnings.toLocaleString()}</span>
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
    </div>
  )
}
