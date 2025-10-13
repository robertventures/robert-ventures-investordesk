import { useState, useCallback } from 'react'
import SectionCard from './SectionCard'
import TimeMachineTab from './TimeMachineTab'
import styles from './OperationsTab.module.css'

/**
 * Operations tab containing withdrawals, tax reporting, and time machine
 */
export default function OperationsTab({
  withdrawals,
  isLoadingWithdrawals,
  timeMachineData,
  currentUser,
  onWithdrawalAction,
  onTimeMachineUpdate,
  onTimeMachineReset,
  onDeleteAccounts,
  onSeedTestAccounts,
  isDeletingAccounts,
  isSeedingAccounts,
  onRefreshWithdrawals
}) {
  // Tax report state
  const [selectedTaxYear, setSelectedTaxYear] = useState(new Date().getFullYear())
  const [taxReportData, setTaxReportData] = useState(null)
  const [isLoadingTaxReport, setIsLoadingTaxReport] = useState(false)
  const [taxReportError, setTaxReportError] = useState(null)

  // Generate list of available years (current year and 5 years back)
  const currentYear = new Date().getFullYear()
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i)

  // Fetch tax report
  const fetchTaxReport = useCallback(async (year) => {
    setIsLoadingTaxReport(true)
    setTaxReportError(null)
    try {
      const response = await fetch(`/api/admin/tax-report?year=${year}`)
      if (!response.ok) {
        throw new Error('Failed to fetch tax report')
      }
      const data = await response.json()
      setTaxReportData(data)
    } catch (error) {
      console.error('Error fetching tax report:', error)
      setTaxReportError(error.message)
      setTaxReportData(null)
    } finally {
      setIsLoadingTaxReport(false)
    }
  }, [])

  // Download tax report as CSV
  const downloadTaxReportCSV = useCallback(async (year) => {
    try {
      const response = await fetch(`/api/admin/tax-report?year=${year}&format=csv`)
      if (!response.ok) {
        throw new Error('Failed to download tax report')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tax-report-${year}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading tax report:', error)
      alert('Failed to download tax report')
    }
  }, [])

  return (
    <div className={styles.operationsTab}>
      {/* Time Machine Section */}
      <SectionCard title="Time Machine">
        <TimeMachineTab
          timeMachineData={timeMachineData}
          onUpdate={onTimeMachineUpdate}
          onReset={onTimeMachineReset}
          currentUser={currentUser}
          onDeleteAccounts={onDeleteAccounts}
          onSeedTestAccounts={onSeedTestAccounts}
          isDeletingAccounts={isDeletingAccounts}
          isSeedingAccounts={isSeedingAccounts}
        />
      </SectionCard>

      {/* Tax Report Section */}
      <SectionCard title="Tax Report">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionDescription}>
            Export transaction data for tax reporting and compliance
          </p>
        </div>

        <div className={styles.taxReportControls}>
          <div className={styles.controlGroup}>
            <label htmlFor="taxYear" className={styles.controlLabel}>
              Tax Year:
            </label>
            <select
              id="taxYear"
              value={selectedTaxYear}
              onChange={(e) => setSelectedTaxYear(parseInt(e.target.value))}
              className={styles.yearSelect}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className={styles.controlButtons}>
            <button
              className={styles.generateReportButton}
              onClick={() => fetchTaxReport(selectedTaxYear)}
              disabled={isLoadingTaxReport}
            >
              {isLoadingTaxReport ? 'Loading...' : '📊 Generate Report'}
            </button>
            <button
              className={styles.downloadCsvButton}
              onClick={() => downloadTaxReportCSV(selectedTaxYear)}
            >
              📥 Download CSV
            </button>
          </div>
        </div>

        {taxReportError && (
          <div className={styles.errorBox}>
            ❌ Error: {taxReportError}
          </div>
        )}

        {taxReportData && (
          <div className={styles.taxReportResults}>
            {/* Summary Cards */}
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Total Users</div>
                <div className={styles.summaryValue}>
                  {taxReportData.summary.totalUsers}
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Total Transactions</div>
                <div className={styles.summaryValue}>
                  {taxReportData.summary.totalTransactions}
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryLabel}>Total Taxable Income</div>
                <div className={styles.summaryValue}>
                  ${taxReportData.summary.totalTaxableIncome.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className={styles.breakdown}>
              <h4 className={styles.breakdownTitle}>Income Breakdown</h4>
              <div className={styles.breakdownGrid}>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Paid Out Interest:</span>
                  <span className={styles.breakdownValue}>
                    ${taxReportData.summary.actualReceiptTotal.toFixed(2)}
                  </span>
                </div>
                <div className={styles.breakdownItem}>
                  <span className={styles.breakdownLabel}>Compounding Interest (Constructive Receipt):</span>
                  <span className={styles.breakdownValue}>
                    ${taxReportData.summary.constructiveReceiptTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <h4 className={styles.breakdownTitle}>By Income Type</h4>
              <div className={styles.incomeTypeGrid}>
                {Object.entries(taxReportData.summary.byIncomeType).map(([type, stats]) => (
                  <div key={type} className={styles.incomeTypeItem}>
                    <div className={styles.incomeTypeHeader}>
                      <span className={styles.incomeTypeName}>{type}</span>
                      <span className={styles.incomeTypeCount}>
                        {stats.count} transaction{stats.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className={styles.incomeTypeAmount}>
                      ${stats.totalIncome.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Transaction Details */}
            {taxReportData.transactions.length > 0 && (
              <>
                <h4 className={styles.transactionsTitle}>
                  Transaction Details ({taxReportData.transactions.length})
                </h4>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>User</th>
                        <th>Investment ID</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Taxable Income</th>
                        <th>Income Type</th>
                        <th>Receipt Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxReportData.transactions.slice(0, 50).map((tx, index) => (
                        <tr key={index}>
                          <td className={styles.dateCell}>
                            {new Date(tx.date).toLocaleDateString()}
                          </td>
                          <td>
                            <div className={styles.userCell}>
                              <div className={styles.userName}>{tx.userName}</div>
                              <div className={styles.userEmail}>{tx.userEmail}</div>
                            </div>
                          </td>
                          <td className={styles.monospaceCell}>{tx.investmentId}</td>
                          <td>
                            <span className={`${styles.badge} ${styles[tx.transactionType]}`}>
                              {tx.transactionType}
                            </span>
                          </td>
                          <td>${tx.amount.toFixed(2)}</td>
                          <td>
                            <strong>${tx.taxableIncome.toFixed(2)}</strong>
                          </td>
                          <td>
                            <span className={styles.incomeTypeBadge}>
                              {tx.incomeType}
                            </span>
                          </td>
                          <td>
                            {tx.constructiveReceipt ? (
                              <span className={styles.constructiveReceiptBadge} title="Taxable but reinvested">
                                Constructive
                              </span>
                            ) : tx.actualReceipt ? (
                              <span className={styles.actualReceiptBadge} title="Paid out to investor">
                                Actual
                              </span>
                            ) : (
                              <span className={styles.noReceiptBadge}>-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {taxReportData.transactions.length > 50 && (
                        <tr>
                          <td colSpan="8" className={styles.moreResults}>
                            ... and {taxReportData.transactions.length - 50} more transactions.
                            Download CSV for complete report.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </SectionCard>

      {/* Withdrawals Section */}
      <SectionCard title="Withdrawals">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionDescription}>
            Process withdrawal requests from investors
          </p>
          <button 
            className={styles.refreshButton} 
            onClick={onRefreshWithdrawals} 
            disabled={isLoadingWithdrawals}
          >
            {isLoadingWithdrawals ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Investment ID</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Eligible At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan="8" className={styles.emptyState}>
                    No withdrawals
                  </td>
                </tr>
              ) : (
                withdrawals.map(w => (
                  <tr key={w.id}>
                    <td>{w.userId}</td>
                    <td>{w.userEmail}</td>
                    <td>{w.investmentId}</td>
                    <td>${(w.amount || 0).toLocaleString()}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[w.status]}`}>
                        {w.status === 'approved' ? 'Completed' : w.status}
                      </span>
                    </td>
                    <td>{w.requestedAt ? new Date(w.requestedAt).toLocaleString() : '-'}</td>
                    <td>{w.payoutDueBy ? new Date(w.payoutDueBy).toLocaleString() : '-'}</td>
                    <td>
                      <div className={styles.actionButtonGroup}>
                        <button 
                          className={styles.approveButton} 
                          onClick={() => onWithdrawalAction('complete', w.userId, w.id)} 
                          disabled={w.status === 'approved'}
                        >
                          Complete Payout
                        </button>
                        <button 
                          className={styles.rejectButton} 
                          onClick={() => onWithdrawalAction('reject', w.userId, w.id)} 
                          disabled={w.status === 'rejected'}
                        >
                          Reject
                        </button>
                      </div>
                      {w.quotedAmount != null && w.finalAmount != null && (
                        <div className={styles.withdrawalMeta}>
                          <div>
                            <strong>Quoted:</strong> ${(w.quotedAmount || 0).toLocaleString()} (earnings ${(w.quotedEarnings || 0).toLocaleString()})
                          </div>
                          <div>
                            <strong>Final:</strong> ${(w.finalAmount || 0).toLocaleString()} (earnings ${(w.finalEarnings || 0).toLocaleString()})
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

