'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './TransactionsTable.module.css'

export default function TransactionsTable() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('purchases')
  const [userData, setUserData] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [earnings, setEarnings] = useState([])

  useEffect(() => {
    const loadData = async () => {
      const userId = localStorage.getItem('currentUserId')
      if (!userId) return

      try {
        const res = await fetch(`/api/users/${userId}`)
        const data = await res.json()
        if (data.success && data.user) {
          setUserData(data.user)
          
          // Convert investments to transaction format
          const investments = data.user.investments || []
          const transactionData = investments.map(inv => {
            // Calculate actual earnings for this investment
            let actualEarnings = 0
            // Only accrue/display earnings for approved investments
            const isApproved = inv.status === 'approved' || inv.status === 'invested'
            if (isApproved && inv.amount && inv.paymentFrequency && inv.lockupPeriod) {
              const investmentDate = new Date(inv.createdAt || inv.signedAt || new Date())
              const now = new Date()
              const monthsElapsed = Math.floor((now - investmentDate) / (1000 * 60 * 60 * 24 * 30.44))
              
              if (inv.paymentFrequency === 'monthly') {
                const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
                const monthlyRate = annualRate / 12
                const monthlyEarnings = inv.amount * monthlyRate
                actualEarnings = monthlyEarnings * monthsElapsed
              } else if (inv.paymentFrequency === 'compounding') {
                const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
                const monthlyRate = annualRate / 12
                actualEarnings = inv.amount * Math.pow(1 + monthlyRate, monthsElapsed) - inv.amount
              }
            }
            
            return {
              id: inv.id,
              recordId: inv.id.slice(-3).toUpperCase() + 'D',
              transactionDate: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '-',
              type: inv.accountType || 'Individual',
              offeringType: 'S1',
              associatedTo: `${data.user.firstName} ${data.user.lastName}`,
              status: inv.status ? inv.status[0].toUpperCase() + inv.status.slice(1) : 'Pending',
              amount: inv.amount || 0,
              bonds: inv.bonds || 0,
              rate: inv.lockupPeriod === '1-year' ? '8.00%' : '10.00%',
              term: inv.lockupPeriod === '1-year' ? '1' : '3',
              isCompounded: inv.paymentFrequency === 'compounding' ? 'Yes' : 'No',
              maturityDate: '-',
              ytdEarned: `$${actualEarnings.toFixed(2)}`,
              total: `$${actualEarnings.toFixed(2)}`
            }
          })
          
          // Generate earnings data for monthly payment investments
          const earningsData = []
          investments.forEach(inv => {
            const isApproved = inv.status === 'approved' || inv.status === 'invested'
            if (isApproved && inv.paymentFrequency === 'monthly' && inv.amount && inv.lockupPeriod) {
              const investmentDate = new Date(inv.createdAt || inv.signedAt || new Date())
              const now = new Date()
              const monthsElapsed = Math.floor((now - investmentDate) / (1000 * 60 * 60 * 24 * 30.44))
              
              if (monthsElapsed > 0) {
                const annualRate = inv.lockupPeriod === '1-year' ? 0.08 : 0.10
                const monthlyRate = annualRate / 12
                const monthlyEarnings = inv.amount * monthlyRate
                
                // Generate individual monthly earnings records
                for (let month = 1; month <= monthsElapsed; month++) {
                  const earningsDate = new Date(investmentDate)
                  earningsDate.setMonth(earningsDate.getMonth() + month)
                  
                  earningsData.push({
                    id: `${inv.id}-earnings-${month}`,
                    recordId: `${inv.id.slice(-3).toUpperCase()}E${month.toString().padStart(2, '0')}`,
                    transactionDate: earningsDate.toLocaleDateString(),
                    type: 'Monthly Distribution',
                    offeringType: 'S1',
                    associatedTo: `${data.user.firstName} ${data.user.lastName}`,
                    status: 'Completed',
                    amount: monthlyEarnings,
                    bonds: inv.bonds || 0,
                    rate: inv.lockupPeriod === '1-year' ? '8.00%' : '10.00%',
                    term: inv.lockupPeriod === '1-year' ? '1' : '3',
                    isCompounded: 'No',
                    maturityDate: '-',
                    ytdEarned: `$${monthlyEarnings.toFixed(2)}`,
                    total: `$${(monthlyEarnings * month).toFixed(2)}`
                  })
                }
              }
            }
          })
          
          setTransactions(transactionData)
          setEarnings(earningsData)
        }
      } catch (e) {
        console.error('Failed to load transaction data', e)
      }
    }
    loadData()
  }, [])

  if (!userData) {
    return <div className={styles.loading}>Loading transactions...</div>
  }

  return (
    <div className={styles.transactionsSection}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>YOUR TRANSACTIONS</h2>
          <p className={styles.subtitle}>
            For specific details including earnings and bank information for each investment select the Details link.
          </p>
        </div>
      </div>
      
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'purchases' ? styles.active : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          🛒 PURCHASES
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'earnings' ? styles.active : ''}`}
          onClick={() => setActiveTab('earnings')}
        >
          💰 EARNINGS
        </button>
      </div>
      
      {activeTab === 'earnings' && earnings.length === 0 ? (
        <div className={styles.emptyEarningsState}>
          <div className={styles.emptyEarningsIcon}>🤲</div>
          <p className={styles.emptyEarningsText}>
            Once you start receiving distributions, your earnings will appear here.
          </p>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>DETAILS</th>
                <th>RECORD ID</th>
                <th>TRANSACTION DATE</th>
                <th>TYPE</th>
                <th>OFFERING TYPE</th>
                <th>ASSOCIATED TO</th>
                <th>STATUS</th>
                <th>AMOUNT</th>
                <th>BONDS</th>
                <th>RATE</th>
                <th>TERM</th>
                <th>IS COMPOUNDED?</th>
                <th>MATURITY DATE</th>
                <th>YTD EARNED</th>
                <th>TOTAL</th>
                <th>AGREEMENT</th>
              </tr>
            </thead>
            <tbody>
              {(activeTab === 'purchases' ? transactions : earnings).length === 0 ? (
                <tr>
                  <td colSpan="16" className={styles.noData}>
                    No {activeTab} found
                  </td>
                </tr>
              ) : (
                (activeTab === 'purchases' ? transactions : earnings).map((tx, index) => (
                  <tr key={tx.id}>
                    <td>
                      <button 
                        onClick={() => router.push(`/investment-details/${tx.id}`)}
                        className={styles.detailsLink}
                      >
                        Details
                      </button>
                    </td>
                    <td>{tx.recordId}</td>
                    <td>{tx.transactionDate}</td>
                    <td>{tx.type}</td>
                    <td>{tx.offeringType}</td>
                    <td>{tx.associatedTo}</td>
                    <td>
                      {(() => {
                        const isGreen = tx.status === 'Completed' || tx.status === 'Approved' || tx.status === 'Invested'
                        return (
                          <span className={`${styles.status} ${isGreen ? styles.completed : styles.pending}`}>
                            {tx.status}
                          </span>
                        )
                      })()}
                    </td>
                    <td className={styles.amount}>${tx.amount.toLocaleString()}</td>
                    <td>{tx.bonds}</td>
                    <td>{tx.rate}</td>
                    <td>{tx.term}</td>
                    <td>{tx.isCompounded}</td>
                    <td>{tx.maturityDate}</td>
                    <td>{tx.ytdEarned}</td>
                    <td>{tx.total}</td>
                    <td>
                      <div className={styles.agreementActions}>
                        <button className={styles.actionButton}>📥</button>
                        <button className={styles.actionButton}>👁️</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {activeTab === 'earnings' && earnings.length === 0 ? null : (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing 1 - {(activeTab === 'purchases' ? transactions : earnings).length} of {(activeTab === 'purchases' ? transactions : earnings).length}
          </div>
          <div className={styles.paginationControls}>
            <button className={styles.paginationButton} disabled>←</button>
            <button className={`${styles.paginationButton} ${styles.active}`}>1</button>
            <button className={styles.paginationButton} disabled>→</button>
          </div>
        </div>
      )}
    </div>
  )
}
