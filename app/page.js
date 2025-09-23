'use client'

import Header from './components/Header'
import AccountCreationForm from './components/AccountCreationForm'
import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <Header />
      
      <div className={styles.container}>
        <section className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>Create your account</h1>
          <p className={styles.welcomeSubtitle}>Start by creating your profile, then set your investment.</p>
        </section>
        
        <AccountCreationForm />
      </div>
    </main>
  )
}
