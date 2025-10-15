import { useState } from 'react'
import styles from './TimeMachineTab.module.css'

/**
 * Time Machine tab for controlling application time
 */
export default function TimeMachineTab({ 
  timeMachineData, 
  onUpdate, 
  onReset,
  currentUser,
  onDeleteAccounts,
  onSeedTestAccounts,
  onSeedWealthblockAccounts,
  isDeletingAccounts,
  isSeedingAccounts,
  isSeedingWealthblock
}) {
  const [newAppTime, setNewAppTime] = useState(
    timeMachineData.appTime ? new Date(timeMachineData.appTime).toISOString().slice(0, 16) : ''
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const formatEt = (iso) => {
    try {
      return new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }) + ' ET'
    } catch {
      return '-'
    }
  }

  const handleUpdate = async () => {
    if (!newAppTime) {
      alert('Please enter a valid date and time')
      return
    }

    setIsUpdating(true)
    try {
      await onUpdate(newAppTime)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleReset = async () => {
    setIsUpdating(true)
    try {
      const result = await onReset()
      if (result) {
        setNewAppTime(new Date(result.appTime).toISOString().slice(0, 16))
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAccounts = async () => {
    if (!confirm('Are you sure you want to delete all non-admin accounts?')) return
    await onDeleteAccounts()
  }

  const handleSeedAccounts = async () => {
    if (!confirm('Seed test accounts now? This will overwrite existing non-admin data.')) return
    await onSeedTestAccounts()
  }

  const handleSeedWealthblockAccounts = async () => {
    if (!confirm('Seed Real Users from Wealthblock data? This adds production-like test accounts.')) return
    await onSeedWealthblockAccounts()
  }

  return (
    <div className={styles.timeMachineTab}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.titleLine}>
            <span className={styles.titleIcon}>⏱</span>
            <h3 className={styles.title}>Time Machine</h3>
            {timeMachineData.isActive && (
              <span className={styles.activeIndicator}>Active</span>
            )}
          </div>
          <p className={styles.subtitle}>Control the app clock for testing month boundaries, payouts and compounding.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statChip}>
          <span className={styles.statLabel}>App Time</span>
          <span className={styles.statValue}>{timeMachineData.appTime ? formatEt(timeMachineData.appTime) : '-'}</span>
        </div>
        <div className={styles.statChipAlt}>
          <span className={styles.statLabel}>Real Time</span>
          <span className={styles.statValue}>{timeMachineData.realTime ? formatEt(timeMachineData.realTime) : '-'}</span>
        </div>
      </div>

      <div className={styles.contentGrid}>
        {/* Left: Controls */}
        <div className={styles.cardBlock}>
          <div className={styles.blockHeader}>Set New Time</div>
          <div className={styles.blockBody}>
            <input
              type="datetime-local"
              value={newAppTime}
              onChange={(e) => setNewAppTime(e.target.value)}
              className={styles.timeInput}
              disabled={isUpdating}
            />
            <div className={styles.presetsRow}>
              <button className={styles.presetBtn} onClick={() => setNewAppTime(new Date().toISOString().slice(0,16))}>Now</button>
              <button className={styles.presetBtn} onClick={() => {
                const d = new Date(timeMachineData.appTime || new Date().toISOString());
                d.setMonth(d.getMonth() + 1); setNewAppTime(d.toISOString().slice(0,16))
              }}>+1 Month</button>
              <button className={styles.presetBtn} onClick={() => {
                const d = new Date(timeMachineData.appTime || new Date().toISOString());
                d.setMonth(d.getMonth() + 3); setNewAppTime(d.toISOString().slice(0,16))
              }}>+3 Months</button>
              <button className={styles.presetBtn} onClick={() => {
                const d = new Date(timeMachineData.appTime || new Date().toISOString());
                d.setFullYear(d.getFullYear() + 1); setNewAppTime(d.toISOString().slice(0,16))
              }}>+1 Year</button>
              <button className={styles.presetBtn} onClick={() => {
                const d = new Date(timeMachineData.appTime || new Date().toISOString());
                d.setFullYear(d.getFullYear() + 3); setNewAppTime(d.toISOString().slice(0,16))
              }}>+3 Years</button>
              <button className={styles.presetBtn} onClick={() => {
                const d = new Date(timeMachineData.appTime || new Date().toISOString());
                d.setFullYear(d.getFullYear() + 5); setNewAppTime(d.toISOString().slice(0,16))
              }}>+5 Years</button>
            </div>
            <div className={styles.primaryActions}>
              <button onClick={handleUpdate} disabled={isUpdating} className={styles.setTimeButton}>
                {isUpdating ? 'Updating…' : 'Apply Time'}
              </button>
              {timeMachineData.isActive && (
                <button onClick={handleReset} disabled={isUpdating} className={styles.resetTimeButton}>
                  Reset to Real Time
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Data Shortcuts */}
        <div className={styles.cardBlock}>
          <div className={styles.blockHeader}>Data Shortcuts</div>
          <div className={styles.blockBody}>
            <p className={styles.helperText}>Use these tools to quickly demo or reset your environment.</p>
            <div className={styles.quickActions}>
              <button
                onClick={handleSeedAccounts}
                disabled={isDeletingAccounts || isSeedingAccounts || isSeedingWealthblock}
                className={styles.seedAccountsButton}
              >
                {isSeedingAccounts ? 'Seeding…' : 'Seed Test Accounts'}
              </button>
              <button
                onClick={handleSeedWealthblockAccounts}
                disabled={isDeletingAccounts || isSeedingAccounts || isSeedingWealthblock}
                className={styles.seedWealthblockButton}
              >
                {isSeedingWealthblock ? 'Seeding…' : 'Seed Real Users'}
              </button>
              <button
                onClick={handleDeleteAccounts}
                disabled={isDeletingAccounts || isSeedingAccounts || isSeedingWealthblock}
                className={styles.deleteAccountsButton}
              >
                {isDeletingAccounts ? 'Deleting…' : 'Delete All Accounts'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

