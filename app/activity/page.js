'use client'
import TransactionsList from '../components/TransactionsList'

export default function ActivityPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ margin: '0 0 16px 0' }}>All Activity</h1>
      <TransactionsList limit={null} showViewAll={false} />
    </div>
  )
}


