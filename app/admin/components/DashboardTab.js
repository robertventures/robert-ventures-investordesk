import { useRouter } from 'next/navigation'
import MetricCard from './MetricCard'
import ActionCard from './ActionCard'
import SectionCard from './SectionCard'
import styles from './DashboardTab.module.css'

/**
 * Main dashboard tab showing overview metrics and recent activity
 */
export default function DashboardTab({ metrics, pendingInvestments, onApprove, onReject, savingId }) {
  const router = useRouter()

  return (
    <div className={styles.dashboardTab}>
      {/* Primary Metrics */}
      <div className={styles.primaryMetricsGrid}>
        <MetricCard 
          label="Total AUM" 
          value={`$${metrics.totalAUM.toLocaleString()}`} 
        />
        <MetricCard 
          label="Pending Capital" 
          value={`$${metrics.pendingCapital.toLocaleString()}`} 
        />
        <MetricCard 
          label="Total Amount Owed" 
          value={`$${metrics.totalAmountOwed.toLocaleString()}`} 
        />
        <MetricCard 
          label="Total Accounts" 
          value={metrics.totalAccounts} 
        />
        <MetricCard 
          label="Active Investors" 
          value={metrics.investorsCount} 
        />
      </div>

      {/* Pending Approvals List */}
      <SectionCard title="Pending Approvals">
        {pendingInvestments && pendingInvestments.length > 0 ? (
          <div className={styles.pendingList}>
            {pendingInvestments.map(inv => (
              <div key={`${inv.user.id}-${inv.id}`} className={styles.pendingItem}>
                <div className={styles.pendingItemMain}>
                  <div className={styles.pendingItemInfo}>
                    <div className={styles.pendingItemHeader}>
                      <span className={styles.pendingItemId}>#{inv.id}</span>
                      <span 
                        className={styles.pendingItemName}
                        onClick={() => router.push(`/admin/users/${inv.user.id}`)}
                      >
                        {inv.user.firstName} {inv.user.lastName}
                      </span>
                    </div>
                    <div className={styles.pendingItemDetails}>
                      <span className={styles.pendingItemEmail}>{inv.user.email}</span>
                      <span className={styles.pendingItemDivider}>•</span>
                      <span className={styles.pendingItemAccountType}>
                        {inv.accountType === 'individual' && 'Individual'}
                        {inv.accountType === 'joint' && 'Joint'}
                        {inv.accountType === 'entity' && 'Entity'}
                        {inv.accountType === 'ira' && 'IRA'}
                      </span>
                      <span className={styles.pendingItemDivider}>•</span>
                      <span className={styles.pendingItemLockup}>
                        {inv.lockupPeriod === '1-year' ? '1-Year' : '3-Year'} Lockup
                      </span>
                    </div>
                  </div>
                  <div className={styles.pendingItemAmount}>
                    ${inv.amount.toLocaleString()}
                  </div>
                </div>
                <div className={styles.pendingItemActions}>
                  <button
                    onClick={() => {
                      if (confirm(`Approve investment ${inv.id} for ${inv.user.firstName} ${inv.user.lastName}?\n\nAmount: $${inv.amount.toLocaleString()}\nAccount Type: ${inv.accountType}\nLockup: ${inv.lockupPeriod === '1-year' ? '1-Year' : '3-Year'}\n\nThis will activate the investment and lock the user's account type.`)) {
                        onApprove(inv.user.id, inv.id)
                      }
                    }}
                    disabled={savingId === inv.id}
                    className={styles.approveButton}
                  >
                    {savingId === inv.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Reject investment ${inv.id} for ${inv.user.firstName} ${inv.user.lastName}?\n\nThis action cannot be undone.`)) {
                        onReject(inv.user.id, inv.id)
                      }
                    }}
                    disabled={savingId === inv.id}
                    className={styles.rejectButton}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            ✅ No pending investment approvals
          </div>
        )}
      </SectionCard>

      {/* Other Action Items */}
      {(metrics.pendingWithdrawalsCount > 0 || metrics.pendingPayoutsCount > 0) && (
        <SectionCard title="Other Actions">
          <div className={styles.actionGrid}>
            {metrics.pendingWithdrawalsCount > 0 && (
              <ActionCard
                value={metrics.pendingWithdrawalsCount}
                label="Pending Withdrawals"
                variant="warning"
                onClick={() => router.push('/admin?tab=operations')}
              />
            )}
            {metrics.pendingPayoutsCount > 0 && (
              <ActionCard
                value={metrics.pendingPayoutsCount}
                label="Pending Payouts"
                variant="warning"
                onClick={() => router.push('/admin?tab=operations')}
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* Two Column Layout */}
      <div className={styles.twoColumnLayout}>
        {/* Left Column - Distribution */}
        <div className={styles.column}>
          <SectionCard title="Distribution">
            <div className={styles.distributionGrid}>
              <div className={styles.distributionCard}>
                <div className={styles.distributionTitle}>Account Types</div>
                <div className={styles.distributionList}>
                  <div className={styles.distributionRow}>
                    <span>Individual</span>
                    <strong>{metrics.accountsByType.individual}</strong>
                  </div>
                  <div className={styles.distributionRow}>
                    <span>Joint</span>
                    <strong>{metrics.accountsByType.joint}</strong>
                  </div>
                  <div className={styles.distributionRow}>
                    <span>Entity</span>
                    <strong>{metrics.accountsByType.entity}</strong>
                  </div>
                  <div className={styles.distributionRow}>
                    <span>IRA</span>
                    <strong>{metrics.accountsByType.ira}</strong>
                  </div>
                </div>
              </div>

              <div className={styles.distributionCard}>
                <div className={styles.distributionTitle}>Lockup Periods</div>
                <div className={styles.distributionList}>
                  <div className={styles.distributionRow}>
                    <span>1 Year</span>
                    <strong>{metrics.investmentsByLockup['1-year']}</strong>
                  </div>
                  <div className={styles.distributionRow}>
                    <span>3 Years</span>
                    <strong>{metrics.investmentsByLockup['3-year']}</strong>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Right Column - Recent Activity */}
        <div className={styles.column}>
          <SectionCard title="Recent Activity">
            <div className={styles.activityCard}>
              <h3 className={styles.activityCardTitle}>Latest Investments</h3>
              <div className={styles.activityList}>
                {metrics.recentInvestments.length > 0 ? (
                  metrics.recentInvestments.slice(0, 5).map(inv => (
                    <div
                      key={`${inv.userId}-${inv.id}`}
                      className={styles.activityItem}
                      onClick={() => router.push(`/admin/users/${inv.userId}`)}
                    >
                      <div className={styles.activityItemHeader}>
                        <span className={styles.activityItemTitle}>
                          Investment #{inv.id}
                        </span>
                        <span className={`${styles.activityStatus} ${styles[`status-${inv.status}`]}`}>
                          {inv.status}
                        </span>
                      </div>
                      <div className={styles.activityItemDetails}>
                        <span>{inv.userName}</span>
                        <span className={styles.activityItemAmount}>
                          ${inv.amount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className={styles.emptyState}>No recent investments</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

