'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/apiClient'
import logger from '@/lib/logger'
import DashboardHeader from '../components/DashboardHeader'
import PortfolioSummary from '../components/PortfolioSummary'
import InvestmentsView from '../components/InvestmentsView'
import ProfileView from '../components/ProfileView'
import DocumentsView from '../components/DocumentsView'
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
    if (typeof window === 'undefined') return
    
    const verify = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { router.push('/'); return }
      try {
        // Check if we're coming from investment finalization
        // If so, request fresh data to ensure we have the latest state
        const fromFinalize = searchParams.get('from') === 'finalize'
        const freshParam = fromFinalize ? '?fresh=true' : ''
        
        const data = await apiClient.getUser(userId, fromFinalize)
        if (!data.success || !data.user) {
          localStorage.removeItem('currentUserId')
          localStorage.removeItem('signupEmail')
          localStorage.removeItem('currentInvestmentId')
          router.push('/')
          return
        }
        
        // Redirect to onboarding if user needs to complete setup
        if (data.user.needsOnboarding) {
          logger.log('User needs onboarding, redirecting...')
          router.push('/onboarding')
          return
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
    if (section && ['portfolio', 'investments', 'profile', 'documents', 'contact'].includes(section)) {
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
      case 'investments':
        return <InvestmentsView />
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
