import Link from 'next/link'
import styles from './Header.module.css'

export default function Header({ showBackButton = false, backLink = '/dashboard', backText = 'Dashboard' }) {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {showBackButton && (
          <Link href={backLink} className={styles.backButton}>
            <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>{backText}</span>
          </Link>
        )}
        <h1 className={styles.logo}>Robert Ventures</h1>
      </div>
    </header>
  )
}
