'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import InvestmentDetailsHeader from '../../components/InvestmentDetailsHeader'
import InvestmentDetailsContent from '../../components/InvestmentDetailsContent'
import styles from './page.module.css'

export default function InvestmentDetailsPage({ params }) {
  const { id } = params
  const router = useRouter()

  // Guard against missing/removed account
  useEffect(() => {
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

  return (
    <main className={styles.main}>
      <InvestmentDetailsHeader investmentId={id} />
      <div className={styles.container}>
        <InvestmentDetailsContent investmentId={id} />
      </div>
    </main>
  )
}