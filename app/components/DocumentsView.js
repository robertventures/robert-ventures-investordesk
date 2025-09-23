'use client'
import styles from './DocumentsView.module.css'

export default function DocumentsView() {
  return (
    <div className={styles.documentsContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Documents</h1>
        <p className={styles.subtitle}>Manage your investment documents and agreements</p>
      </div>

      <div className={styles.content}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📄</div>
          <h3 className={styles.emptyTitle}>No Documents Yet</h3>
          <p className={styles.emptyDescription}>
            Documents will appear here once you complete an investment. This includes:
          </p>
          <ul className={styles.documentTypes}>
            <li>Investment Agreements</li>
            <li>Account Statements</li>
            <li>Tax Documents</li>
            <li>Compliance Forms</li>
          </ul>
        </div>

        <div className={styles.actions}>
          <button className={styles.uploadButton}>
            📤 Upload Document
          </button>
          <button className={styles.requestButton}>
            📋 Request Document
          </button>
        </div>
      </div>
    </div>
  )
}
