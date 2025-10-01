'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '../components/DashboardHeader'
import TransactionsList from '../components/TransactionsList'
import styles from './page.module.css'

export default function ActivityPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeView, setActiveView] = useState('activity')

  // Guard against missing/removed account
  useEffect(() => {
    const verify = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { router.push('/'); return }
      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (!data.success || !data.user) {
          localStorage.removeItem('currentUserId')
          localStorage.removeItem('signupEmail')
          localStorage.removeItem('currentInvestmentId')
          router.push('/')
        }
      } catch {
        router.push('/')
      }
    }
    verify()
  }, [router])

  // Initialize activeView from URL params and sync URL with activeView
  useEffect(() => {
    const section = searchParams.get('section')
    if (section && ['portfolio', 'profile', 'documents', 'contact', 'activity'].includes(section)) {
      setActiveView(section)
    }
  }, [searchParams])

  const handleViewChange = (view) => {
    setActiveView(view)
    const newSearchParams = new URLSearchParams(searchParams.toString())
    newSearchParams.set('section', view)
    if (view === 'activity') {
      router.replace(`/notifications?${newSearchParams.toString()}`, { scroll: false })
    } else {
      router.replace(`/dashboard?${newSearchParams.toString()}`, { scroll: false })
    }
  }

  return (
    <div className={styles.main}>
      <DashboardHeader onViewChange={handleViewChange} activeView={activeView} />
      <div className={styles.container}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
          <h1 style={{ margin: '0 0 16px 0' }}>Activity</h1>
          <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>Click an activity item to view full details.</p>
          <TransactionsList limit={null} showViewAll={false} expandable={true} />
        </div>
      </div>
    </div>
  )
}


