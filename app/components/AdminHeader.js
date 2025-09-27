'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './AdminHeader.module.css'

export default function AdminHeader({ onTabChange, activeTab }) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [showMobileNav, setShowMobileNav] = useState(false)

  useEffect(() => {
    const userId = localStorage.getItem('currentUserId')
    if (!userId) {
      router.push('/')
      return
    }

    const loadUser = async () => {
      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setCurrentUser(data.user)
        }
      } catch (e) {
        console.error('Failed to load user data', e)
      }
    }
    loadUser()
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('currentUserId')
    localStorage.removeItem('signupEmail')
    localStorage.removeItem('currentInvestmentId')
    router.push('/')
  }

  const toggleMobileNav = () => {
    setShowMobileNav(prev => !prev)
  }

  const handleNavSelect = (tab) => {
    onTabChange(tab)
    setShowMobileNav(false)
  }

  // Close mobile nav when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMobileNav && !event.target.closest(`.${styles.mobileNavWrapper}`) && !event.target.closest(`.${styles.mobileToggle}`)) {
        setShowMobileNav(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMobileNav])

  if (!currentUser) {
    return <div className={styles.loading}>Loading...</div>
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.logoText}>ROBERT VENTURES</span>
        </div>

        <nav className={styles.nav}>
          <button
            onClick={() => onTabChange('dashboard')}
            className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.active : ''}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onTabChange('accounts')}
            className={`${styles.navItem} ${activeTab === 'accounts' ? styles.active : ''}`}
          >
            Accounts
          </button>
          <button
            onClick={() => onTabChange('investments')}
            className={`${styles.navItem} ${activeTab === 'investments' ? styles.active : ''}`}
          >
            Investments
          </button>
          <button
            onClick={() => onTabChange('deletions')}
            className={`${styles.navItem} ${activeTab === 'deletions' ? styles.active : ''}`}
          >
            Deletion Requests
          </button>
        </nav>

        <div className={styles.userActions}>
          <button className={styles.navItem} onClick={handleLogout}>Sign Out</button>
          <button className={styles.mobileToggle} onClick={toggleMobileNav} aria-label="Toggle menu">
            ☰
          </button>
        </div>
      </div>

      {showMobileNav && (
        <div className={styles.mobileNavWrapper}>
          <div className={styles.mobileNav}>
            <div className={styles.mobileHeader}>
              <div className={styles.mobileUserName}>{currentUser.firstName} {currentUser.lastName}</div>
              <div className={styles.mobileUserEmail}>{currentUser.email}</div>
            </div>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('dashboard')}>Dashboard</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('accounts')}>Accounts</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('investments')}>Investments</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('deletions')}>Deletion Requests</button>
            <div className={styles.mobileDivider}></div>
            <button className={styles.mobileNavItem} onClick={() => { setShowMobileNav(false); handleLogout() }}>Sign Out</button>
          </div>
        </div>
      )}
    </header>
  )
}
