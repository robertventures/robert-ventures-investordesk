'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './FixedInvestButton.module.css'

export default function FixedInvestButton() {
  const router = useRouter()
  const [hide, setHide] = useState(false)

  useEffect(() => {
    const init = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return
      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user && data.user.isAdmin) {
          setHide(true)
        }
      } catch {}
    }
    init()
  }, [])

  const handleMakeInvestment = () => {
    router.push('/investment')
  }

  if (hide) return null
  return (
    <div className={styles.fixedButtonContainer}>
      <button onClick={handleMakeInvestment} className={styles.investButton}>
        Make an Investment
      </button>
    </div>
  )
}
