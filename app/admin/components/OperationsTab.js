import SectionCard from './SectionCard'
import TimeMachineTab from './TimeMachineTab'
import ImportInvestorsTab from './ImportInvestorsTab'
import styles from './OperationsTab.module.css'

/**
 * Operations tab containing investor import, time machine, and withdrawals
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
  onRefreshWithdrawals,
  onImportComplete
}) {

  return (
    <div className={styles.operationsTab}>
      {/* Import Investors Section */}
      <SectionCard title="Import Investors">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionDescription}>
            Import investors from Wealthblock or other platforms. Upload CSV, map fields, review data, and send welcome emails.
          </p>
        </div>
        <ImportInvestorsTab 
          currentUser={currentUser}
          onImportComplete={onImportComplete}
        />
      </SectionCard>

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

