import { useRouter } from 'next/navigation'
import MetricCard from '../components/MetricCard'
import ActionCard from '../components/ActionCard'
import SectionCard from '../components/SectionCard'
import styles from './DashboardTab.module.css'

/**
 * Main dashboard tab showing overview metrics and recent activity
 */
export default function DashboardTab({ metrics }) {
  const router = useRouter()

  const hasActionItems = (
    metrics.pendingInvestmentsCount > 0 ||
    metrics.pendingWithdrawalsCount > 0 ||
    metrics.pendingPayoutsCount > 0 ||
    metrics.unverifiedAccountsCount > 0
  )

  return (
    <div className={styles.dashboardTab}>
      {/* Primary Metrics */}
      <div className={styles.primaryMetricsGrid}>
        <MetricCard 
          label="Total Amount Raised" 
          value={`$${metrics.totalAmountRaised.toLocaleString()}`} 
        />
        <MetricCard 
          label="Total AUM" 
          value={`$${metrics.totalAUM.toLocaleString()}`} 
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
          label="Active Investments" 
          value={metrics.activeInvestmentsCount} 
        />
      </div>

      {/* Action Items */}
      {hasActionItems && (
        <SectionCard title="Action Required">
          <div className={styles.actionGrid}>
            {metrics.pendingInvestmentsCount > 0 && (
              <ActionCard
                value={metrics.pendingInvestmentsCount}
                label="Pending Approvals"
                variant="alert"
                onClick={() => router.push('/admin?tab=transactions')}
              />
            )}
            {metrics.pendingWithdrawalsCount > 0 && (
              <ActionCard
                value={metrics.pendingWithdrawalsCount}
                label="Pending Withdrawals"
                variant="warning"
                onClick={() => router.push('/admin?tab=withdrawals')}
              />
            )}
            {metrics.pendingPayoutsCount > 0 && (
              <ActionCard
                value={metrics.pendingPayoutsCount}
                label="Pending Payouts"
                variant="warning"
                onClick={() => router.push('/admin?tab=pending-payouts')}
              />
            )}
            {metrics.unverifiedAccountsCount > 0 && (
              <ActionCard
                value={metrics.unverifiedAccountsCount}
                label="Unverified Accounts"
                variant="info"
                onClick={() => router.push('/admin?tab=accounts')}
              />
            )}
          </div>
        </SectionCard>
      )}

      {/* Two Column Layout */}
      <div className={styles.twoColumnLayout}>
        {/* Left Column - Overview & Distribution */}
        <div className={styles.column}>
          <SectionCard title="Overview">
            <div className={styles.overviewGrid}>
              <div className={styles.overviewItem}>
                <div className={styles.overviewLabel}>Pending Capital</div>
                <div className={styles.overviewValue}>
                  ${metrics.pendingCapital.toLocaleString()}
                </div>
              </div>
              <div className={styles.overviewItem}>
                <div className={styles.overviewLabel}>Avg Investment</div>
                <div className={styles.overviewValue}>
                  ${Math.round(metrics.avgInvestmentSize).toLocaleString()}
                </div>
              </div>
              <div className={styles.overviewItem}>
                <div className={styles.overviewLabel}>Active Investors</div>
                <div className={styles.overviewValue}>{metrics.investorsCount}</div>
              </div>
              <div className={styles.overviewItem}>
                <div className={styles.overviewLabel}>New Accounts (30d)</div>
                <div className={styles.overviewValue}>{metrics.newAccountsCount}</div>
              </div>
            </div>
          </SectionCard>

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

