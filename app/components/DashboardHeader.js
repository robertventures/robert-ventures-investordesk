'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './DashboardHeader.module.css'

export default function DashboardHeader({ onViewChange, activeView }) {
  const router = useRouter()
  const [userData, setUserData] = useState(null)
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
          setUserData(data.user)
        }
      } catch (e) {
        console.error('Failed to load user data', e)
      }
    }
    loadUser()
  }, [router])

  const handleMakeInvestment = () => {
    try {
      // Force a fresh draft on new investment flow
      localStorage.removeItem('currentInvestmentId')
    } catch {}
    router.push('/investment')
  }

  const handleLogout = async () => {
    try {
      // Call logout API to clear cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
      
      // Clear localStorage
      localStorage.removeItem('currentUserId')
      localStorage.removeItem('signupEmail')
      localStorage.removeItem('currentInvestmentId')
      
      // Redirect to sign-in page
      router.push('/sign-in')
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if API call fails
      localStorage.removeItem('currentUserId')
      localStorage.removeItem('signupEmail')
      localStorage.removeItem('currentInvestmentId')
      router.push('/sign-in')
    }
  }

  const toggleMobileNav = () => {
    setShowMobileNav(prev => !prev)
  }

  const handleNavSelect = (view) => {
    onViewChange(view)
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

  if (!userData) {
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
            onClick={() => onViewChange('portfolio')} 
            className={`${styles.navItem} ${activeView === 'portfolio' ? styles.active : ''}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => onViewChange('profile')} 
            className={`${styles.navItem} ${activeView === 'profile' ? styles.active : ''}`}
          >
            Profile
          </button>
          <button 
            onClick={() => onViewChange('documents')} 
            className={`${styles.navItem} ${activeView === 'documents' ? styles.active : ''}`}
          >
            Documents
          </button>
          <button
            onClick={() => onViewChange('activity')}
            className={`${styles.navItem} ${activeView === 'activity' ? styles.active : ''}`}
          >
            Activity
          </button>
          <button
            onClick={() => onViewChange('contact')}
            className={`${styles.navItem} ${activeView === 'contact' ? styles.active : ''}`}
          >
            Contact
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
              <div className={styles.mobileUserName}>{userData.firstName} {userData.lastName}</div>
              <div className={styles.mobileUserEmail}>{userData.email}</div>
            </div>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('portfolio')}>Dashboard</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('profile')}>Profile</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('documents')}>Documents</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('activity')}>Activity</button>
            <button className={styles.mobileNavItem} onClick={() => handleNavSelect('contact')}>Contact</button>
            <button className={styles.mobileNavItem} onClick={() => { 
              setShowMobileNav(false); 
              try { localStorage.removeItem('currentInvestmentId') } catch {}
              router.push('/investment') 
            }}>Make an Investment</button>
            <div className={styles.mobileDivider}></div>
            <button className={styles.mobileNavItem} onClick={() => { setShowMobileNav(false); handleLogout() }}>Sign Out</button>
          </div>
        </div>
      )}
    </header>
  )
}
