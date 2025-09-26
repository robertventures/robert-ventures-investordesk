'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardHeader from '../components/DashboardHeader'
import PortfolioSummary from '../components/PortfolioSummary'
import TransactionsTable from '../components/TransactionsTable'
import ProfileView from '../components/ProfileView'
import DocumentsView from '../components/DocumentsView'
import FixedInvestButton from '../components/FixedInvestButton'
import styles from './page.module.css'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeView, setActiveView] = useState('portfolio')

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
    if (section && ['portfolio', 'profile', 'documents', 'contact'].includes(section)) {
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
        return (
          <>
            <PortfolioSummary />
            <TransactionsTable />
          </>
        )
    }
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
