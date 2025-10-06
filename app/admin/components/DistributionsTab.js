'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './DistributionsTab.module.css'

/**
 * Distributions tab showing all monthly payments and compounding calculations
 */
export default function DistributionsTab({ users }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all', 'monthly_distribution', 'monthly_compounded'
  const [groupBy, setGroupBy] = useState('date') // 'date', 'user', 'investment'

  // Collect all distribution events from all users
  const allDistributions = useMemo(() => {
    const events = []
    
    users.forEach(user => {
      if (Array.isArray(user.activity)) {
        user.activity.forEach(event => {
          // Only include distribution-related events
          if (event.type === 'monthly_distribution' || event.type === 'monthly_compounded') {
            events.push({
              ...event,
              userId: user.id,
              userEmail: user.email,
              userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
            })
          }
        })
      }
    })

    // Sort by date (most recent first)
    events.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    return events
  }, [users])

  // Filter distributions based on search term and filter type
  const filteredDistributions = useMemo(() => {
    let filtered = allDistributions

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.type === filterType)
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(event => {
        return (
          event.userName?.toLowerCase().includes(term) ||
          event.userEmail?.toLowerCase().includes(term) ||
          event.userId?.toLowerCase().includes(term) ||
          event.investmentId?.toLowerCase().includes(term) ||
          event.id?.toLowerCase().includes(term)
        )
      })
    }

    return filtered
  }, [allDistributions, searchTerm, filterType])

  // Calculate summary statistics
  const summary = useMemo(() => {
    const payouts = filteredDistributions.filter(e => e.type === 'monthly_distribution')
    const compounded = filteredDistributions.filter(e => e.type === 'monthly_compounded')
    
    const totalPayouts = payouts.reduce((sum, e) => sum + (e.amount || 0), 0)
    const totalCompounded = compounded.reduce((sum, e) => sum + (e.amount || 0), 0)
    const totalDistributions = totalPayouts + totalCompounded

    return {
      totalDistributions,
      totalPayouts,
      totalCompounded,
      payoutCount: payouts.length,
      compoundedCount: compounded.length,
      totalCount: filteredDistributions.length
    }
  }, [filteredDistributions])

  // Group distributions by month
  const groupedByMonth = useMemo(() => {
    const groups = {}
    
    filteredDistributions.forEach(event => {
      if (!event.date) return
      
      const date = new Date(event.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!groups[monthKey]) {
        groups[monthKey] = {
          monthKey,
          displayMonth: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          events: [],
          totalAmount: 0,
          payoutAmount: 0,
          compoundedAmount: 0
        }
      }
      
      groups[monthKey].events.push(event)
      groups[monthKey].totalAmount += event.amount || 0
      
      if (event.type === 'monthly_distribution') {
        groups[monthKey].payoutAmount += event.amount || 0
      } else if (event.type === 'monthly_compounded') {
        groups[monthKey].compoundedAmount += event.amount || 0
      }
    })

    return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
  }, [filteredDistributions])

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  }

  const getEventIcon = (eventType) => {
    return eventType === 'monthly_distribution' ? '💸' : '📈'
  }

  const getEventTitle = (eventType) => {
    return eventType === 'monthly_distribution' ? 'Monthly Payout' : 'Compounded Interest'
  }

  const getEventColor = (eventType) => {
    return eventType === 'monthly_distribution' ? '#5b21b6' : '#0369a1'
  }

  return (
    <div className={styles.distributionsTab}>
      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total Distributions</div>
          <div className={styles.summaryValue}>{formatCurrency(summary.totalDistributions)}</div>
          <div className={styles.summarySubtext}>{summary.totalCount} transactions</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>💸 Monthly Payouts</div>
          <div className={styles.summaryValue}>{formatCurrency(summary.totalPayouts)}</div>
          <div className={styles.summarySubtext}>{summary.payoutCount} payouts</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>📈 Compounded Interest</div>
          <div className={styles.summaryValue}>{formatCurrency(summary.totalCompounded)}</div>
          <div className={styles.summarySubtext}>{summary.compoundedCount} calculations</div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterButtons}>
          <button
            className={`${styles.filterButton} ${filterType === 'all' ? styles.active : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Distributions
          </button>
          <button
            className={`${styles.filterButton} ${filterType === 'monthly_distribution' ? styles.active : ''}`}
            onClick={() => setFilterType('monthly_distribution')}
          >
            💸 Payouts
          </button>
          <button
            className={`${styles.filterButton} ${filterType === 'monthly_compounded' ? styles.active : ''}`}
            onClick={() => setFilterType('monthly_compounded')}
          >
            📈 Compounded
          </button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search by user, email, investment ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button 
              className={styles.clearButton} 
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Grouped by Month View */}
      <div className={styles.monthlyGroups}>
        {groupedByMonth.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <div className={styles.emptyTitle}>No distributions found</div>
            <div className={styles.emptyText}>
              {searchTerm ? `No distributions found matching "${searchTerm}"` : 'No distributions have been processed yet'}
            </div>
          </div>
        ) : (
          groupedByMonth.map(monthGroup => (
            <div key={monthGroup.monthKey} className={styles.monthGroup}>
              <div className={styles.monthHeader}>
                <div className={styles.monthTitle}>
                  <span className={styles.monthName}>{monthGroup.displayMonth}</span>
                  <span className={styles.monthCount}>({monthGroup.events.length} distributions)</span>
                </div>
                <div className={styles.monthSummary}>
                  <span className={styles.monthTotal}>Total: {formatCurrency(monthGroup.totalAmount)}</span>
                  {monthGroup.payoutAmount > 0 && (
                    <span className={styles.monthBreakdown}>
                      💸 {formatCurrency(monthGroup.payoutAmount)}
                    </span>
                  )}
                  {monthGroup.compoundedAmount > 0 && (
                    <span className={styles.monthBreakdown}>
                      📈 {formatCurrency(monthGroup.compoundedAmount)}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>User</th>
                      <th>Email</th>
                      <th>Investment ID</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Month Index</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthGroup.events.map(event => {
                      const date = event.date ? new Date(event.date).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric'
                      }) : '-'
                      
                      return (
                        <tr key={event.id} className={styles.eventRow}>
                          <td>
                            <div className={styles.eventTypeCell}>
                              <span 
                                className={styles.eventIcon} 
                                style={{ color: getEventColor(event.type) }}
                              >
                                {getEventIcon(event.type)}
                              </span>
                              <span className={styles.eventLabel}>{getEventTitle(event.type)}</span>
                            </div>
                          </td>
                          <td>
                            <button
                              className={styles.linkButton}
                              onClick={() => router.push(`/admin/users/${event.userId}`)}
                            >
                              {event.userName}
                            </button>
                          </td>
                          <td className={styles.emailCell}>{event.userEmail}</td>
                          <td>
                            {event.investmentId ? (
                              <button
                                className={styles.linkButton}
                                onClick={() => router.push(`/admin/investments/${event.investmentId}`)}
                              >
                                {event.investmentId}
                              </button>
                            ) : (
                              <span className={styles.naText}>-</span>
                            )}
                          </td>
                          <td>
                            <strong className={styles.amount}>{formatCurrency(event.amount)}</strong>
                          </td>
                          <td className={styles.dateCell}>{date}</td>
                          <td className={styles.monthIndexCell}>
                            {event.monthIndex != null ? `Month ${event.monthIndex}` : '-'}
                          </td>
                          <td>
                            <button
                              className={styles.viewButton}
                              onClick={() => router.push(`/admin/users/${event.userId}`)}
                            >
                              View User
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

