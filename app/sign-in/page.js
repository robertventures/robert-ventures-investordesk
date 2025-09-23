import Header from '../components/Header'
import SignInForm from '../components/SignInForm'
import styles from './page.module.css'

export default function SignInPage() {
  return (
    <div className={styles.main}>
      <Header />
      <div className={styles.container}>
        <div className={styles.welcomeSection}>
          <h1 className={styles.welcomeTitle}>Welcome Back</h1>
          <p className={styles.welcomeSubtitle}>Sign in to your Robert Ventures account</p>
        </div>
        <SignInForm />
      </div>
    </div>
  )
}
