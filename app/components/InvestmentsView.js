'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './InvestmentsView.module.css'
import { calculateInvestmentValue, formatCurrency, formatDate, getInvestmentStatus } from '../../lib/investmentCalculations.js'

export default function InvestmentsView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [userData, setUserData] = useState(null)
  const [portfolioData, setPortfolioData] = useState({
    investments: []
  })
  const [appTime, setAppTime] = useState(null)

  const loadData = useCallback(async () => {
    if (typeof window === 'undefined') return
    
    const userId = localStorage.getItem('currentUserId')
    if (!userId) return

    try {
      // Get current app time for calculations (parallel with user data fetch)
      const timePromise = fetch('/api/admin/time-machine')
      const userPromise = fetch(`/api/users/${userId}${searchParams.get('from') === 'finalize' ? '?fresh=true' : ''}`)
      
      const [timeRes, res] = await Promise.all([timePromise, userPromise])
      const timeData = await timeRes.json()
      const currentAppTime = timeData.success ? timeData.appTime : new Date().toISOString()
      setAppTime(currentAppTime)
      
      const data = await res.json()
      if (data.success && data.user) {
        setUserData(data.user)
        
        // Calculate portfolio metrics from investments using the new calculation functions
        const investments = data.user.investments || []
        // Include active, withdrawal_notice, and withdrawn investments in the dashboard
        const confirmedInvestments = investments.filter(inv => 
          inv.status === 'active' || 
          inv.status === 'withdrawal_notice' || 
          inv.status === 'withdrawn'
        )
        const pendingInvestments = investments.filter(inv => inv.status === 'pending')
        const draftInvestments = investments.filter(inv => inv.status === 'draft')
        
        const investmentDetails = []
        
        confirmedInvestments.forEach(inv => {
          const calculation = calculateInvestmentValue(inv, currentAppTime)
          const status = getInvestmentStatus(inv, currentAppTime)
          
          // Fallback: If confirmedAt is not set, try to get it from activity log
          let confirmedAt = inv.confirmedAt
          if (!confirmedAt && (inv.status === 'active' || inv.status === 'withdrawal_notice' || inv.status === 'withdrawn')) {
            const activity = data.user.activity || []
            const confirmEvent = activity.find(a => a.type === 'investment_confirmed' && a.investmentId === inv.id)
            if (confirmEvent && confirmEvent.date) {
              confirmedAt = confirmEvent.date
            }
          }
          
          investmentDetails.push({
            ...inv,
            confirmedAt,
            calculation,
            status
          })
        })
        
        // Add pending investments to display (but without earnings calculations)
        pendingInvestments.forEach(inv => {
          investmentDetails.push({
            ...inv,
            calculation: {
              currentValue: inv.amount,
              totalEarnings: 0,
              monthsElapsed: 0,
              isWithdrawable: false,
              lockupEndDate: null
            },
            status: {
              status: 'pending',
              statusLabel: 'Pending',
              isActive: false,
              isLocked: true
            }
          })
        })
        
        // Add draft investments to display to allow resuming
        draftInvestments.forEach(inv => {
          investmentDetails.push({
            ...inv,
            calculation: {
              currentValue: inv.amount,
              totalEarnings: 0,
              monthsElapsed: 0,
              isWithdrawable: false,
              lockupEndDate: null
            },
            status: {
              status: 'draft',
              statusLabel: 'Draft',
              isActive: false,
              isLocked: false
            }
          })
        })
        
        // Sort investments: drafts first, then by creation date (most recent first)
        investmentDetails.sort((a, b) => {
          // Drafts always come first
          if (a.status.status === 'draft' && b.status.status !== 'draft') return -1
          if (a.status.status !== 'draft' && b.status.status === 'draft') return 1
          // Within same status group, sort by creation date (most recent first)
          const dateA = new Date(a.createdAt || 0)
          const dateB = new Date(b.createdAt || 0)
          return dateB - dateA
        })

        setPortfolioData({
          investments: investmentDetails
        })
      }
    } catch (e) {
      console.error('Failed to load investments data:', e)
      alert('Failed to load investments data. Please refresh the page. If the problem persists, contact support.')
    }
  }, [searchParams])

  useEffect(() => {
    setMounted(true)
    loadData()
  }, [loadData])

  const handleInvestmentClick = (inv) => {
    if (inv?.status?.status === 'draft') {
      try { localStorage.setItem('currentInvestmentId', inv.id) } catch {}
      router.push('/investment')
      return
    }
    router.push(`/investment-details/${inv.id}`)
  }

  // Prevent hydration mismatch by not rendering until mounted on client
  if (!mounted || !userData) {
    return <div className={styles.loading}>Loading investments...</div>
  }

  return (
    <div className={styles.investmentsView}>
      <div className={styles.investmentsContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>YOUR INVESTMENTS</h1>
          <p className={styles.subtitle}>View and manage all your investments</p>
        </div>

        {/* Investments Section - Always visible with empty state */}
        <div className={styles.investmentsSection}>
        {portfolioData.investments.length === 0 ? (
          <div className={styles.investmentsList}>
            <div className={styles.investmentCard} style={{ cursor: 'default', justifyContent: 'center' }}>
              <div className={styles.cardLeft}>
                <div className={styles.amountLabel}>No investments yet</div>
                <div className={styles.investmentType}>Start your first investment to begin earning</div>
              </div>
              <div className={styles.cardActions}>
                <div className={styles.viewDetails} onClick={() => {
                  try { localStorage.removeItem('currentInvestmentId') } catch {}
                  router.push('/investment?context=new')
                }}>Start an Investment →</div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.investmentsList}>
            {portfolioData.investments.map(inv => (
              <div 
                key={inv.id} 
                className={styles.investmentCard}
                onClick={() => handleInvestmentClick(inv)}
              >
                <div className={styles.cardLeft}>
                  <div className={styles.amountLabel}>Investment Amount</div>
                  <div className={styles.investmentAmount}>{formatCurrency(inv.amount)}</div>
                  <div className={styles.investmentType}>
                    {inv.lockupPeriod === '3-year' ? '3Y' : '1Y'} • {inv.paymentFrequency === 'monthly' ? 'Monthly' : 'Compound'}
                  </div>
                </div>
                <span className={`${styles.statusBadge} ${inv.status.status === 'withdrawn' ? styles.withdrawn : inv.status.status === 'draft' ? styles.draft : (inv.status.isLocked ? styles.locked : styles.available)}`}>
                  {inv.status.statusLabel === 'Available for Withdrawal' ? 'Available' : inv.status.statusLabel}
                </span>
                <div className={styles.cardBottom}>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Investment</span>
                    <span className={styles.investmentBadge}>Investment {String(inv.id).slice(-6)}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Confirmation Date</span>
                    <span className={styles.compactValue}>{inv.confirmedAt ? formatDate(inv.confirmedAt) : (inv.status.status === 'pending' ? 'Pending' : '—')}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Current Bond Value</span>
                    <span className={styles.compactValue}>{formatCurrency(inv.calculation.currentValue)}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Earnings</span>
                    <span className={styles.compactValue}>{formatCurrency(inv.calculation.totalEarnings)}</span>
                  </div>
                  <div className={styles.cardActions}>
                    {inv.status.status === 'draft' && (
                      <button
                        className={styles.deleteDraft}
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (!confirm('Delete this draft? This cannot be undone.')) return
                          try {
                            if (typeof window === 'undefined') return
                            
                            const userId = localStorage.getItem('currentUserId')
                            const res = await fetch(`/api/users/${userId}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ _action: 'deleteInvestment', investmentId: inv.id })
                            })
                            const data = await res.json()
                            if (!data.success) {
                              alert(data.error || 'Failed to delete draft')
                              return
                            }
                            await loadData()
                          } catch (e) {
                            console.error('Failed to delete draft', e)
                            alert('Failed to delete draft')
                          }
                        }}
                      >
                        Delete Draft
                      </button>
                    )}
                    <div className={styles.viewDetails}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInvestmentClick(inv)
                      }}
                    >
                      {inv.status.status === 'draft' ? 'Resume Draft →' : 'View Details →'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

