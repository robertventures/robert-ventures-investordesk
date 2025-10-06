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
      case 'monthly_distribution':
        return { icon: '💸', title: 'Monthly Payout', color: '#5b21b6' }
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
          <p className={styles.subtitle}>All activity events across the platform ({filteredActivity.length} total)</p>
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
              filteredActivity.map(event => {
                const meta = getEventMeta(event.type)
                const date = event.date ? new Date(event.date).toLocaleString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                }) : '-'
                
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
                    <td className={styles.eventIdCell}>{event.id}</td>
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
    </div>
  )
}

