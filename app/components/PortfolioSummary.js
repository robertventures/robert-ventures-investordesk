'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './PortfolioSummary.module.css'
import TransactionsList from './TransactionsList'
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
  const [chartSeries, setChartSeries] = useState([])
  const [chartWidth, setChartWidth] = useState(600)
  const chartAreaRef = useRef(null)

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return

      try {
        // First, run migration to fix any missing fields
        await fetch('/api/migrate-investments', { method: 'POST' })
        // Ensure transaction events (distributions/compounding) are generated
        await fetch('/api/migrate-transactions', { method: 'POST' })
        
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
          const transactions = Array.isArray(data.user.transactions) ? data.user.transactions : []
          
          // Calculate totals using the precise calculation functions - only for confirmed investments
          let totalInvested = 0
          let totalEarnings = 0
          let totalCurrentValue = 0
          const investmentDetails = []
          
          confirmedInvestments.forEach(inv => {
            const calculation = calculateInvestmentValue(inv, currentAppTime)
            const status = getInvestmentStatus(inv, currentAppTime)
            
            totalInvested += inv.amount || 0
            // For monthly payout investments, sum paid distributions from transactions instead of accrued calc
            if (inv.paymentFrequency === 'monthly') {
              const paid = transactions
                .filter(ev => ev.type === 'monthly_distribution' && ev.investmentId === inv.id && new Date(ev.date) <= new Date(currentAppTime))
                .reduce((sum, ev) => sum + (Number(ev.amount) || 0), 0)
              totalEarnings += Math.round(paid * 100) / 100
            } else {
              totalEarnings += calculation.totalEarnings
            }
            // Portfolio current value only includes compounding growth
            if (inv.paymentFrequency === 'monthly') {
              // Monthly payout investments: keep principal only
              totalCurrentValue += inv.amount || 0
            } else {
              // Compounding investments: include accrued value
              totalCurrentValue += calculation.currentValue
            }
            
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
          
          const nextPortfolio = {
            totalInvested,
            totalPending,
            totalEarnings,
            totalCurrentValue,
            investments: investmentDetails
          }
          setPortfolioData(nextPortfolio)

          // Build valuation series for last 23 month-ends plus current app time as the final point
          const end = new Date(currentAppTime)
          const start = new Date(end)
          start.setMonth(start.getMonth() - 23)

          const points = []
          const confirmed = confirmedInvestments
          // 23 historical month-end points
          for (let i = 0; i < 23; i++) {
            const d = new Date(start)
            d.setMonth(start.getMonth() + i)
            const asOf = new Date(d.getFullYear(), d.getMonth() + 1, 0)
            const asOfIso = asOf.toISOString()
            let total = 0
            confirmed.forEach(inv => {
              if (inv.confirmedAt && new Date(inv.confirmedAt) <= asOf) {
                const calc = calculateInvestmentValue(inv, asOfIso)
                total += calc.currentValue
              }
            })
            points.push({ date: asOf, value: Math.round(total * 100) / 100 })
          }
          // Final point at current app time to match current investment info
          {
            const asOf = new Date(end)
            const asOfIso = asOf.toISOString()
            let total = 0
            confirmed.forEach(inv => {
              if (inv.confirmedAt && new Date(inv.confirmedAt) <= asOf) {
                const calc = calculateInvestmentValue(inv, asOfIso)
                total += calc.currentValue
              }
            })
            points.push({ date: asOf, value: Math.round(total * 100) / 100 })
          }
          setChartSeries(points)
        }
      } catch (e) {
        console.error('Failed to load portfolio data', e)
      }
    }
    loadData()
  }, [])

  // Observe width of chart area for responsiveness
  useEffect(() => {
    if (!chartAreaRef.current) return
    const el = chartAreaRef.current
    const ro = new ResizeObserver(entries => {
      if (!entries || !entries[0]) return
      const w = Math.max(320, Math.floor(entries[0].contentRect.width))
      setChartWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
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
            <span className={styles.metricLabel}>CURRENT VALUE</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalCurrentValue)}</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricLabel}>TOTAL EARNINGS</span>
            <span className={styles.metricValue}>{formatCurrency(portfolioData.totalEarnings)}</span>
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
              <div className={styles.chartArea} ref={chartAreaRef}>
                {chartSeries.length > 0 && (() => {
                  const width = Math.max(320, chartWidth)
                  const height = 240
                  const padding = 28
                  const values = chartSeries.map(p => p.value)
                  const minV = Math.min(...values)
                  const maxV = Math.max(...values)
                  const range = Math.max(1, maxV - minV)
                  const xStep = (width - padding * 2) / Math.max(1, chartSeries.length - 1)
                  const points = chartSeries.map((p, i) => {
                    const x = padding + i * xStep
                    const y = padding + (1 - (p.value - minV) / range) * (height - padding * 2)
                    return { x, y }
                  })
                  const path = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')
                  const areaPath = `${path} L ${padding + (chartSeries.length - 1) * xStep} ${height - padding} L ${padding} ${height - padding} Z`
                  // Y-axis ticks (min to max)
                  const yTickCount = 4
                  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
                    const v = minV + (range * (i / yTickCount))
                    const y = padding + (1 - (v - minV) / range) * (height - padding * 2)
                    return { v, y }
                  })
                  // X-axis labels (evenly spaced)
                  const xLabelCount = width < 480 ? 4 : 7
                  const lastIdx = chartSeries.length - 1
                  const step = Math.max(1, Math.round(lastIdx / (xLabelCount - 1)))
                  const labelIndices = Array.from({ length: xLabelCount }, (_, i) => Math.min(i * step, lastIdx))
                  
                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height}>
                      <defs>
                        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {/* Gridlines */}
                      {yTicks.map((t, i) => (
                        <line key={`grid-${i}`} x1={padding} y1={t.y} x2={width - padding} y2={t.y} stroke="#e5e7eb" strokeDasharray="3,3" />
                      ))}
                      {/* Axes */}
                      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#9ca3af" strokeWidth="1" />
                      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#9ca3af" strokeWidth="1" />
                      {/* Y-axis labels */}
                      {yTicks.map((t, i) => (
                        <text key={`ylabel-${i}`} x={padding - 8} y={t.y} textAnchor="end" dominantBaseline="middle" fill="#6b7280" fontSize="10">
                          {formatCurrency(Math.round(t.v))}
                        </text>
                      ))}
                      {/* X-axis labels */}
                      {labelIndices.map((idx) => {
                        const p = points[idx]
                        const d = chartSeries[idx].date
                        const label = new Date(d).toLocaleString('en-US', { month: 'short' })
                        return (
                          <text key={`xlabel-${idx}`} x={p.x} y={height - padding + 14} textAnchor="middle" fill="#6b7280" fontSize="10">
                            {label}
                          </text>
                        )
                      })}
                      {/* Series */}
                      <path d={areaPath} fill="url(#grad)" stroke="none" />
                      <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
                      {points.map((pt, i) => (
                        <circle key={i} cx={pt.x} cy={pt.y} r="2.5" fill="#3b82f6" />
                      ))}
                    </svg>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Activity embedded on main dashboard */}
      <div className={styles.transactionsWrapper}>
        <h2 className={styles.investmentsTitle}>ACTIVITY</h2>
        <TransactionsList limit={5} />
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
                    <div className={styles.amountLabel}>Investment Amount</div>
                    <div className={styles.investmentAmount}>{formatCurrency(inv.amount)}</div>
                    <div className={styles.investmentType}>
                      {inv.lockupPeriod === '3-year' ? '3Y' : '1Y'} • {inv.paymentFrequency === 'monthly' ? 'Monthly' : 'Compound'}
                    </div>
                  </div>
                  <span className={`${styles.statusBadge} ${inv.status.isLocked ? styles.locked : styles.available}`}>
                    {inv.status.statusLabel === 'Available for Withdrawal' ? 'Available' : inv.status.statusLabel}
                  </span>
                </div>
                <div className={styles.cardBottom}>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Investment</span>
                    <span className={styles.investmentBadge}>Investment {String(inv.id).slice(-6)}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Approval Date</span>
                    <span className={styles.compactValue}>{inv.confirmedAt ? formatDate(inv.confirmedAt) : 'Pending Approval'}</span>
                  </div>
                  <div className={styles.compactMetric}>
                    <span className={styles.compactLabel}>Current Bond Value</span>
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
