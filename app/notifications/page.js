'use client'
import TransactionsList from '../components/TransactionsList'

export default function NotificationsPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ margin: '0 0 16px 0' }}>Notifications</h1>
      <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>Click a notification to view full details.</p>
      <TransactionsList limit={null} showViewAll={false} expandable={true} />
    </div>
  )
}


