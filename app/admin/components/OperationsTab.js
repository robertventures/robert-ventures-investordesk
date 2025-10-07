import { useState, useCallback } from 'react'
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
  // Selection state for bulk actions
  const [selectedPayouts, setSelectedPayouts] = useState(new Set())
  const [isProcessingBulk, setIsProcessingBulk] = useState(false)

  // Toggle single payout selection
  const togglePayoutSelection = useCallback((payoutId) => {
    setSelectedPayouts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(payoutId)) {
        newSet.delete(payoutId)
      } else {
        newSet.add(payoutId)
      }
      return newSet
    })
  }, [])

  // Toggle all payouts selection
  const toggleSelectAll = useCallback(() => {
    if (selectedPayouts.size === pendingPayouts.length) {
      setSelectedPayouts(new Set())
    } else {
      setSelectedPayouts(new Set(pendingPayouts.map(p => p.id)))
    }
  }, [pendingPayouts, selectedPayouts.size])

  // Bulk complete selected payouts
  const handleBulkComplete = useCallback(async () => {
    if (selectedPayouts.size === 0) return
    
    if (!confirm(`Mark ${selectedPayouts.size} payout(s) as completed? This will bypass bank transfers.`)) {
      return
    }

    setIsProcessingBulk(true)
    try {
      for (const payoutId of selectedPayouts) {
        const payout = pendingPayouts.find(p => p.id === payoutId)
        if (payout) {
          await onPayoutAction('complete', payout.userId, payout.id)
        }
      }
      setSelectedPayouts(new Set())
    } finally {
      setIsProcessingBulk(false)
    }
  }, [selectedPayouts, pendingPayouts, onPayoutAction])

  // Bulk fail selected payouts
  const handleBulkFail = useCallback(async () => {
    if (selectedPayouts.size === 0) return
    
    const reason = prompt(`Enter failure reason for ${selectedPayouts.size} payout(s):`)
    if (!reason) return

    setIsProcessingBulk(true)
    try {
      for (const payoutId of selectedPayouts) {
        const payout = pendingPayouts.find(p => p.id === payoutId)
        if (payout) {
          await onPayoutAction('fail', payout.userId, payout.id, reason)
        }
      }
      setSelectedPayouts(new Set())
    } finally {
      setIsProcessingBulk(false)
    }
  }, [selectedPayouts, pendingPayouts, onPayoutAction])

  const allSelected = pendingPayouts.length > 0 && selectedPayouts.size === pendingPayouts.length
  const someSelected = selectedPayouts.size > 0
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
            Monthly interest payments requiring admin approval
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
              These monthly interest payments require manual approval from admin.
              You can retry the payouts or manually mark them as completed once approved.
            </p>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {someSelected && (
          <div className={styles.bulkActionsBar}>
            <div className={styles.bulkActionsLeft}>
              <span className={styles.selectionCount}>
                {selectedPayouts.size} selected
              </span>
              <button
                className={styles.clearSelectionButton}
                onClick={() => setSelectedPayouts(new Set())}
              >
                Clear
              </button>
            </div>
            <div className={styles.bulkActionsRight}>
              <button
                className={styles.bulkCompleteButton}
                onClick={handleBulkComplete}
                disabled={isProcessingBulk}
              >
                ✓ Complete Selected
              </button>
              <button
                className={styles.bulkFailButton}
                onClick={handleBulkFail}
                disabled={isProcessingBulk}
              >
                ✗ Fail Selected
              </button>
            </div>
          </div>
        )}

        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={pendingPayouts.length === 0}
                    className={styles.checkbox}
                  />
                </th>
                <th>User</th>
                <th>Investment ID</th>
                <th>Amount</th>
                <th>Scheduled Date</th>
                <th>Bank Account</th>
                <th>Status</th>
                <th>Failure Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingPayouts.length === 0 ? (
                <tr>
                  <td colSpan="9" className={styles.emptyState}>
                    ✅ No pending payouts - all monthly payments have been successfully processed!
                  </td>
                </tr>
              ) : (
                pendingPayouts.map(payout => (
                  <tr 
                    key={payout.id} 
                    className={`${payout.payoutStatus === 'failed' ? styles.failedRow : styles.pendingRow} ${selectedPayouts.has(payout.id) ? styles.selectedRow : ''}`}
                  >
                    <td className={styles.checkboxCell}>
                      <input
                        type="checkbox"
                        checked={selectedPayouts.has(payout.id)}
                        onChange={() => togglePayoutSelection(payout.id)}
                        className={styles.checkbox}
                      />
                    </td>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.userName}>{payout.userName || payout.userId}</div>
                        <div className={styles.userEmail}>{payout.userEmail}</div>
                      </div>
                    </td>
                    <td className={styles.monospaceCell}>{payout.investmentId}</td>
                    <td><strong>${(payout.amount || 0).toFixed(2)}</strong></td>
                    <td className={styles.dateCell}>{new Date(payout.date).toLocaleDateString()}</td>
                    <td className={styles.bankCell}>{payout.payoutBankNickname || 'Not configured'}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[payout.payoutStatus]}`}>
                        {payout.payoutStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className={styles.reasonCell}>{payout.failureReason || '-'}</td>
                    <td>
                      <div className={styles.actionButtonGroup}>
                        <button
                          className={styles.retryButton}
                          onClick={() => onPayoutAction('retry', payout.userId, payout.id)}
                          title="Retry payout"
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
                          title="Mark as completed"
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
                          title="Mark as failed"
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


