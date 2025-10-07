import SectionCard from './SectionCard'
import TimeMachineTab from './TimeMachineTab'
import styles from './OperationsTab.module.css'

/**
 * Operations tab containing withdrawals, pending payouts, and time machine
 */
export default function OperationsTab({
  withdrawals,
  isLoadingWithdrawals,
  pendingPayouts,
  isLoadingPayouts,
  timeMachineData,
  currentUser,
  onWithdrawalAction,
  onPayoutAction,
  onTimeMachineUpdate,
  onTimeMachineReset,
  onDeleteAccounts,
  onSeedTestAccounts,
  isDeletingAccounts,
  isSeedingAccounts,
  onRefreshWithdrawals,
  onRefreshPayouts
}) {
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

      {/* Pending Payouts Section */}
      <SectionCard title="Pending Payouts">
        <div className={styles.sectionHeader}>
          <p className={styles.sectionDescription}>
            Manage monthly interest payments that could not be sent due to bank connection issues
          </p>
          <button 
            className={styles.refreshButton} 
            onClick={onRefreshPayouts} 
            disabled={isLoadingPayouts}
          >
            {isLoadingPayouts ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {pendingPayouts.length > 0 && (
          <div className={styles.alertBox}>
            <strong>⚠️ {pendingPayouts.length} Payout{pendingPayouts.length !== 1 ? 's' : ''} Pending</strong>
            <p>
              These monthly interest payments could not be sent due to bank connection issues.
              You can retry the payouts or manually mark them as completed once the bank connection is restored.
            </p>
          </div>
        )}

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Investment ID</th>
                <th>Payout Amount</th>
                <th>Scheduled Date</th>
                <th>Bank Account</th>
                <th>Status</th>
                <th>Failure Reason</th>
                <th>Retry Count</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayouts.length === 0 ? (
                <tr>
                  <td colSpan="10" className={styles.emptyState}>
                    ✅ No pending payouts - all monthly payments have been successfully processed!
                  </td>
                </tr>
              ) : (
                pendingPayouts.map(payout => (
                  <tr 
                    key={payout.id} 
                    className={payout.payoutStatus === 'failed' ? styles.failedRow : styles.pendingRow}
                  >
                    <td>{payout.userName || payout.userId}</td>
                    <td>{payout.userEmail}</td>
                    <td className={styles.monospaceCell}>{payout.investmentId}</td>
                    <td><strong>${(payout.amount || 0).toFixed(2)}</strong></td>
                    <td>{new Date(payout.date).toLocaleDateString()}</td>
                    <td>{payout.payoutBankNickname || 'Not configured'}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[payout.payoutStatus]}`}>
                        {payout.payoutStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.reasonCell}>{payout.failureReason || '-'}</td>
                    <td>{payout.retryCount || 0}</td>
                    <td>
                      <div className={styles.actionButtonGroup}>
                        <button
                          className={styles.retryButton}
                          onClick={() => onPayoutAction('retry', payout.userId, payout.id)}
                        >
                          🔄 Retry
                        </button>
                        <button
                          className={styles.completeButton}
                          onClick={() => {
                            if (confirm('Mark this payout as completed? This will bypass the bank transfer.')) {
                              onPayoutAction('complete', payout.userId, payout.id)
                            }
                          }}
                        >
                          ✓ Complete
                        </button>
                        <button
                          className={styles.failButton}
                          onClick={() => {
                            const reason = prompt('Enter failure reason:')
                            if (reason) {
                              onPayoutAction('fail', payout.userId, payout.id, reason)
                            }
                          }}
                        >
                          ✗ Fail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                        {w.status}
                      </span>
                    </td>
                    <td>{w.requestedAt ? new Date(w.requestedAt).toLocaleString() : '-'}</td>
                    <td>{w.payoutDueBy ? new Date(w.payoutDueBy).toLocaleString() : '-'}</td>
                    <td>
                      <div className={styles.actionButtonGroup}>
                        <button 
                          className={styles.approveButton} 
                          onClick={() => onWithdrawalAction('approve', w.userId, w.id)} 
                          disabled={w.status === 'approved'}
                        >
                          Approve
                        </button>
                        <button 
                          className={styles.rejectButton} 
                          onClick={() => onWithdrawalAction('reject', w.userId, w.id)} 
                          disabled={w.status === 'rejected'}
                        >
                          Reject
                        </button>
                      </div>
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


