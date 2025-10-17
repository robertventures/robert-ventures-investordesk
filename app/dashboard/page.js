'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '../components/DashboardHeader'
import PortfolioSummary from '../components/PortfolioSummary'
import ProfileView from '../components/ProfileView'
import DocumentsView from '../components/DocumentsView'
import TransactionsList from '../components/TransactionsList'
import FixedInvestButton from '../components/FixedInvestButton'
import styles from './page.module.css'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [activeView, setActiveView] = useState('portfolio')

  // Guard against missing/removed account
  useEffect(() => {
    setMounted(true)
    const verify = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { router.push('/'); return }
      try {
        // Check if we're coming from investment finalization
        // If so, request fresh data with extended retries to handle Netlify Blobs consistency
        const fromFinalize = searchParams.get('from') === 'finalize'
        const freshParam = fromFinalize ? '?fresh=true' : ''
        
        const res = await fetch(`/api/users/${userId}${freshParam}`)
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
  }, [router, searchParams])

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
    router.replace(`/dashboard?${newSearchParams.toString()}`, { scroll: false })
  }

  const renderContent = () => {
    switch (activeView) {
      case 'activity':
        return (
          <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
            <h1 style={{ margin: '0 0 16px 0' }}>Activity</h1>
            <p style={{ margin: '0 0 16px 0', color: '#6b7280' }}>Click an activity item to view full details.</p>
            <TransactionsList limit={null} showViewAll={false} expandable={true} />
          </div>
        )
      case 'profile':
        return <ProfileView />
      case 'documents':
        return <DocumentsView />
      case 'contact':
        return (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Contact Us</h2>
            <p>Get in touch with our team for any questions or support.</p>
            {/* Add contact form/content here later */}
          </div>
        )
      case 'portfolio':
      default:
        return <PortfolioSummary />
    }
  }

  // Prevent hydration mismatch - don't render until mounted
  if (!mounted) {
    return (
      <div className={styles.main}>
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className={styles.main}>
      <DashboardHeader onViewChange={handleViewChange} activeView={activeView} />
      <div className={styles.container}>
        {renderContent()}
      </div>
      <FixedInvestButton />
    </div>
  )
}
