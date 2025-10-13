'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './ActivityTab.module.css'

/**
 * Activity tab showing all platform-wide activity events
 */
export default function ActivityTab({ users }) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Collect all activity events from all users
  const allActivity = useMemo(() => {
    const events = []
    
    users.forEach(user => {
      if (Array.isArray(user.activity)) {
        user.activity.forEach(event => {
          events.push({
            ...event,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
          })
        })
      }
      const investments = Array.isArray(user.investments) ? user.investments : []
      investments.forEach(investment => {
        const transactions = Array.isArray(investment.transactions) ? investment.transactions : []
        transactions.forEach(tx => {
          // Filter out 'investment' type transactions to avoid duplicates with user.activity events
          // (investment_created/investment_confirmed already show these milestones)
          if (tx.type === 'investment') return
          
          events.push({
            ...tx,
            userId: user.id,
            userEmail: user.email,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            investmentId: investment.id,
            lockupPeriod: investment.lockupPeriod || tx.lockupPeriod,
            paymentFrequency: investment.paymentFrequency || tx.paymentFrequency
          })
        })
      })
    })

    // Sort by date (most recent first)
    events.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    return events
  }, [users])

  // Filter activity based on search term
  const filteredActivity = useMemo(() => {
    if (!searchTerm.trim()) return allActivity

    const term = searchTerm.toLowerCase()
    return allActivity.filter(event => {
      return (
        event.type?.toLowerCase().includes(term) ||
        event.userName?.toLowerCase().includes(term) ||
        event.userEmail?.toLowerCase().includes(term) ||
        event.userId?.toLowerCase().includes(term) ||
        event.investmentId?.toLowerCase().includes(term) ||
        event.id?.toLowerCase().includes(term)
      )
    })
  }, [allActivity, searchTerm])

  // Paginate filtered activity
  const paginatedActivity = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredActivity.slice(startIndex, endIndex)
  }, [filteredActivity, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredActivity.length / itemsPerPage)

  // Reset to page 1 when search term changes
  useMemo(() => {
    setCurrentPage(1)
  }, [searchTerm])

  // Get event metadata (icon, title, color)
  const getEventMeta = (eventType) => {
    switch (eventType) {
      case 'account_created':
        return { icon: '👤', title: 'Account Created', color: '#0369a1' }
      case 'investment_created':
        return { icon: '🧾', title: 'Investment Created', color: '#0369a1' }
      case 'investment_confirmed':
        return { icon: '✅', title: 'Investment Confirmed', color: '#065f46' }
      case 'investment_rejected':
        return { icon: '❌', title: 'Investment Rejected', color: '#991b1b' }
      case 'investment':
        return { icon: '🧾', title: 'Investment Transaction', color: '#0369a1' }
      case 'distribution':
        return { icon: '💸', title: 'Distribution', color: '#5b21b6' }
      case 'monthly_distribution':
        return { icon: '💸', title: 'Monthly Payout', color: '#5b21b6' }
      case 'contribution':
        return { icon: '📈', title: 'Contribution', color: '#5b21b6' }
      case 'monthly_compounded':
        return { icon: '📈', title: 'Monthly Compounded', color: '#5b21b6' }
      case 'withdrawal_requested':
        return { icon: '🏦', title: 'Withdrawal Requested', color: '#ca8a04' }
      case 'withdrawal_notice_started':
        return { icon: '⏳', title: 'Withdrawal Notice Started', color: '#ca8a04' }
      case 'withdrawal_approved':
        return { icon: '✅', title: 'Withdrawal Processed', color: '#065f46' }
      case 'withdrawal_rejected':
        return { icon: '❌', title: 'Withdrawal Rejected', color: '#991b1b' }
      case 'redemption':
        return { icon: '🏦', title: 'Redemption', color: '#ca8a04' }
      default:
        return { icon: '•', title: eventType || 'Unknown Event', color: '#6b7280' }
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
  }

  return (
    <div className={styles.activityTab}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Platform Activity</h2>
          <p className={styles.subtitle}>
            All activity events across the platform ({filteredActivity.length} total)
            {totalPages > 1 && ` - Page ${currentPage} of ${totalPages}`}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search by user, email, investment ID, event type..."
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

      {/* Activity Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Event</th>
              <th>User</th>
              <th>Email</th>
              <th>Investment ID</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Event ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredActivity.length === 0 ? (
              <tr>
                <td colSpan="8" className={styles.emptyState}>
                  {searchTerm ? `No activity events found matching "${searchTerm}"` : 'No activity events yet'}
                </td>
              </tr>
            ) : (
              paginatedActivity.map(event => {
                const meta = getEventMeta(event.type)
                const dateValue = event.displayDate || event.date
                const date = dateValue
                  ? new Date(dateValue).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      timeZone: 'America/New_York'
                    })
                  : '-'
                
                return (
                  <tr key={event.id} className={styles.eventRow}>
                    <td>
                      <div className={styles.eventCell}>
                        <span className={styles.eventIcon} style={{ color: meta.color }}>
                          {meta.icon}
                        </span>
                        <span className={styles.eventTitle}>{meta.title}</span>
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
                      {event.amount != null ? (
                        <strong className={styles.amount}>{formatCurrency(event.amount)}</strong>
                      ) : (
                        <span className={styles.naText}>-</span>
                      )}
                    </td>
                    <td className={styles.dateCell}>{date}</td>
                    <td className={styles.eventIdCell}>
                      {(event.type === 'investment' || event.type === 'distribution' || event.type === 'contribution') && event.id ? (
                        <button
                          className={styles.eventIdButton}
                          onClick={() => router.push(`/admin/transactions/${event.id}`)}
                          title="View transaction details"
                        >
                          <code>{event.id}</code>
                        </button>
                      ) : (
                        <span>{event.id}</span>
                      )}
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
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
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
              (Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredActivity.length)} of {filteredActivity.length})
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
}
