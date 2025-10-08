'use client'
import { useEffect, useState } from 'react'
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

export default function TransactionsList({ limit = null, showViewAll = true, filterInvestmentId = null, expandable = false }) {
  const router = useRouter()
  const [events, setEvents] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { setLoading(false); return }
      try {
        // Ensure events are backfilled
        await fetch('/api/migrate-transactions', { method: 'POST' })
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
          const combined = [...baseEvents, ...investmentEvents]
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
  const filtered = filterInvestmentId ? events.filter(ev => ev.investmentId === filterInvestmentId) : events
  const visibleEvents = limit ? filtered.slice(0, limit) : filtered

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
          const shouldShowAmount = ev.type !== 'account_created'
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
      {limit && events.length > limit && showViewAll && (
        <div className={styles.footer}>
          <button className={styles.viewAllButton} onClick={() => router.push('/dashboard?section=activity')}>View all activity →</button>
        </div>
      )}
    </div>
  )
}

