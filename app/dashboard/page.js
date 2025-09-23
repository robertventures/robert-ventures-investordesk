'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardHeader from '../components/DashboardHeader'
import PortfolioSummary from '../components/PortfolioSummary'
import TransactionsTable from '../components/TransactionsTable'
import ProfileView from '../components/ProfileView'
import DocumentsView from '../components/DocumentsView'
import FixedInvestButton from '../components/FixedInvestButton'
import styles from './page.module.css'

export default function DashboardPage() {
  const router = useRouter()
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

  const renderContent = () => {
    switch (activeView) {
      case 'profile':
        return <ProfileView />
      case 'documents':
        return <DocumentsView />
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
      <DashboardHeader onViewChange={setActiveView} activeView={activeView} />
      <div className={styles.container}>
        {renderContent()}
      </div>
      <FixedInvestButton />
    </div>
  )
}
