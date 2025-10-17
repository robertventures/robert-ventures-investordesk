'use client'
import { useEffect, useState, useMemo, memo } from 'react'
import { useRouter } from 'next/navigation'
import styles from './TransactionsList.module.css'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
}

function eventMeta(ev) {
  switch (ev.type) {
    case 'account_created':
      return { icon: '👤', iconClass: styles.created, title: 'Account Created' }
    case 'investment':
      return { icon: '🧾', iconClass: styles.created, title: 'Investment' }
    case 'investment_created':
      return { icon: '🧾', iconClass: styles.created, title: 'Investment Created' }
    case 'investment_approved':
      return { icon: '✓', iconClass: styles.confirmed, title: 'Investment Approved' }
    case 'investment_confirmed':
      return { icon: '✅', iconClass: styles.confirmed, title: 'Investment Confirmed' }
    case 'investment_rejected':
      return { icon: '❌', iconClass: styles.rejected, title: 'Investment Rejected' }
    case 'distribution':
      return { icon: '💸', iconClass: styles.distribution, title: 'Distribution' }
    case 'monthly_distribution':
      return { icon: '💸', iconClass: styles.distribution, title: 'Monthly Payout' }
    case 'contribution':
      return { icon: '📈', iconClass: styles.distribution, title: 'Contribution' }
    case 'monthly_compounded':
      return { icon: '📈', iconClass: styles.distribution, title: 'Monthly Compounded' }
    case 'withdrawal_requested':
      return { icon: '🏦', iconClass: styles.withdrawal, title: 'Withdrawal Requested' }
    case 'withdrawal_notice_started':
      return { icon: '⏳', iconClass: styles.withdrawal, title: 'Withdrawal Notice Started' }
    case 'withdrawal_approved':
      return { icon: '✅', iconClass: styles.confirmed, title: 'Withdrawal Processed' }
    case 'withdrawal_rejected':
      return { icon: '❌', iconClass: styles.withdrawal, title: 'Withdrawal Rejected' }
    case 'redemption':
      return { icon: '🏦', iconClass: styles.withdrawal, title: 'Redemption' }
    default:
      return { icon: '•', iconClass: '', title: ev.type }
  }
}

const TransactionsList = memo(function TransactionsList({ limit = null, showViewAll = true, filterInvestmentId = null, expandable = false }) {
  const router = useRouter()
  const [events, setEvents] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const load = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { setLoading(false); return }
      try {
        // PERFORMANCE: Removed migration call - transactions are generated on admin time machine changes
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setUser(data.user)
          const baseEvents = Array.isArray(data.user.activity) ? data.user.activity : []
          const investmentEvents = (data.user.investments || []).flatMap(inv => {
            const transactions = Array.isArray(inv.transactions) ? inv.transactions : []
            return transactions.map(tx => ({
              ...tx,
              type: tx.type,
              date: tx.date || tx.createdAt,
              investmentId: inv.id,
              lockupPeriod: inv.lockupPeriod,
              paymentFrequency: inv.paymentFrequency,
              investmentAmount: inv.amount || 0
            }))
          })
          // Filter out redundant events:
          // - investment_created: redundant with 'investment' transaction
          const filteredBase = baseEvents.filter(ev => ev.type !== 'investment_created')
          const combined = [...filteredBase, ...investmentEvents]
          // Sort descending (newest first) to show most recent activity at the top
          const sorted = combined.slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
          setEvents(sorted)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <div className={styles.empty}>Loading activity…</div>
  if (!user) return <div className={styles.empty}>No user found.</div>
  
  // PERFORMANCE: Memoize expensive filtering and pagination calculations
  const { filtered, visibleEvents, totalPages } = useMemo(() => {
    const filtered = filterInvestmentId ? events.filter(ev => ev.investmentId === filterInvestmentId) : events
    
    // Apply pagination if no limit is set (limit is used for "Recent Activity" widgets)
    // When limit is set, we're showing a preview; when not set, show full paginated list
    let visibleEvents
    let totalPages = 1
    if (limit) {
      visibleEvents = filtered.slice(0, limit)
    } else {
      totalPages = Math.ceil(filtered.length / itemsPerPage)
      const startIndex = (currentPage - 1) * itemsPerPage
      const endIndex = startIndex + itemsPerPage
      visibleEvents = filtered.slice(startIndex, endIndex)
    }
    
    return { filtered, visibleEvents, totalPages }
  }, [events, filterInvestmentId, limit, currentPage, itemsPerPage])

  return (
    <div className={styles.listSection}>
      <div className={styles.feed}>
        {filtered.length === 0 && (
          <div className={styles.empty}>No activity yet</div>
        )}
        {visibleEvents.map(ev => {
          const meta = eventMeta(ev)
          const date = ev.date ? new Date(ev.date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : '-'
          const isDistribution = ev.type === 'distribution' || ev.type === 'monthly_distribution'
          const isWithdrawal = ev.type === 'withdrawal_requested' || ev.type === 'redemption'
          const amountClass = isWithdrawal ? styles.negative : styles.positive
          const isExpanded = expandable && expandedId === ev.id
          // Only show amount for events that have a monetary value
          // Exclude account_created and investment_created as they don't represent transactions
          const shouldShowAmount = ev.type !== 'account_created' && ev.type !== 'investment_created'
          return (
            <div className={styles.event} key={ev.id} onClick={() => { if (expandable) setExpandedId(prev => prev === ev.id ? null : ev.id) }} style={{ cursor: expandable ? 'pointer' : 'default' }}>
              <div className={`${styles.icon} ${meta.iconClass}`}>{meta.icon}</div>
              <div className={styles.content}>
                <div className={styles.primary}>{meta.title}</div>
                <div className={styles.metaRow}>
                  <span>{date}</span>
                  {isDistribution && ev.monthIndex ? <span>• Month {ev.monthIndex}</span> : null}
                  {isDistribution && ev.status ? <span>• {ev.status.toUpperCase()}</span> : null}
                  {ev.status && !isDistribution ? <span>• {ev.status.toUpperCase()}</span> : null}
                  {isDistribution && ev.payoutBankNickname ? <span>• {ev.payoutBankNickname}</span> : null}
                  {ev.investmentId ? (
                    <span
                      className={`${styles.investmentBadge} ${styles.clickable}`}
                      onClick={(e) => { e.stopPropagation(); router.push(`/investment-details/${ev.investmentId}`) }}
                      title={ev.investmentId}
                    >
                      Investment {String(ev.investmentId).slice(-6)}
                    </span>
                  ) : null}
                </div>
                {isExpanded && (
                  <div className={styles.detailsBox}>
                    <div className={styles.detailRow}><span className={styles.detailKey}>Event ID</span><span className={styles.detailVal}>{ev.id}</span></div>
                    <div className={styles.detailRow}><span className={styles.detailKey}>Type</span><span className={styles.detailVal}>{ev.type}</span></div>
                    {ev.lockupPeriod ? <div className={styles.detailRow}><span className={styles.detailKey}>Lockup</span><span className={styles.detailVal}>{ev.lockupPeriod}</span></div> : null}
                    {ev.paymentFrequency ? <div className={styles.detailRow}><span className={styles.detailKey}>Payment</span><span className={styles.detailVal}>{ev.paymentFrequency}</span></div> : null}
                    {typeof ev.monthIndex !== 'undefined' ? <div className={styles.detailRow}><span className={styles.detailKey}>Month Index</span><span className={styles.detailVal}>{ev.monthIndex}</span></div> : null}
                    {ev.status ? <div className={styles.detailRow}><span className={styles.detailKey}>Status</span><span className={styles.detailVal}>{ev.status}</span></div> : null}
                    {ev.payoutBankNickname ? <div className={styles.detailRow}><span className={styles.detailKey}>Bank</span><span className={styles.detailVal}>{ev.payoutBankNickname}</span></div> : null}
                    {ev.noticeEndAt ? <div className={styles.detailRow}><span className={styles.detailKey}>Notice Ends</span><span className={styles.detailVal}>{new Date(ev.noticeEndAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span></div> : null}
                    {ev.payoutDueBy ? <div className={styles.detailRow}><span className={styles.detailKey}>Payout Due By</span><span className={styles.detailVal}>{new Date(ev.payoutDueBy).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span></div> : null}
                  </div>
                )}
              </div>
              {shouldShowAmount && (
                <div className={`${styles.amount} ${amountClass}`}>
                  {formatCurrency(ev.amount || 0)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      
      {/* Show "View All" button when using limit */}
      {limit && events.length > limit && showViewAll && (
        <div className={styles.footer}>
          <button className={styles.viewAllButton} onClick={() => router.push('/dashboard?section=activity')}>View all activity →</button>
        </div>
      )}
      
      {/* Show pagination when not using limit and there are multiple pages */}
      {!limit && totalPages > 1 && (
        <div className={styles.paginationContainer}>
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ← Previous
          </button>
          <div className={styles.paginationInfo}>
            Page {currentPage} of {totalPages}
            <span className={styles.paginationCount}>
              (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length})
            </span>
          </div>
          <button
            className={styles.paginationButton}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
})

export default TransactionsList

