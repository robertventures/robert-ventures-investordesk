'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardHeader from '../../components/DashboardHeader'
import InvestmentDetailsContent from '../../components/InvestmentDetailsContent'
import FixedInvestButton from '../../components/FixedInvestButton'
import styles from './page.module.css'

export default function InvestmentDetailsPage({ params }) {
  const { id } = params
  const router = useRouter()
  const [activeView, setActiveView] = useState('investments')

  // Guard against missing/removed account
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const verify = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) { 
        router.push('/')
        return 
      }
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

  const handleViewChange = (view) => {
    router.push(`/dashboard?section=${view}`)
  }

  return (
    <main className={styles.main}>
      <DashboardHeader onViewChange={handleViewChange} activeView={activeView} />
      <div className={styles.container}>
        <div className={styles.headerSection}>
          <button 
            onClick={() => router.push('/dashboard?section=investments')} 
            className={styles.backButton}
          >
            ← Back to Investments
          </button>
          <div className={styles.titleSection}>
            <div className={styles.icon}>📈</div>
            <h1 className={styles.title}>INVESTMENT DETAILS</h1>
          </div>
        </div>
        <InvestmentDetailsContent investmentId={id} />
      </div>
      <FixedInvestButton />
    </main>
  )
}