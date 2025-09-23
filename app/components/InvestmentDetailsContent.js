'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './InvestmentDetailsContent.module.css'

export default function InvestmentDetailsContent({ investmentId }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('investment-info')
  const [investmentData, setInvestmentData] = useState(null)
  const [userData, setUserData] = useState(null)

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) {
        router.push('/')
        return
      }

      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          const investment = data.user.investments?.find(inv => inv.id === investmentId)
          if (investment) {
            setInvestmentData(investment)
            setUserData(data.user)
          } else {
            router.push('/dashboard')
          }
        }
      } catch (e) {
        console.error('Failed to load investment data', e)
        router.push('/dashboard')
      }
    }
    loadData()
  }, [investmentId, router])

  if (!investmentData || !userData) {
    return <div className={styles.loading}>Loading investment details...</div>
  }

  // Calculate earnings data
  const calculateEarnings = () => {
    if (!investmentData.amount || !investmentData.paymentFrequency || !investmentData.lockupPeriod) {
      return { totalEarnings: 0, monthlyEarnings: 0, monthsElapsed: 0 }
    }

    // Only show earnings for approved investments
    const isApproved = investmentData.status === 'approved' || investmentData.status === 'invested'
    if (!isApproved) {
      return { totalEarnings: 0, monthlyEarnings: 0, monthsElapsed: 0 }
    }

    const investmentDate = new Date(investmentData.createdAt || investmentData.signedAt || new Date())
    const now = new Date()
    const monthsElapsed = Math.floor((now - investmentDate) / (1000 * 60 * 60 * 24 * 30.44))
    
    const annualRate = investmentData.lockupPeriod === '1-year' ? 0.08 : 0.10
    const monthlyRate = annualRate / 12
    const monthlyEarnings = investmentData.amount * monthlyRate
    const totalEarnings = monthlyEarnings * monthsElapsed

    return { totalEarnings, monthlyEarnings, monthsElapsed }
  }

  const { totalEarnings, monthlyEarnings, monthsElapsed } = calculateEarnings()

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  return (
    <div className={styles.content}>
      {/* Investment Identifiers */}
      <div className={styles.identifierSection}>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>TYPE</span>
          <span className={styles.identifierValue}>{investmentData.accountType || 'Individual'}</span>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>ID</span>
          <div className={styles.identifierWithCopy}>
            <span className={styles.identifierValue}>{investmentId}</span>
            <button 
              onClick={() => copyToClipboard(investmentId)}
              className={styles.copyButton}
            >
              📋
            </button>
          </div>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>CONTACT ID</span>
          <div className={styles.identifierWithCopy}>
            <span className={styles.identifierValue}>{userData.id}</span>
            <button 
              onClick={() => copyToClipboard(userData.id)}
              className={styles.copyButton}
            >
              📋
            </button>
          </div>
        </div>
        <div className={styles.identifierItem}>
          <span className={styles.identifierLabel}>SIGNATURE DATE</span>
          <span className={styles.identifierValue}>{formatDate(investmentData.signedAt)}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'investment-info' ? styles.active : ''}`}
          onClick={() => setActiveTab('investment-info')}
        >
          📈 INVESTMENT INFO
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'earnings' ? styles.active : ''}`}
          onClick={() => setActiveTab('earnings')}
        >
          🤲 EARNINGS
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'banking' ? styles.active : ''}`}
          onClick={() => setActiveTab('banking')}
        >
          🏦 BANKING INFO
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'investment-info' && (
        <div className={styles.tabContent}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>AMOUNT</span>
                <span className={styles.summaryValue}>${investmentData.amount?.toLocaleString() || '0'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>BONDS</span>
                <span className={styles.summaryValue}>{investmentData.bonds || '-'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>INTEREST RATE</span>
                <span className={styles.summaryValue}>{investmentData.lockupPeriod === '1-year' ? '8%' : '10%'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>STATUS</span>
                <span className={`${styles.status} ${(investmentData.status === 'approved' || investmentData.status === 'invested') ? styles.completed : styles.pending}`}>
                  {investmentData.status || 'Created'}
                </span>
              </div>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>MATURITY DATE</span>
              <span className={styles.summaryValue}>-</span>
            </div>
          </div>

          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <h3 className={styles.detailsTitle}>Details</h3>
              <button className={styles.expandButton}>⌄</button>
            </div>
            <div className={styles.detailsContent}>
              <div className={styles.detailsGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>TYPE</span>
                  <span className={styles.detailValue}>{investmentData.accountType || 'Individual'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>STATUS</span>
                  <span className={styles.detailValue}>{investmentData.status || 'Created'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>AMOUNT</span>
                  <span className={styles.detailValue}>${investmentData.amount?.toLocaleString() || '0'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>BOND VALUE</span>
                  <span className={styles.detailValue}>${investmentData.amount?.toLocaleString() || '0'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>IS COMPOUNDED</span>
                  <span className={styles.detailValue}>{investmentData.paymentFrequency === 'compounding' ? 'Yes' : 'No'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>BONDS</span>
                  <span className={styles.detailValue}>{investmentData.bonds || '0'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>DISCOUNTED BOND AMOUNT</span>
                  <span className={styles.detailValue}>${investmentData.amount?.toLocaleString() || '0'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>YEAR TO DATE INTEREST PAID</span>
                  <span className={styles.detailValue}>${totalEarnings.toFixed(2)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>INCEPTION TO DATE INTEREST PAID</span>
                  <span className={styles.detailValue}>${totalEarnings.toFixed(2)}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>FIRST PAYMENT DATE</span>
                  <span className={styles.detailValue}>-</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>LAST PAYMENT DATE</span>
                  <span className={styles.detailValue}>-</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.offeringCard}>
            <div className={styles.offeringHeader}>
              <h3 className={styles.offeringTitle}>Offering</h3>
              <button className={styles.expandButton}>⌄</button>
            </div>
            <div className={styles.offeringContent}>
              <div className={styles.offeringGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>OFFERING</span>
                  <span className={styles.detailValue}>-</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>TERM</span>
                  <span className={styles.detailValue}>{investmentData.lockupPeriod || '-'}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>INTEREST RATE</span>
                  <span className={styles.detailValue}>{investmentData.lockupPeriod === '1-year' ? '8%' : '10%'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'earnings' && (
        <div className={styles.tabContent}>
          <div className={styles.earningsCard}>
            <h3 className={styles.earningsTitle}>Earnings Summary</h3>
            <div className={styles.earningsGrid}>
              <div className={styles.earningsItem}>
                <span className={styles.earningsLabel}>TOTAL EARNED</span>
                <span className={styles.earningsValue}>${totalEarnings.toFixed(2)}</span>
              </div>
              <div className={styles.earningsItem}>
                <span className={styles.earningsLabel}>MONTHLY EARNINGS</span>
                <span className={styles.earningsValue}>${monthlyEarnings.toFixed(2)}</span>
              </div>
              <div className={styles.earningsItem}>
                <span className={styles.earningsLabel}>MONTHS ELAPSED</span>
                <span className={styles.earningsValue}>{monthsElapsed}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'banking' && (
        <div className={styles.tabContent}>
          <div className={styles.bankingCard}>
            <h3 className={styles.bankingTitle}>Banking Information</h3>
            <div className={styles.bankingGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>FUNDING METHOD</span>
                <span className={styles.detailValue}>{investmentData.banking?.fundingMethod || '-'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>EARNINGS METHOD</span>
                <span className={styles.detailValue}>{investmentData.banking?.earningsMethod || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
