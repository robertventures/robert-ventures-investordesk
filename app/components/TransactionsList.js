'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './TransactionsList.module.css'

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0)
}

function eventMeta(ev) {
  switch (ev.type) {
    case 'investment_created':
      return { icon: '🧾', iconClass: styles.created, title: 'Bond Created' }
    case 'investment_confirmed':
      return { icon: '✅', iconClass: styles.confirmed, title: 'Bond Approved' }
    case 'monthly_distribution':
      return { icon: '💸', iconClass: styles.distribution, title: 'Monthly Payout' }
    case 'monthly_compounded':
      return { icon: '📈', iconClass: styles.distribution, title: 'Monthly Compounded' }
    case 'withdrawal_requested':
      return { icon: '🏦', iconClass: styles.withdrawal, title: 'Withdrawal Requested' }
    default:
      return { icon: '•', iconClass: '', title: ev.type }
  }
}

export default function TransactionsList({ limit = null, showViewAll = true, filterInvestmentId = null }) {
  const router = useRouter()
  const [events, setEvents] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

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
          const tx = Array.isArray(data.user.transactions) ? data.user.transactions : []
          const sorted = tx.slice().sort((a, b) => new Date(b.date) - new Date(a.date))
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
          const date = ev.date ? new Date(ev.date).toLocaleDateString() : '-'
          const isDistribution = ev.type === 'monthly_distribution'
          const isWithdrawal = ev.type === 'withdrawal_requested'
          const amountClass = isWithdrawal ? styles.negative : styles.positive
          return (
            <div className={styles.event} key={ev.id}>
              <div className={`${styles.icon} ${meta.iconClass}`}>{meta.icon}</div>
              <div className={styles.content}>
                <div className={styles.primary}>{meta.title}</div>
                <div className={styles.metaRow}>
                  <span>{date}</span>
                  {isDistribution && ev.monthIndex ? <span>• Month {ev.monthIndex}</span> : null}
                  {isDistribution && ev.payoutStatus ? <span>• Payout {ev.payoutStatus}</span> : null}
                  {isDistribution && ev.payoutBankNickname ? <span>• {ev.payoutBankNickname}</span> : null}
                  {ev.investmentId ? (
                    <span
                      className={`${styles.investmentBadge} ${styles.clickable}`}
                      onClick={() => router.push(`/investment-details/${ev.investmentId}`)}
                      title={ev.investmentId}
                    >
                      Investment {String(ev.investmentId).slice(-6)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={`${styles.amount} ${amountClass}`}>
                {formatCurrency(ev.amount || 0)}
              </div>
            </div>
          )
        })}
      </div>
      {limit && events.length > limit && showViewAll && (
        <div className={styles.footer}>
          <button className={styles.viewAllButton} onClick={() => router.push('/activity')}>View all activity →</button>
        </div>
      )}
    </div>
  )
}


