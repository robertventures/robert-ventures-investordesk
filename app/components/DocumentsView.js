'use client'
import { useEffect, useState } from 'react'
import styles from './DocumentsView.module.css'

export default function DocumentsView() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success) {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Failed to load user data:', error)
      }
      setLoading(false)
    }

    loadUser()
  }, [])

  const downloadAgreement = (investment) => {
    if (!investment.documents?.agreement) {
      alert('Agreement data not found')
      return
    }

    const agreementData = {
      ...investment.documents.agreement,
      // Add entity and joint holder data if applicable
      ...(investment.accountType === 'entity' && user?.entity ? { entity: user.entity } : {}),
      ...(investment.accountType === 'joint' && user?.jointHolder ? { jointHolder: user.jointHolder } : {})
    }

    const jsonString = JSON.stringify(agreementData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `investment-agreement-${investment.id}-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className={styles.documentsContainer}>
        <div className={styles.header}>
          <h1 className={styles.title}>Documents</h1>
          <p className={styles.subtitle}>Manage your investment documents and agreements</p>
        </div>
        <div className={styles.content}>
          <div className={styles.loading}>Loading documents...</div>
        </div>
      </div>
    )
  }

  // Get finalized investments with documents
  const finalizedInvestments = (user?.investments || []).filter(investment =>
    (investment.status === 'pending' || investment.status === 'confirmed') &&
    investment.documents?.agreement
  )

  return (
    <div className={styles.documentsContainer}>
      <div className={styles.header}>
        <h1 className={styles.title}>Documents</h1>
        <p className={styles.subtitle}>Manage your investment documents and agreements</p>
      </div>

      <div className={styles.content}>
        {finalizedInvestments.length > 0 ? (
          <div className={styles.documentsList}>
            <h3 className={styles.sectionTitle}>Investment Agreements</h3>
            <div className={styles.documentsGrid}>
              {finalizedInvestments.map(investment => (
                <div key={investment.id} className={styles.documentCard}>
                  <div className={styles.documentIcon}>📄</div>
                  <div className={styles.documentInfo}>
                    <h4 className={styles.documentTitle}>
                      Investment Agreement - {investment.id.slice(-8)}
                    </h4>
                    <div className={styles.documentDetails}>
                      <p><strong>Amount:</strong> {formatCurrency(investment.amount)}</p>
                      <p><strong>Account Type:</strong> {investment.accountType?.toUpperCase() || 'N/A'}</p>
                      <p><strong>Payment Frequency:</strong> {investment.paymentFrequency || 'N/A'}</p>
                      <p><strong>Lockup Period:</strong> {investment.lockupPeriod || 'N/A'}</p>
                      <p><strong>Status:</strong> {investment.status?.toUpperCase() || 'N/A'}</p>
                      <p><strong>Submitted:</strong> {formatDate(investment.submittedAt || investment.updatedAt)}</p>
                    </div>
                  </div>
                  <div className={styles.documentActions}>
                    <button
                      className={styles.downloadButton}
                      onClick={() => downloadAgreement(investment)}
                    >
                      📥 Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )}

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
